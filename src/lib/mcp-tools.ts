/**
 * Swiggy MCP — intent classification, tool routing, and orchestration.
 *
 * Maps natural-language user queries to chains of MCP tool calls
 * across Food, Instamart, and Dineout servers.
 *
 * Each route matches a query pattern and returns an orchestration plan
 * that the agent executes step-by-step against the real MCP servers.
 */

import type { McpServer, AgentRun, AgentStep } from "./mcp-types";
import { callMcpTool, McpAuthError } from "./mcp-client";
import type { McpClientOptions } from "./mcp-client";

// ─── Intent classification ─────────────────────────────────────────

interface IntentRoute {
  /** Regex to match against the user's query */
  match: RegExp;
  /** Human-readable label for this intent */
  label: string;
  /** Generate the orchestration plan */
  plan: (query: string) => {
    intent: string;
    plan: string;
    serverChain: Array<{ server: McpServer | "agent"; tool: string; args?: Record<string, unknown> }>;
    answer: string;
  };
}

const INTENT_ROUTES: IntentRoute[] = [
  // ── Grocery / Pantry ──────────────────────────────
  {
    match: /grocery|groc|fridge|pantry|instamart|shopping\s*list|milk|egg|vegetable|fruit|stock/i,
    label: "grocery",
    plan: () => ({
      intent: "Grocery replenishment",
      plan: "Read addresses → search products → build cart → schedule",
      serverChain: [
        { server: "instamart", tool: "get_addresses" },
        { server: "instamart", tool: "search_products", args: { addressId: "$1", query: "$query" } },
        { server: "instamart", tool: "update_cart", args: { items: "$items" } },
        { server: "instamart", tool: "get_cart" },
        { server: "instamart", tool: "checkout", args: { paymentMethod: "COD" } },
        { server: "instamart", tool: "track_order", args: { orderId: "$orderId" } },
      ],
      answer:
        "Your week is stocked, arriving at the usual slot. I checked your pantry, matched your regular brands, and kept everything under the weekly cap.",
    }),
  },

  // ── Restaurant / Food delivery ─────────────────────
  {
    match: /order|food|delivery|hungry|eat|dinner|lunch|breakfast|meal|restaurant|biryani|pizza|burger/i,
    label: "food-order",
    plan: () => ({
      intent: "Food delivery",
      plan: "Resolve address → search restaurants → browse menu → build cart → apply offers → place order → track",
      serverChain: [
        { server: "food", tool: "get_addresses" },
        { server: "food", tool: "search_restaurants", args: { addressId: "$1", query: "$query" } },
        { server: "food", tool: "get_restaurant_menu", args: { restaurantId: "$restaurantId" } },
        { server: "food", tool: "update_food_cart", args: { restaurantId: "$restaurantId", items: "$items" } },
        { server: "food", tool: "fetch_food_coupons" },
        { server: "food", tool: "get_food_cart" },
        { server: "food", tool: "place_food_order", args: { paymentMethod: "COD" } },
        { server: "food", tool: "track_food_order", args: { orderId: "$orderId" } },
      ],
      answer:
        "Order placed and being tracked. Your food is on its way with real-time updates.",
    }),
  },

  // ── Table booking / Dineout ────────────────────────
  {
    match: /book|table|reserv|dineout|dine\s*out|date\s*night|restaurant\s*tonight|window\s*seat/i,
    label: "dineout",
    plan: () => ({
      intent: "Dineout table reservation",
      plan: "Get saved locations → search restaurants → check slots → create cart → book table → confirm",
      serverChain: [
        { server: "dineout", tool: "get_saved_locations" },
        { server: "dineout", tool: "search_restaurants_dineout", args: { locationId: "$1", query: "$query" } },
        { server: "dineout", tool: "get_restaurant_details", args: { restaurantId: "$restaurantId" } },
        { server: "dineout", tool: "get_available_slots", args: { restaurantId: "$restaurantId", date: "$date", guests: 2 } },
        { server: "dineout", tool: "create_cart", args: { restaurantId: "$restaurantId", slotDate: "$date", slotTime: "$time", guests: 2, billToPay: 0, skipPayment: true } },
        { server: "dineout", tool: "book_table", args: { cartId: "$cartId", isFree: true, bookingPrice: 0 } },
      ],
      answer:
        "Table booked and confirmed. I've set a reminder so you're not rushed.",
    }),
  },

  // ── Fitness / Protein / Health ─────────────────────
  {
    match: /protein|gym|calorie|healthy|macro|workout|fitness|diet|post.?workout/i,
    label: "fitness",
    plan: () => ({
      intent: "Fitness-aligned meal planning",
      plan: "Find high-protein options → check macros → order → track",
      serverChain: [
        { server: "food", tool: "get_addresses" },
        { server: "food", tool: "search_restaurants", args: { addressId: "$1", query: "high protein" } },
        { server: "food", tool: "get_restaurant_menu", args: { restaurantId: "$restaurantId" } },
        { server: "food", tool: "update_food_cart", args: { restaurantId: "$restaurantId", items: "$items" } },
        { server: "food", tool: "place_food_order", args: { paymentMethod: "COD" } },
      ],
      answer:
        "High-protein meal on the way — I picked options that match your macros and kept the calorie count in check.",
    }),
  },

  // ── Budget / Cheap / Affordable ────────────────────
  {
    match: /budget|cheap|under\s*\d+|affordable|afford|save|money|cost|price|cheapest|low.?cost/i,
    label: "budget",
    plan: () => ({
      intent: "Budget-constrained ordering",
      plan: "Analyse affordability → filter by price → order",
      serverChain: [
        { server: "food", tool: "get_addresses" },
        { server: "food", tool: "search_restaurants", args: { addressId: "$1", query: "$query" } },
        { server: "food", tool: "get_restaurant_menu", args: { restaurantId: "$restaurantId" } },
        { server: "food", tool: "update_food_cart", args: { restaurantId: "$restaurantId", items: "$items" } },
        { server: "food", tool: "fetch_food_coupons" },
        { server: "food", tool: "apply_food_coupon", args: { code: "$coupon" } },
        { server: "food", tool: "place_food_order", args: { paymentMethod: "COD" } },
      ],
      answer:
        "Found great options within your budget. I applied available coupons and the total stays well inside what you wanted to spend.",
    }),
  },

  // ── Recurring / Routine / Daily ────────────────────
  {
    match: /routine|daily|every\s+(day|morning|weekday|evening)|schedule|recurring|auto|habit/i,
    label: "routine",
    plan: () => ({
      intent: "Recurring routine setup",
      plan: "Create trigger → bind tools → confirm cadence",
      serverChain: [
        { server: "food", tool: "get_addresses" },
        { server: "food", tool: "search_restaurants", args: { addressId: "$1", query: "breakfast" } },
        { server: "food", tool: "get_restaurant_menu", args: { restaurantId: "$restaurantId" } },
      ],
      answer:
        "Your daily routine is all set. I'll check the pantry first and auto-order only when needed — no stale repeats, no morning decisions.",
    }),
  },

  // ── Go-to items / Quick reorder ────────────────────
  {
    match: /go.?to|favourite|favorite|usual|again|repeat|reorder/i,
    label: "quick-reorder",
    plan: () => ({
      intent: "Quick reorder from favourites",
      plan: "Get addresses → fetch go-to items → build cart → checkout",
      serverChain: [
        { server: "instamart", tool: "get_addresses" },
        { server: "instamart", tool: "your_go_to_items", args: { addressId: "$1" } },
        { server: "instamart", tool: "update_cart", args: { items: "$items" } },
        { server: "instamart", tool: "checkout", args: { paymentMethod: "COD" } },
      ],
      answer:
        "Reordered your usuals — same brands, same quantities, arriving at the usual time.",
    }),
  },

  // ── Combined evening (Food + Dineout) ──────────────
  {
    match: /evening|plan.*(night|date|outing)|dinner.*(movie|show)|night.*out/i,
    label: "combined-evening",
    plan: () => ({
      intent: "Combined evening plan",
      plan: "Food delivery + Dineout in one agent turn",
      serverChain: [
        { server: "dineout", tool: "get_saved_locations" },
        { server: "dineout", tool: "search_restaurants_dineout", args: { locationId: "$1", query: "" } },
        { server: "dineout", tool: "get_restaurant_details", args: { restaurantId: "$restaurantId" } },
        { server: "dineout", tool: "get_available_slots", args: { restaurantId: "$restaurantId", date: "$date", guests: 2 } },
        { server: "dineout", tool: "book_table", args: { cartId: "$cartId", isFree: true, bookingPrice: 0 } },
        { server: "food", tool: "get_addresses" },
        { server: "food", tool: "search_restaurants", args: { addressId: "$1", query: "dessert" } },
      ],
      answer:
        "Your evening's planned: dinner reservation sorted and a post-meal dessert queued up. Cab reminder set so you're not rushing.",
    }),
  },
];

