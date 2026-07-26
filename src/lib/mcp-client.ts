/**
 * Swiggy MCP — streamable HTTP transport client.
 *
 * Implements the Model Context Protocol over HTTP for Swiggy's
 * Food, Instamart, and Dineout servers.
 *
 * Transport: POST JSON-RPC 2.0 → receive JSON-RPC 2.0 response.
 * Auth: Bearer token (OAuth 2.1 + PKCE, handled by mcp-auth.ts).
 *
 * Also provides SSE streaming for servers that support it.
 *
 * @see https://mcp.swiggy.com/builders/docs/reference/
 */

import type {
  McpServer,
  McpToolDefinition,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
} from "./mcp-types";
import { MCP_SERVER_URLS, MCP_SERVER_LABELS } from "./mcp-types";

// ─── Client-level errors ───────────────────────────────────────────

export class McpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: number,
    public readonly server?: McpServer,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export class McpAuthError extends McpError {
  constructor(server: McpServer) {
    super(`Authentication required for ${MCP_SERVER_LABELS[server]}`, 401, 401, server);
    this.name = "McpAuthError";
  }
}

// ─── Tool definition registry ──────────────────────────────────────

// Built from https://mcp.swiggy.com/builders/docs/reference/
// Schemas are summarised — full parameter details live on individual tool pages.
export const ALL_TOOLS: McpToolDefinition[] = [
  // ── Food MCP (14 tools) ─────────────────────────────
  {
    name: "search_restaurants",
    description: "Search and order food from restaurants for delivery. PRIMARY FOOD DELIVERY SERVICE.",
    server: "food",
    input: {
      addressId: { type: "string", required: true, description: "Saved delivery address ID" },
      query: { type: "string", required: true, description: "Search query — dish, cuisine, or restaurant name" },
    },
  },
  {
    name: "search_menu",
    description: "Search for dishes and menu items across restaurants.",
    server: "food",
    input: {
      addressId: { type: "string", required: true, description: "Saved delivery address ID" },
      query: { type: "string", required: true, description: "Dish or menu item keyword" },
    },
  },
  {
    name: "get_restaurant_menu",
    description: "Get the complete menu of a restaurant, paginated by category.",
    server: "food",
    input: {
      restaurantId: { type: "string", required: true, description: "Restaurant ID from search results" },
    },
  },
  {
    name: "get_addresses",
    description: "Get all saved delivery addresses for the authenticated user. Works for both Instamart and Food.",
    server: "food",
    input: {},
  },
  {
    name: "update_food_cart",
    description: "Add items to food delivery cart or update cart contents. Cart is tied to a single restaurant.",
    server: "food",
    input: {
      restaurantId: { type: "string", required: true, description: "Restaurant ID" },
      items: { type: "array", required: true, description: "Array of { itemId: string, quantity: number }" },
    },
  },
  {
    name: "get_food_cart",
    description: "Get current food delivery cart with all items.",
    server: "food",
    input: {},
  },
  {
    name: "flush_food_cart",
    description: "Clear or empty the food delivery cart.",
    server: "food",
    input: {},
  },
  {
    name: "fetch_food_coupons",
    description: "Get available coupons and offers for food delivery order.",
    server: "food",
    input: {},
  },
  {
    name: "apply_food_coupon",
    description: "Apply coupon code or discount to food delivery order.",
    server: "food",
    input: {
      code: { type: "string", required: true, description: "Coupon code to apply" },
    },
  },
  {
    name: "place_food_order",
    description: "Place food delivery order and confirm order placement. NOT idempotent — check get_food_orders on 5xx.",
    server: "food",
    input: {
      paymentMethod: { type: "string", required: true, description: "Payment method (v1: only 'COD' supported)" },
    },
  },
  {
    name: "get_food_orders",
    description: "Get active food delivery orders and order status.",
    server: "food",
    input: {},
  },
  {
    name: "get_food_order_details",
    description: "Get detailed information about a specific food delivery order.",
    server: "food",
    input: {
      orderId: { type: "string", required: true, description: "Order ID" },
    },
  },
  {
    name: "track_food_order",
    description: "Track food delivery order status and delivery progress. Poll no faster than every 10 s.",
    server: "food",
    input: {
      orderId: { type: "string", required: true, description: "Order ID" },
    },
  },
  {
    name: "report_error",
    description: "Generate an error report to share with the Swiggy MCP team.",
    server: "food",
    input: {
      errorDescription: { type: "string", required: true, description: "Description of the error encountered" },
    },
  },

  // ── Instamart MCP (13 tools) ────────────────────────
  {
    name: "search_products",
    description: "Search for products available at the selected address. ALWAYS search first to see available products.",
    server: "instamart",
    input: {
      addressId: { type: "string", required: true, description: "Delivery address ID" },
      query: { type: "string", required: true, description: "Product search query" },
    },
  },
  {
    name: "your_go_to_items",
    description: "Fetch the user's frequently or recently ordered items for quick reorder.",
    server: "instamart",
    input: {
      addressId: { type: "string", required: true, description: "Delivery address ID" },
    },
  },
  {
    name: "get_addresses",
    description: "Get all saved delivery addresses. Shared tool between Food and Instamart.",
    server: "instamart",
    input: {},
  },
  {
    name: "create_address",
    description: "Create a new delivery address for the authenticated user.",
    server: "instamart",
    input: {
      label: { type: "string", required: true, description: "Address label (e.g. 'Home', 'Office')" },
      address: { type: "string", required: true, description: "Full address text" },
      city: { type: "string", required: false, description: "City name" },
      pincode: { type: "string", required: false, description: "Pincode" },
    },
  },
  {
    name: "delete_address",
    description: "Delete a saved delivery address.",
    server: "instamart",
    input: {
      addressId: { type: "string", required: true, description: "Address ID to delete" },
    },
  },
  {
    name: "update_cart",
    description: "Update Instamart grocery cart with items. Replaces entire cart. NOT for Food delivery.",
    server: "instamart",
    input: {
      items: { type: "array", required: true, description: "Array of { spinId: string, quantity: number }" },
    },
  },
  {
    name: "get_cart",
    description: "Get current Instamart grocery cart with all items and bill breakdown.",
    server: "instamart",
    input: {},
  },
  {
    name: "clear_cart",
    description: "Clear (remove all items from) the Instamart cart.",
    server: "instamart",
    input: {},
  },
  {
    name: "checkout",
    description: "Place and confirm Instamart grocery order. Creates order and confirms payment in one operation.",
    server: "instamart",
    input: {
      paymentMethod: { type: "string", required: true, description: "Payment method (v1: only 'COD' supported)" },
    },
  },
  {
    name: "get_orders",
    description: "Get Instamart order history and past orders.",
    server: "instamart",
    input: {},
  },
  {
    name: "get_order_details",
    description: "Get detailed information for a specific Instamart order.",
    server: "instamart",
    input: {
      orderId: { type: "string", required: true, description: "Order ID" },
    },
  },
  {
    name: "track_order",
    description: "Track Instamart order status in real-time. PRIMARY TOOL for order tracking.",
    server: "instamart",
    input: {
      orderId: { type: "string", required: true, description: "Order ID" },
    },
  },
  {
    name: "report_error",
    description: "Generate an error report for the Swiggy MCP team.",
    server: "instamart",
    input: {
      errorDescription: { type: "string", required: true, description: "Error description" },
    },
  },

  // ── Dineout MCP (8 tools) ───────────────────────────
  {
    name: "search_restaurants_dineout",
    description: "Search restaurants for TABLE BOOKING or RESERVATIONS. NOT for food delivery.",
    server: "dineout",
    input: {
      locationId: { type: "string", required: true, description: "Saved location/address ID" },
      query: { type: "string", required: false, description: "Search query — cuisine, restaurant name, or area" },
    },
  },
  {
    name: "get_restaurant_details",
    description: "Get details about a specific restaurant for table booking — ratings, deals, timings, address.",
    server: "dineout",
    input: {
      restaurantId: { type: "string", required: true, description: "Restaurant ID" },
    },
  },
  {
    name: "get_saved_locations",
    description: "Get user's saved addresses for restaurant search.",
    server: "dineout",
    input: {},
  },
  {
    name: "get_available_slots",
    description: "Check available time slots for table booking at a restaurant. Returns slots up to 7 days ahead.",
    server: "dineout",
    input: {
      restaurantId: { type: "string", required: true, description: "Restaurant ID" },
      date: { type: "string", required: true, description: "Date in YYYY-MM-DD format" },
      guests: { type: "number", required: true, description: "Number of guests" },
    },
  },
  {
    name: "create_cart",
    description: "Create a cart for table booking or bill payment.",
    server: "dineout",
    input: {
      restaurantId: { type: "string", required: true, description: "Restaurant ID" },
      slotDate: { type: "string", required: true, description: "Date YYYY-MM-DD" },
      slotTime: { type: "string", required: true, description: "Time HH:MM" },
      guests: { type: "number", required: true, description: "Number of guests" },
      billToPay: { type: "number", required: false, description: "Amount to pay (0 for free booking)" },
      skipPayment: { type: "boolean", required: false, description: "Skip payment for free reservations" },
    },
  },
  {
    name: "book_table",
    description: "Book a table at a restaurant for a specific time slot. Only supports FREE reservations.",
    server: "dineout",
    input: {
      cartId: { type: "string", required: true, description: "Cart ID from create_cart" },
      isFree: { type: "boolean", required: true, description: "Must be true for v1" },
      bookingPrice: { type: "number", required: true, description: "Must be 0 for v1" },
    },
  },
  {
    name: "get_booking_status",
    description: "Get booking status and details for a dineout reservation.",
    server: "dineout",
    input: {
      bookingId: { type: "string", required: true, description: "Booking ID" },
    },
  },
  {
    name: "report_error",
    description: "Generate an error report for the Swiggy MCP team.",
    server: "dineout",
    input: {
      errorDescription: { type: "string", required: true, description: "Error description" },
    },
  },
];

