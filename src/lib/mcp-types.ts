/**
 * Swiggy MCP — complete type definitions for all 35+ tools across
 * Food (14), Instamart (14), and Dineout (8) servers.
 *
 * Based on the official Swiggy Builders Club documentation at
 * https://mcp.swiggy.com/builders/docs/reference/
 */

// ─── Server identifiers ───────────────────────────────────────────

export type McpServer = "food" | "instamart" | "dineout";

export const MCP_SERVER_URLS: Record<McpServer, string> = {
  food: "https://mcp.swiggy.com/food",
  instamart: "https://mcp.swiggy.com/im",
  dineout: "https://mcp.swiggy.com/dineout",
};

export const MCP_SERVER_LABELS: Record<McpServer, string> = {
  food: "Food MCP",
  instamart: "Instamart MCP",
  dineout: "Dineout MCP",
};

// ─── OAuth ─────────────────────────────────────────────────────────

export interface OAuthToken {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  /** Computed at receipt: Date.now() + expires_in * 1000 */
  expires_at: number;
}

export interface OAuthWellKnown {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

export interface ClientRegistration {
  client_id: string;
  client_secret?: string;
  redirect_uris: string[];
  token_endpoint_auth_method: string;
}

// ─── MCP JSON-RPC envelope ─────────────────────────────────────────

export interface JsonRpcRequest<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: T;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number;
  result?: T;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// ─── MCP tool definitions ──────────────────────────────────────────

export interface McpToolDefinition {
  /** The tool name (e.g. "search_restaurants") */
  name: string;
  /** Human-readable description */
  description: string;
  /** Which server this tool lives on */
  server: McpServer;
  /** Input parameters (simplified — key → description + type hint) */
  input: Record<string, { type: string; required: boolean; description: string }>;
}

// ─── Response types (known fields — schemas live on individual tool pages) ──

export interface Address {
  id: string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Restaurant {
  id: string;
  name: string;
  availabilityStatus: "OPEN" | "CLOSED" | "BUSY";
  rating: number;
  ratingCount: number;
  distance: number;
  cuisines: string[];
  costForTwo: number;
  imageUrl?: string;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  isVeg: boolean;
  variants?: MenuItemVariant[];
  addOns?: MenuItemAddOn[];
}

export interface MenuItemVariant {
  id: string;
  name: string;
  price: number;
}

export interface MenuItemAddOn {
  id: string;
  name: string;
  price: number;
  groupName: string;
}

export interface MenuCategory {
  name: string;
  items: MenuItem[];
}

export interface RestaurantMenu {
  restaurantId: string;
  restaurantName: string;
  categories: MenuCategory[];
}

export interface FoodCart {
  restaurantId: string;
  restaurantName: string;
  items: FoodCartItem[];
  total: number;
  validAddons: boolean;
  deliveryCharge?: number;
  packingCharge?: number;
}

export interface FoodCartItem {
  itemId: string;
  name: string;
  quantity: number;
  price: number;
  addOns?: string[];
}

export interface Coupon {
  code: string;
  description: string;
  discount: string;
  requiresOnlinePayment: boolean;
  isApplicable: boolean;
}

export interface FoodOrder {
  orderId: string;
  status: string;
  items: FoodOrderItem[];
  total: number;
  paymentMethod: string;
  createdAt: string;
  estimatedDelivery?: string;
}

export interface FoodOrderItem {
  name: string;
  quantity: number;
  price: number;
}

export interface DeliveryTracking {
  orderId: string;
  status: "PLACED" | "CONFIRMED" | "PREPARING" | "PICKED_UP" | "ON_THE_WAY" | "DELIVERED" | "CANCELLED";
  estimatedDelivery: string;
  deliveryPartner?: {
    name: string;
    phone: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

// ─── Instamart types ───────────────────────────────────────────────

export interface InstamartProduct {
  id: string;
  name: string;
  brand: string;
  imageUrl?: string;
  variants: InstamartProductVariant[];
}

export interface InstamartProductVariant {
  spinId: string;
  name: string;
  packSize: string;
  price: number;
  mrp: number;
  inStock: boolean;
  quantity: number;
}

export interface InstamartCart {
  items: InstamartCartItem[];
  billBreakdown: { label: string; amount: number }[];
  total: number;
  paymentMethods: string[];
  isServiceable: boolean;
  minOrderMet: boolean;
}

export interface InstamartCartItem {
  spinId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
  brand?: string;
}

export interface InstamartOrder {
  orderId: string;
  status: string;
  items: InstamartOrderItem[];
  total: number;
  createdAt: string;
  estimatedDelivery?: string;
}

export interface InstamartOrderItem {
  name: string;
  brand: string;
  quantity: number;
  price: number;
}

// ─── Dineout types ─────────────────────────────────────────────────

export interface DineoutRestaurant {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  cuisines: string[];
  costForTwo: number;
  area: string;
  imageUrl?: string;
  isAvailable: boolean;
}

export interface DineoutRestaurantDetail {
  id: string;
  name: string;
  rating: number;
  ratingCount: number;
  cuisines: string[];
  costForTwo: number;
  address: string;
  timings: string;
  deals: DineoutDeal[];
  images: string[];
}

export interface DineoutDeal {
  title: string;
  description: string;
  discount: string;
  isFree: boolean;
  bookingPrice: number;
}

export interface DineoutSlot {
  date: string;
  time: string;
  isAvailable: boolean;
  slotType: "breakfast" | "lunch" | "dinner";
}

export interface DineoutBooking {
  bookingId: string;
  restaurantName: string;
  date: string;
  time: string;
  guests: number;
  status: "CONFIRMED" | "PENDING" | "CANCELLED" | "COMPLETED";
  dealTitle?: string;
  bookingPrice: number;
}

// ─── Agent orchestration types ─────────────────────────────────────

export type AgentStepServer = McpServer | "agent";

export interface AgentStep {
  server: AgentStepServer;
  tool: string;
  detail: string;
  result?: unknown;
}

export interface AgentRun {
  intent: string;
  plan: string;
  steps: AgentStep[];
  answer: string;
}

// ─── MCP connection state ──────────────────────────────────────────

export interface McpConnectionState {
  isConnected: boolean;
  isConnecting: boolean;
  servers: McpServer[];
  tokenExpiresAt: number | null;
  error: string | null;
}
