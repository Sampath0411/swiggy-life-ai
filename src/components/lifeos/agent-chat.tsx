/**
 * Swiggy LifeOS — Full conversational chat interface.
 *
 * A dedicated chat UI for the Life Agent that:
 *   - Maintains message history with user and agent turns
 *   - Shows MCP tool calls as inline thought steps
 *   - Renders rich order cards with Confirm / Cancel
 *   - Supports context-aware follow-up questions
 *   - Falls back to simulation when not authenticated
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type FormEvent,
} from "react";
import {
  Sparkles,
  Loader2,
  Bot,
  CheckCircle2,
  XCircle,
  ShoppingBasket,
  UtensilsCrossed,
  Wine,
  AlertCircle,
  SendHorizonal,
  Trash2,
  Zap,
  ChevronDown,
} from "lucide-react";
import { SAMPLE_PROMPTS } from "@/lib/lifeos";
import { cn } from "@/lib/utils";
import type { AgentRun, AgentStep } from "@/lib/lifeos";
import { McpConnect, type McpConnectionStatus } from "./mcp-connect";

// ─── Types ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "agent" | "system" | "order-card";
  content: string;
  timestamp: number;
  /** For agent messages — the orchestration steps that led to the answer */
  steps?: AgentStep[];
  /** For order-card messages */
  order?: {
    type: "food" | "instamart" | "dineout";
    summary: string;
    total?: number;
    items: number;
    actionLabel: string;
    confirmed?: boolean;
    cancelled?: boolean;
  };
  /** For system messages */
  variant?: "info" | "error" | "success";
}

// ─── Helpers ──────────────────────────────────────────────────────────

let msgId = 0;
function uid() {
  return `msg_${++msgId}`;
}

function getServerIcon(server: AgentStep["server"]) {
  switch (server) {
    case "food": return UtensilsCrossed;
    case "instamart": return ShoppingBasket;
    case "dineout": return Wine;
    default: return Bot;
  }
}

function serverColor(server: AgentStep["server"]) {
  switch (server) {
    case "food": return "text-food border-food/30 bg-food/10";
    case "instamart": return "text-instamart border-instamart/30 bg-instamart/10";
    case "dineout": return "text-dineout border-dineout/30 bg-dineout/10";
    default: return "text-accent border-accent/30 bg-accent/10";
  }
}

function serverLabel(server: AgentStep["server"]) {
  switch (server) {
    case "food": return "Food";
    case "instamart": return "Instamart";
    case "dineout": return "Dineout";
    default: return "Agent";
  }
}

// ─── Chat bubble sub-components ───────────────────────────────────────