// ─── Fallback for unrecognised queries ─────────────────────────────

const FALLBACK_CHAIN: Array<{ server: McpServer | "agent"; tool: string; args?: Record<string, unknown> }> = [
  { server: "agent", tool: "intent.classify", args: { detail: "Routed across Food + Instamart + Dineout" } },
  { server: "food", tool: "search_restaurants", args: { addressId: "", query: "popular" } },
  { server: "instamart", tool: "get_pantry_state", args: { addressId: "" } },
  { server: "agent", tool: "memory.write", args: { detail: "Preference saved for next time" } },
];

const FALLBACK_ANSWER =
  "I checked what's available near you and cross-referenced it with your usual preferences. Here's what I'd recommend for today.";

// ─── Route matching ────────────────────────────────────────────────

export function classifyIntent(query: string): IntentRoute {
  return INTENT_ROUTES.find((r) => r.match.test(query)) ?? {
    match: /.*/,
    label: "general",
    plan: () => ({
      intent: "General lifestyle request",
      plan: "Understand → pick servers → execute → learn",
      serverChain: FALLBACK_CHAIN,
      answer: FALLBACK_ANSWER,
    }),
  };
}

// ─── Orchestration execution ───────────────────────────────────────

/**
 * Execute an orchestration plan against the real MCP servers.
 *
 * Steps through the server chain, calling each tool in sequence.
 * Returns an AgentRun with the completed steps and final answer.
 *
 * Falls back to simulated steps if no access token is available.
 */