/** Index tools by name for fast lookup */
const TOOL_INDEX = new Map<string, McpToolDefinition>(
  ALL_TOOLS.map((t) => [t.name, t]),
);

export function getToolDef(name: string): McpToolDefinition | undefined {
  return TOOL_INDEX.get(name);
}

export function getToolsByServer(server: McpServer): McpToolDefinition[] {
  return ALL_TOOLS.filter((t) => t.server === server);
}

// ─── JSON-RPC helpers ──────────────────────────────────────────────

let _requestId = 1;
function nextId(): number {
  return _requestId++;
}

function jsonRpcRequest(method: string, params?: unknown): JsonRpcRequest {
  return { jsonrpc: "2.0", id: nextId(), method, params };
}

// ─── HTTP transport ────────────────────────────────────────────────

export interface McpClientOptions {
  /** Bearer access token for the user's Swiggy session. null/undefined = unauthenticated. */
  accessToken?: string | null;
  /** Timeout per request in ms (default 15000). */
  timeout?: number;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Call a tool on the specified Swiggy MCP server.
 *
 * Uses the "streamable HTTP" transport: POST JSON-RPC 2.0 to the
 * server endpoint with the Bearer token in the Authorization header.
 *
 * Returns the parsed `result` from the JSON-RPC response.
 * Throws `McpAuthError` on 401 to trigger re-authentication.
 */
export async function callMcpTool<T = unknown>(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {},
  opts: McpClientOptions = {},
): Promise<T> {
  const { accessToken, timeout = 15_000, signal } = opts;
  const url = MCP_SERVER_URLS[server];

  const body: JsonRpcRequest = jsonRpcRequest("tools/call", {
    name: toolName,
    arguments: args,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Link the caller's signal so either source can abort
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new McpError(`Request to ${server} timed out or was cancelled`, 0, 0, server);
    }
    throw new McpError(
      `Network error calling ${MCP_SERVER_LABELS[server]}: ${err instanceof Error ? err.message : String(err)}`,
      0,
      0,
      server,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // — Auth failures trigger re-auth —
  if (response.status === 401) {
    throw new McpAuthError(server);
  }

  // — Other HTTP errors —
  if (!response.ok) {
    let detail = "";
    try {
      const errBody = await response.json();
      detail = errBody?.error?.message ?? JSON.stringify(errBody);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new McpError(
      `${MCP_SERVER_LABELS[server]} returned ${response.status}: ${detail || "Unknown error"}`,
      response.status,
      response.status,
      server,
    );
  }

  // — Parse JSON-RPC response —
  let rpc: JsonRpcResponse<T>;
  try {
    rpc = (await response.json()) as JsonRpcResponse<T>;
  } catch {
    throw new McpError(
      `Invalid JSON-RPC response from ${MCP_SERVER_LABELS[server]}`,
      response.status,
      -32700, // Parse error
      server,
    );
  }

  if (rpc.error) {
    throw new McpError(
      `${MCP_SERVER_LABELS[server]} error: ${rpc.error.message}`,
      response.status,
      rpc.error.code,
      server,
    );
  }

  return rpc.result as T;
}

/**
 * List all available tools on a given MCP server.
 * Useful for discovery and capability introspection.
 */
export async function listMcpTools(
  server: McpServer,
  opts: McpClientOptions = {},
): Promise<McpToolDefinition[]> {
  const url = MCP_SERVER_URLS[server];
  const { accessToken, timeout = 15_000, signal } = opts;

  const body = jsonRpcRequest("tools/list");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  signal?.addEventListener("abort", () => controller.abort(), { once: true });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (response.status === 401) throw new McpAuthError(server);
    if (!response.ok) {
      throw new McpError(
        `Failed to list tools on ${MCP_SERVER_LABELS[server]}: ${response.status}`,
        response.status,
        response.status,
        server,
      );
    }

    const rpc = (await response.json()) as JsonRpcResponse<{ tools: McpToolDefinition[] }>;
    if (rpc.error) {
      throw new McpError(
        rpc.error.message,
        response.status,
        rpc.error.code,
        server,
      );
    }
    return rpc.result?.tools ?? [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── SSE streaming support ─────────────────────────────────────────

export async function* streamingMcpCall(
  server: McpServer,
  toolName: string,
  args: Record<string, unknown> = {},
  opts: { accessToken?: string | null; signal?: AbortSignal } = {},
): AsyncGenerator<unknown, void, unknown> {
  const url = MCP_SERVER_URLS[server];
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (opts.accessToken) headers["Authorization"] = `Bearer ${opts.accessToken}`;

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: nextId(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: opts.signal,
  });

  if (!response.ok) throw new McpError(`Streaming call failed: ${response.status}`, response.status, response.status, server);
  if (!response.body) return;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const json = JSON.parse(line.slice(6));
          if (json.result) yield json.result;
        } catch { /* skip malformed SSE */ }
      }
    }
  }
}

// ─── Legacy compatibility exports ──────────────────────────────────

export const SWIGGY_MCP_ENDPOINTS = MCP_SERVER_URLS;
export type SwiggyMCPService = McpServer;

const clientCache = new Map<string, { endpoint: string; transport: "http" | "sse" }>();

export async function createMCPClient(endpoint: string): Promise<{ endpoint: string; transport: "http" | "sse" }> {
  const existing = clientCache.get(endpoint);
  if (existing) return existing;
  const client = { endpoint, transport: "http" as const };
  clientCache.set(endpoint, client);
  return client;
}

export async function getMCPClient(service: SwiggyMCPService): Promise<{ endpoint: string; transport: "http" | "sse" }> {
  return createMCPClient(MCP_SERVER_URLS[service]);
}

export async function callSwiggyTool(service: SwiggyMCPService, toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
  return callMcpTool(service, toolName, args);
}