function StepList({ steps, revealed }: { steps: AgentStep[]; revealed: number }) {
  return (
    <div className="mt-3 space-y-1.5">
      {steps.slice(0, revealed).map((s, i) => {
        const Icon = getServerIcon(s.server);
        return (
          <div
            key={i}
            className="animate-rise flex items-start gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-xs"
          >
            <Icon className={cn("mt-0.5 h-3 w-3 shrink-0", serverColor(s.server).split(" ")[0])} />
            <span className={cn("shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase", serverColor(s.server))}>
              {serverLabel(s.server)}
            </span>
            <code className="shrink-0 text-muted-foreground">{s.tool}</code>
            <span className="text-muted-foreground/80">{s.detail}</span>
          </div>
        );
      })}
      {revealed < steps.length && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
          <Loader2 className="h-3 w-3 animate-spin" /> orchestrating…
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onConfirm,
  onCancel,
}: {
  order: NonNullable<ChatMessage["order"]>;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const Icon = order.type === "food" ? UtensilsCrossed
    : order.type === "instamart" ? ShoppingBasket
    : Wine;

  const accent = order.type === "food" ? "border-food/30 bg-food/5"
    : order.type === "instamart" ? "border-instamart/30 bg-instamart/5"
    : "border-dineout/30 bg-dineout/5";

  return (
    <div className={cn("mt-3 overflow-hidden rounded-xl border", accent)}>
      <div className="flex items-center gap-2 p-3 border-b border-border/50">
        <div className={cn(
          "grid h-7 w-7 place-items-center rounded-lg",
          order.type === "food" ? "bg-food/15 text-food"
            : order.type === "instamart" ? "bg-instamart/15 text-instamart"
            : "bg-dineout/15 text-dineout",
        )}>
          {Icon && <Icon className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{
            order.type === "food" ? "Food Order"
            : order.type === "instamart" ? "Instamart Order"
            : "Dineout Booking"
          }</p>
          {order.total !== undefined && (
            <p className="text-xs text-muted-foreground">{order.items} item{order.items !== 1 ? "s" : ""} · ₹{order.total}</p>
          )}
        </div>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground">
        {order.summary}
      </div>
      {order.confirmed ? (
        <div className="flex items-center gap-2 border-t border-border/50 bg-instamart/5 px-3 py-2 text-xs text-instamart">
          <CheckCircle2 className="h-3.5 w-3.5" /> Order confirmed
        </div>
      ) : order.cancelled ? (
        <div className="flex items-center gap-2 border-t border-border/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <XCircle className="h-3.5 w-3.5" /> Order cancelled
        </div>
      ) : (
        <div className="flex gap-2 border-t border-border/50 p-2">
          <button onClick={onConfirm}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-primary py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <CheckCircle2 className="h-3 w-3" /> {order.actionLabel}
          </button>
          <button onClick={onCancel}
            className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background py-1.5 text-xs font-medium transition hover:border-destructive/50 hover:text-destructive"
          >
            <XCircle className="h-3 w-3" /> Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function SystemBanner({ content, variant }: { content: string; variant: "info" | "error" | "success" }) {
  const colours = variant === "error"
    ? "border-destructive/30 bg-destructive/10 text-destructive"
    : variant === "success"
    ? "border-instamart/30 bg-instamart/10 text-instamart"
    : "border-accent/30 bg-accent/10 text-accent";

  return (
    <div className={cn("mt-3 flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", colours)}>
      {variant === "error" ? <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        : variant === "success" ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        : <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
      <span>{content}</span>
    </div>
  );
}

// ─── Main Chat Component ──────────────────────────────────────────────

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [revealedSteps, setRevealedSteps] = useState<Record<string, number>>({});
  const [mcpStatus, setMcpStatus] = useState<McpConnectionStatus>("disconnected");
  const [mcpError, setMcpError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showSidebar, setShowSidebar] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, revealedSteps]);

  // Cleanup timers on unmount
  useEffect(() => () => timersRef.current.forEach(clearTimeout), []);

  // ── Detect existing token on mount ──────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem("swiggy_mcp_token");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
    if (parsed.access_token && parsed.expires_at && Date.now() < parsed.expires_at - 60_000) {
          setMcpStatus("connected");
          return;
        }
      } catch { /* ignore corrupt token */ }
      // Expired or corrupt — clean up
      sessionStorage.removeItem("swiggy_mcp_token");
    }
  }, []);

  // ── OAuth handlers ──────────────────────────────────
  const handleConnect = useCallback(async () => {
    setMcpStatus("connecting");
    setMcpError(null);
    try {
      const { initOAuth } = await import("@/lib/mcp-server-fn");
      const { authorizeUrl, state, codeVerifier } = await initOAuth();
      sessionStorage.setItem("swiggy_oauth_state", state);
      sessionStorage.setItem("swiggy_code_verifier", codeVerifier);
      window.location.href = authorizeUrl;
    } catch (err) {
      setMcpStatus("error");
      setMcpError(err instanceof Error ? err.message : "Failed to initiate connection");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      const raw = sessionStorage.getItem("swiggy_mcp_token");
      if (raw) {
        const parsed = JSON.parse(raw);
        const { disconnectMcp } = await import("@/lib/mcp-server-fn");
        await disconnectMcp({ data: { accessToken: parsed.access_token } });
      }
    } catch { /* ignore */ }
    sessionStorage.removeItem("swiggy_mcp_token");
    sessionStorage.removeItem("swiggy_oauth_state");
    sessionStorage.removeItem("swiggy_code_verifier");
    setMcpStatus("disconnected");
    setMcpError(null);
    addSystemMessage("Disconnected from Swiggy MCP.", "info");
  }, []);

  // ── Helper to add messages ──────────────────────────
  function addMessage(msg: ChatMessage) {
    setMessages((prev) => [...prev, msg]);
  }

  function addSystemMessage(content: string, variant: "info" | "error" | "success" = "info") {
    addMessage({ id: uid(), role: "system", content, timestamp: Date.now(), variant });
  }

  function addUserMessage(content: string) {
    addMessage({ id: uid(), role: "user", content, timestamp: Date.now() });
  }

  // ── Execute query ────────────────────────────────────

  async function execute(query: string) {
    if (!query.trim() || isProcessing) return;

    setInput("");
    setShowSuggestions(false);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Add user message
    addUserMessage(query);
    setIsProcessing(true);

    try {
      const token = getAccessToken();

      // ── Classify intent ───────────────────────────────
      const { classifyIntent, resolveArgs } = await import("@/lib/mcp-tools");
      const route = classifyIntent(query);
      const plan = route.plan(query);
      const isReal = !!token;

      // ── Execute via server proxy (avoids CORS) ────────
      const { proxyMcpToolCall } = await import("@/lib/mcp-server-fn");
      const steps: AgentStep[] = [];
      let abortedEarly = false;

      for (const item of plan.serverChain) {
        if (abortedEarly) {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: "(skipped — prior step needed user input)",
          });
          continue;
        }

        if (item.server === "agent") {
          steps.push({
            server: "agent",
            tool: item.tool,
            detail: (item.args?.detail as string) ?? `Processing intent…`,
          });
          continue;
        }

        if (!isReal || !token) {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: "🔐 Connect Swiggy for live data",
          });
          continue;
        }

        // Skip checkout/order/track if previous steps had no items or no order
        const isOrderTool = ["checkout", "place_food_order", "track_order", "track_food_order", "get_booking_status"].includes(item.tool);
        const hasEmptyCart = steps.some((s) => s.detail.includes("0 item") || s.detail.includes("₹—"));
        const hasNoOrder = steps.some((s) => s.detail.includes("ID: —"));
        if (isOrderTool && (hasEmptyCart || hasNoOrder)) {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: `⏭️ Skipped — nothing to ${item.tool.replace("_", " ")}`,
          });
          continue;
        }

        // Make the proxied MCP call with resolved args
        const resolvedArgs = resolveArgs(item.args, query, steps as any);
        const result = await proxyMcpToolCall({
          data: {
            server: item.server,
            toolName: item.tool,
            args: resolvedArgs,
            accessToken: token,
          },
        });

        if (result.success) {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: describeProxyResult(item.tool, result.result),
            result: result.result,
          });
        } else if (result.authError) {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: "🔐 Authentication required. Please reconnect Swiggy.",
          });
          abortedEarly = true;
          setMcpStatus("error");
          setMcpError("Session expired — please disconnect and reconnect");
        } else {
          steps.push({
            server: item.server,
            tool: item.tool,
            detail: `⚠️ ${result.error ?? "Tool call failed"}`,
          });
        }
      }

	    // ── Generate honest answer based on actual results ──
      const successfulSteps = steps.filter(
        (s) => s.server !== "agent" && s.detail && !s.detail.startsWith("⚠️") && !s.detail.startsWith("🔐") && !s.detail.startsWith("(skipped") && !s.detail.startsWith("Connect")
      );
      const hasRealResults = successfulSteps.some((s) => {
        // Use word-boundary regex to avoid false positives like
        // "10 saved" matching the substring "0 saved"
        const detail = s.detail;
        const zeroPattern = /\b0\s+(saved|product|item|coupon|slot|frequent)/;
        return !zeroPattern.test(detail) && !detail.includes("Cart updated") && !detail.includes("Order placed! ID: —");
      });

      let answer: string;
      let showOrderCard = false;

      if (abortedEarly) {
        answer = "I need you to connect your Swiggy account first.";
      } else if (!hasRealResults && !isReal) {
        answer = plan.answer;
      } else if (!hasRealResults && isReal) {
        // Connected but got empty results
        const emptySteps = successfulSteps.map((s) => s.detail).join("; ");
        answer = `I connected to Swiggy but didn't find any data to work with. ${emptySteps ? `Results: ${emptySteps}` : "You may need to save a delivery address in your Swiggy account first."} Try searching for a specific product or restaurant.`;
      } else {
        // We have real results — use a dynamic summary
        const resultSummaries = successfulSteps
          .filter((s) => !s.detail.includes("Cart updated") && !s.detail.includes("Order placed"))
          .map((s) => s.detail);
        answer = resultSummaries.length > 0
          ? `Here's what I found: ${resultSummaries.join(". ")}. What would you like to do next?`
          : plan.answer;
        showOrderCard = true;
      }

      const agentMsgId = uid();

      // Add agent message immediately (with all steps, revealed count = 0)
      addMessage({
        id: agentMsgId,
        role: "agent",
        content: answer,
        timestamp: Date.now(),
        steps,
      });

      // Start per-message step reveal animation
      steps.forEach((_, i) => {
        timersRef.current.push(
          setTimeout(() => {
            setRevealedSteps((prev) => ({ ...prev, [agentMsgId]: i + 1 }));
          }, 280 * (i + 1))
        );
      });

      const finalReveal = 280 * (steps.length + 1);
      timersRef.current.push(
        setTimeout(() => {
          setRevealedSteps((prev) => ({ ...prev, [agentMsgId]: (steps?.length ?? 0) + 1 }));
          setIsProcessing(false);
        }, finalReveal)
      );

      // After all steps revealed, show order card only if real results exist
      if (showOrderCard && steps.length > 0 && !abortedEarly) {
        const revealDelay = 280 * (steps.length + 1) + 400;
        timersRef.current.push(
          setTimeout(() => {
            const orderType: "food" | "instamart" | "dineout" =
              steps.some((s) => s.server === "instamart" && !s.detail.startsWith("⚠️") && !s.detail.startsWith("🔐") && !s.detail.includes("0 product") && !s.detail.includes("0 saved")) ? "instamart"
              : steps.some((s) => s.server === "dineout" && !s.detail.startsWith("⚠️") && !s.detail.startsWith("🔐") && !s.detail.includes("0 slot")) ? "dineout"
              : "food";

            addMessage({
              id: uid(),
              role: "order-card",
              content: "",
              timestamp: Date.now(),
              order: {
                type: orderType,
                summary: "Your order is ready to be placed with Swiggy.",
                actionLabel: orderType === "dineout" ? "Confirm booking" : "Place order",
              },
            });
          }, revealDelay)
        );
      }
    } catch (err) {
      addSystemMessage(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
        "error"
      );
      setIsProcessing(false);
    }
  }

  // ─── Proxy result summariser ─────────────────────────

  function describeProxyResult(tool: string, result: unknown): string {
    if (!result) return "Completed.";
    const r = result as Record<string, unknown>;

    switch (tool) {
      case "get_addresses": {
        const addrs = Array.isArray(r.addresses ?? r.data) ? (r.addresses ?? r.data) as Array<{ label?: string }> : [];
        return `Found ${addrs.length} saved address${addrs.length !== 1 ? "es" : ""}${addrs.length > 0 ? ": " + addrs.map((a: { label?: string }) => a.label).join(", ") : ""}`;
      }
      case "search_restaurants": {
        const rs = Array.isArray(r.restaurants ?? r.data) ? (r.restaurants ?? r.data) as Array<{ name?: string }> : [];
        return `Found ${rs.length} restaurant${rs.length !== 1 ? "s" : ""}${rs.length > 0 ? " · " + rs.slice(0, 3).map((rest: { name?: string }) => rest.name).join(", ") : ""}`;
      }
      case "search_restaurants_dineout": {
        const drs = Array.isArray(r.restaurants ?? r.data) ? (r.restaurants ?? r.data) as Array<{ name?: string }> : [];
        return `Found ${drs.length} dining restaurant${drs.length !== 1 ? "s" : ""}${drs.length > 0 ? " · " + drs.slice(0, 3).map((rest: { name?: string }) => rest.name).join(", ") : ""}`;
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
        return `Found ${Array.isArray(r.coupons ?? r.data) ? (r.coupons ?? r.data).length : 0} coupon(s)`;
      case "place_food_order":
      case "checkout":
        return `Order placed! ID: ${r.orderId ?? r.order?.orderId ?? "—"}`;
      case "track_food_order":
      case "track_order":
        return `Status: ${r.status ?? "in transit"}`;
      case "your_go_to_items":
        return `Loaded ${Array.isArray(r.items ?? r.data) ? (r.items ?? r.data).length : 0} frequent item(s)`;
      case "get_available_slots":
        return `${Array.isArray(r.slots ?? r.data) ? (r.slots ?? r.data).length : 0} slot(s) available`;
      case "book_table":
        return `Table booked! ID: ${r.bookingId ?? r.id ?? "—"}`;
      case "search_products":
        return `Found ${Array.isArray(r.products ?? r.data) ? (r.products ?? r.data).length : 0} product(s)`;
      default:
        return "Completed";
    }
  }

  // ── Order confirm / cancel ───────────────────────────

  function handleOrderConfirm(msgId: string, order: NonNullable<ChatMessage["order"]>) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.order
          ? { ...m, order: { ...m.order, confirmed: true } }
          : m
      )
    );
    addSystemMessage(
      `${order.type === "dineout" ? "Booking" : "Order"} confirmed! Check your Swiggy account for details.`,
      "success"
    );
  }

  function handleOrderCancel(msgId: string) {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.order
          ? { ...m, order: { ...m.order, cancelled: true } }
          : m
      )
    );
    addSystemMessage("Order cancelled. Let me know if you'd like to change anything.", "info");
  }

  // ── Clear conversation ───────────────────────────────

  function clearChat() {
    setMessages([]);
    setRevealedSteps({});
    setShowSuggestions(true);
    setInput("");
    setIsProcessing(false);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    inputRef.current?.focus();
  }

  // ── Render helpers ────────────────────────────────────

  function handleSuggestionClick(p: string) {
    setInput(p);
    setShowSuggestions(false);
    // Execute after a brief delay — tracked in timersRef for cleanup on unmount
    const timer = setTimeout(() => execute(p), 50);
    timersRef.current.push(timer);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    execute(input);
  }

  // ── Render ────────────────────────────────────────────

  const getWelcomeMessages = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="h-8 w-8 text-primary" />
      </div>
      <h2 className="text-2xl font-bold">LifeOS Agent</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your AI lifestyle assistant. Order food, restock groceries, book tables —
        all through natural conversation.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {SAMPLE_PROMPTS.slice(0, 4).map((p) => (
          <button
            key={p}
            onClick={() => handleSuggestionClick(p)}
            className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex h-full gap-0">
      {/* Sidebar */}
      {showSidebar && (
        <aside className="hidden w-64 shrink-0 border-r border-border/60 bg-background/50 p-4 lg:block">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Quick actions</h3>
            <button onClick={() => setShowSidebar(false)} className="text-muted-foreground/50 hover:text-foreground">
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-4 space-y-1.5">
            {SAMPLE_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSuggestionClick(p)}
                disabled={isProcessing}
                className="w-full rounded-lg px-3 py-2 text-left text-xs text-muted-foreground transition hover:bg-secondary/60 hover:text-foreground disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Status</p>
            <McpConnect status={mcpStatus} onConnect={handleConnect} onDisconnect={handleDisconnect} error={mcpError} compact />
            <div className="space-y-1 text-xs text-muted-foreground/70">
              <p className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-instamart" />
                {messages.length} messages in session
              </p>
            </div>
          </div>
        </aside>
      )}

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <header className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className="hidden rounded-lg border border-border p-1.5 text-muted-foreground transition hover:text-foreground lg:block"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition", showSidebar ? "" : "-rotate-90")} />
            </button>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
              </span>
              <span className="text-sm font-semibold">LifeOS Agent</span>
              <span className="hidden text-[11px] text-muted-foreground/60 sm:inline">
                · {mcpStatus === "connected" ? "Live MCP" : "Simulated"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <McpConnect status={mcpStatus} onConnect={handleConnect} onDisconnect={handleDisconnect} error={mcpError} compact />
            <button
              onClick={clearChat}
              disabled={messages.length === 0}
              className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition hover:text-foreground disabled:opacity-40"
              title="Clear conversation"
            >
              <Trash2 className="h-3 w-3" />
              <span className="hidden sm:inline">New chat</span>
            </button>
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4 sm:px-6"
        >
          {messages.length === 0 ? (
            getWelcomeMessages()
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {messages.map((msg) => (
                <div key={msg.id} className={cn(
                  "animate-rise",
                  msg.role === "user" && "flex justify-end",
                )}>
                  <div className={cn(
                    msg.role === "user" && "max-w-[85%] sm:max-w-[70%]",
                    msg.role === "agent" && "max-w-full",
                    msg.role === "system" && "max-w-full",
                    msg.role === "order-card" && "max-w-md",
                  )}>
                    {/* User bubble */}
                    {msg.role === "user" && (
                      <div className="rounded-2xl bg-primary px-4 py-2.5 text-sm text-primary-foreground">
                        {msg.content}
                      </div>
                    )}

                    {/* Agent bubble */}
                    {msg.role === "agent" && (
                      <div className="rounded-2xl border border-border/60 bg-background/60 px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/60">
                          <Bot className="h-3.5 w-3.5" />
                          LifeOS Agent
                          <span className="text-[10px]">
                            · {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>

                        {msg.steps && msg.steps.length > 0 && (
                          <StepList steps={msg.steps} revealed={revealedSteps[msg.id] ?? 0} />
                        )}

                        {(revealedSteps[msg.id] ?? 0) >= (msg.steps?.length ?? 0) + 1 && (
                          <div className="mt-3 flex gap-2.5 rounded-xl border border-primary/20 bg-primary/5 p-3">
                            <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          </div>
                        )}

                        {isProcessing && msg.steps && (revealedSteps[msg.id] ?? 0) <= msg.steps.length && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground/70">
                            <span className="flex gap-0.5">
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "0ms" }} />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "150ms" }} />
                              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/50" style={{ animationDelay: "300ms" }} />
                            </span>
                            <span>Thinking…</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Order card */}
                    {msg.role === "order-card" && msg.order && (
                      <OrderCard
                        order={msg.order}
                        onConfirm={() => handleOrderConfirm(msg.id, msg.order!)}
                        onCancel={() => handleOrderCancel(msg.id)}
                      />
                    )}

                    {/* System banner */}
                    {msg.role === "system" && msg.variant && (
                      <SystemBanner content={msg.content} variant={msg.variant} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t border-border/60 px-4 py-3 sm:px-6">
          <form onSubmit={onSubmit} className="mx-auto max-w-3xl">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-background/50 px-4 py-3 focus-within:border-primary/60">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Order dinner, restock groceries, book a table…"
                aria-label="Ask the LifeOS agent"
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                disabled={isProcessing}
              />
              <button
                type="submit"
                disabled={isProcessing || !input.trim()}
                className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {isProcessing ? (
                  <><Loader2 className="h-3 w-3 animate-spin" /> Processing</>
                ) : (
                  <><SendHorizonal className="h-3 w-3" /> Send</>
                )}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground/50 text-center">
              LifeOS uses Swiggy MCP — {mcpStatus === "connected" ? "live calls enabled" : "connect your Swiggy account for live ordering"}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Token access helper ──────────────────────────────────────────────

function getAccessToken(): string | null {
  try {
    const raw = sessionStorage.getItem("swiggy_mcp_token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expires_at && Date.now() > parsed.expires_at - 60_000) {
      sessionStorage.removeItem("swiggy_mcp_token");
      return null;
    }
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}