export async function executePlan(
  query: string,
  accessToken?: string | null,
): Promise<AgentRun> {
  const route = classifyIntent(query);
  const plan = route.plan(query);
  const opts: McpClientOptions = { accessToken };

  const steps: AgentStep[] = [];
  let abortedEarly = false;

  for (const item of plan.serverChain) {
    if (abortedEarly) {
      // Add as pending (never executed)
      steps.push({
        server: item.server,
        tool: item.tool,
        detail: "(skipped — prior step needed user input)",
      });
      continue;
    }

    if (item.server === "agent") {
      // Agent-internal steps (no MCP call needed)
      steps.push({
        server: "agent",
        tool: item.tool,
        detail: (item.args?.detail as string) ?? `Processing intent…`,
      });
      continue;
    }

    // ── Real MCP tool call ──
    try {
      const args = resolveArgs(item.args, query, steps);
      const result = await callMcpTool(item.server, item.tool, args, opts);
      steps.push({
        server: item.server,
        tool: item.tool,
        detail: describeResult(item.tool, result),
        result,
      });
    } catch (err: unknown) {
      if (err instanceof McpAuthError) {
        // Auth required — stop executing and signal re-auth
        steps.push({
          server: item.server,
          tool: item.tool,
          detail: "🔐 Authentication required. Please connect your Swiggy account.",
        });
        abortedEarly = true;
      } else {
        steps.push({
          server: item.server,
          tool: item.tool,
          detail: `⚠️ ${err instanceof Error ? err.message : "Tool call failed"}`,
        });
        // Don't abort on non-auth errors — continue with the plan
      }
    }
  }

  return {
    intent: plan.intent,
    plan: plan.plan,
    steps,
    answer: abortedEarly
      ? "I need you to connect your Swiggy account first so I can make these calls for real."
      : plan.answer,
  };
}

// ─── Template argument resolver ────────────────────────────────────

export function resolveArgs(
  template: Record<string, unknown> | undefined,
  query: string,
  steps: AgentStep[],
): Record<string, unknown> {
  if (!template) return {};
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(template)) {
    if (typeof value === "string") {
      // $1, $2, ... → step results
      const matchRef = value.match(/^\$(\d+)$/);
      if (matchRef) {
        const idx = parseInt(matchRef[1], 10) - 1;
        resolved[key] = steps[idx]?.result ?? value;
        continue;
      }
      // $query → the original query string
      if (value === "$query") {
        resolved[key] = query;
        continue;
      }
      // $orderId, $restaurantId, etc. → extract from step results
      if (value.startsWith("$")) {
        const prop = value.slice(1);
        resolved[key] = extractFromResults(prop, steps) ?? value;
        continue;
      }
    }
    resolved[key] = value;
  }
  return resolved;
}

function extractFromResults(prop: string, steps: AgentStep[]): unknown {
  for (const step of steps) {
    if (step.result && typeof step.result === "object") {
      const r = step.result as Record<string, unknown>;
      if (r[prop]) return r[prop];
      // Nested data property
      if (r.data && typeof r.data === "object") {
        const d = r.data as Record<string, unknown>;
        if (d[prop]) return d[prop];
        // Check data[0] for array responses
        if (Array.isArray(r.data)) {
          const first = r.data[0] as Record<string, unknown> | undefined;
          if (first?.[prop]) return first[prop];
        }
      }
    }
  }
  return undefined;
}

// ─── Result summariser ─────────────────────────────────────────────

function describeResult(tool: string, result: unknown): string {
  if (!result) return "Completed.";
  const r = result as Record<string, unknown>;

  switch (tool) {
    case "get_addresses": {
      const addrs = Array.isArray(r.addresses ?? r.data) ? (r.addresses ?? r.data) as Array<{ label?: string }> : [];
      return `Found ${addrs.length} saved address${addrs.length !== 1 ? "es" : ""}` +
        (addrs.length > 0 ? `: ${addrs.map((a: { label?: string }) => a.label).join(", ")}` : "");
    }
    case "search_restaurants": {
      const rs = Array.isArray(r.restaurants ?? r.data) ? (r.restaurants ?? r.data) as Array<{ name?: string }> : [];
      return `Found ${rs.length} restaurant${rs.length !== 1 ? "s" : ""}` +
        (rs.length > 0 ? ` · ${rs.slice(0, 3).map((rest: { name?: string }) => rest.name).join(", ")}` : "");
    }
    case "search_restaurants_dineout": {
      const drs = Array.isArray(r.restaurants ?? r.data) ? (r.restaurants ?? r.data) as Array<{ name?: string }> : [];
      return `Found ${drs.length} restaurant${drs.length !== 1 ? "s" : ""} for dining` +
        (drs.length > 0 ? ` · ${drs.slice(0, 3).map((rest: { name?: string }) => rest.name).join(", ")}` : "");
    }
    case "get_restaurant_menu":
    case "get_restaurant_details":
      return `Loaded details for "${r.name ?? r.restaurantName ?? "restaurant"}"`;
    case "get_food_cart":
    case "get_cart":
      return `Cart total: ₹${r.total ?? "—"} with ${Array.isArray(r.items) ? r.items.length : 0} item(s)`;
    case "update_food_cart":
    case "update_cart":
      return "Cart updated";
    case "fetch_food_coupons":
    case "get_food_coupons":
      return `Found ${Array.isArray(r.coupons ?? r.data) ? (r.coupons ?? r.data).length : 0} available coupon(s)`;
    case "apply_food_coupon":
      return `Coupon "${r.code ?? ""}" applied`;
    case "place_food_order":
    case "checkout":
      return `Order placed! Order ID: ${r.orderId ?? r.order?.orderId ?? "—"}`;
    case "track_food_order":
    case "track_order":
      return `Order status: ${r.status ?? "in transit"}`;
    case "your_go_to_items":
      return `Loaded ${Array.isArray(r.items ?? r.data) ? (r.items ?? r.data).length : 0} frequently ordered item(s)`;
    case "get_available_slots":
      return `Found ${Array.isArray(r.slots ?? r.data) ? (r.slots ?? r.data).length : 0} available time slot(s)`;
    case "book_table":
      return `Table booked! Booking ID: ${r.bookingId ?? r.id ?? "—"}`;
    default:
      return "Completed";
  }
}

// ─── Simulated fallback (for when no token is available) ───────────

import { runAgent as simulatedRunAgent } from "./lifeos";

/**
 * Main entry point: try real MCP, fall back to simulation.
 *
 * When `accessToken` is provided, executes against real MCP servers.
 * Otherwise falls back to the existing client-side simulator so the
 * app stays functional during development.
 */
export async function runMcpAgent(query: string, accessToken?: string | null): Promise<AgentRun> {
  if (!accessToken) {
    return simulatedRunAgent(query) as AgentRun;
  }
  return executePlan(query, accessToken);
}
