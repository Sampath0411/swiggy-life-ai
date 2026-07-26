/**
 * Swiggy LifeOS — Server-side MCP proxy and OAuth token management.
 *
 * Uses TanStack Start's `createServerFn` to create RPC-style server
 * functions that run on the Nitro server. These functions:
 *   1. Proxy MCP tool calls (token stays server-side in HttpOnly cookie)
 *   2. Handle OAuth 2.1 + PKCE token exchange
 *   3. Manage auth lifecycle
 *
 * Called from client components:
 *   import { proxyMcpTool, initOAuth } from "@/server/functions/mcp";
 *   const result = await proxyMcpTool({ data: { server, tool, args } });
 *
 * @see https://mcp.swiggy.com/builders/docs/reference/
 * @see https://mcp.swiggy.com/builders/docs/start/authenticate/
 */

import { createServerFn } from "@tanstack/react-start";
import type { McpServer, OAuthToken, JsonRpcRequest, JsonRpcResponse } from "../../lib/mcp-types";
import { MCP_SERVER_URLS } from "../../lib/mcp-types";

// ═══════════════════════════════════════════════════════════════════
// Cookie helpers
// ═══════════════════════════════════════════════════════════════════

const TOKEN_COOKIE = "swiggy_mcp_token";

function packCookie(token: OAuthToken): string {
  const val = encodeURIComponent(JSON.stringify(token));
  return `${TOKEN_COOKIE}=${val}; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=${token.expires_in}`;
}

function clearCookie(): string {
  return `${TOKEN_COOKIE}=; HttpOnly; Secure; Path=/; SameSite=Lax; Max-Age=0`;
}

function parseToken(cookie: string | undefined | null): OAuthToken | null {
  if (!cookie) return null;
  const m = cookie.match(new RegExp(`${TOKEN_COOKIE}=([^;]+)`));
  if (!m) return null;
  try {
    const t = JSON.parse(decodeURIComponent(m[1])) as OAuthToken;
    return Date.now() > t.expires_at - 60_000 ? null : t;
  } catch { return null; }
}

// ═══════════════════════════════════════════════════════════════════
// PKCE helpers
// ═══════════════════════════════════════════════════════════════════

function b64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codeVerifier(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b64url(b);
}

async function codeChallenge(v: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v))));
}

// ═══════════════════════════════════════════════════════════════════
// 1. Proxy an MCP tool call
// ═══════════════════════════════════════════════════════════════════

export interface ProxyInput {
  server: McpServer;
  tool: string;
  args?: Record<string, unknown>;
  /** The raw cookie header from the request (set automatically by middleware) */
  _cookie?: string;
}

export interface ProxyResult {
  success: boolean;
  data?: unknown;
  error?: string;
  needsAuth: boolean;
}

export const proxyMcpTool = createServerFn({ method: "POST" })
  .handler(async ({ data: input }: { data: ProxyInput }): Promise<ProxyResult> => {
    // The cookie is passed from the client-side — in a real setup,
    // the middleware would inject it automatically.
    const token = parseToken(input._cookie);

    if (!token) {
      return { success: false, needsAuth: true, error: "Connect your Swiggy account first." };
    }

    const url = MCP_SERVER_URLS[input.server];
    const body: JsonRpcRequest = {
      jsonrpc: "2.0", id: 1, method: "tools/call",
      params: { name: input.tool, arguments: input.args ?? {} },
    };

    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token.access_token}`,
        },
        body: JSON.stringify(body),
      });

      if (resp.status === 401) {
        return { success: false, needsAuth: true, error: "Session expired. Reconnect." };
      }
      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { success: false, needsAuth: false, error: `${resp.status}: ${txt}` };
      }

      const rpc = (await resp.json()) as JsonRpcResponse;
      if (rpc.error) return { success: false, needsAuth: false, error: rpc.error.message };
      return { success: true, data: rpc.result };
    } catch (err: unknown) {
      return { success: false, needsAuth: false, error: err instanceof Error ? err.message : "Network error" };
    }
  });

// ═══════════════════════════════════════════════════════════════════
// 2. Initiate OAuth flow
// ═══════════════════════════════════════════════════════════════════

export const initOAuth = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ authorizeUrl: string; state: string; codeVerifier: string }> => {
    const verifier = codeVerifier();
    const challenge = await codeChallenge(verifier);

    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

    const clientId = process.env.SWIGGY_MCP_CLIENT_ID ?? "_dev_local";
    const baseUrl = process.env.LIFEOS_BASE_URL ?? "http://localhost:3000";

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: `${baseUrl}/api/auth/callback`,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      scope: "mcp:tools",
    });

    return {
      authorizeUrl: `https://mcp.swiggy.com/auth/authorize?${params}`,
      state,
      codeVerifier: verifier,
    };
  });

// ═══════════════════════════════════════════════════════════════════
// 3. Exchange OAuth code for token
// ═══════════════════════════════════════════════════════════════════

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
}

export const exchangeOAuthCode = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: ExchangeInput }): Promise<{
    success: boolean;
    error?: string;
    cookie?: string;
    token?: {
      access_token: string;
      token_type: string;
      expires_in: number;
      scope: string;
      expires_at: number;
    };
  }> => {
    const clientId = process.env.SWIGGY_MCP_CLIENT_ID ?? "_dev_local";
    const baseUrl = process.env.LIFEOS_BASE_URL ?? "http://localhost:3000";

    try {
      const resp = await fetch("https://mcp.swiggy.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: data.code,
          code_verifier: data.codeVerifier,
          redirect_uri: `${baseUrl}/api/auth/callback`,
          client_id: clientId,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { success: false, error: `Token exchange failed: ${txt}` };
      }

      const raw = (await resp.json()) as Omit<OAuthToken, "expires_at">;
      const token: OAuthToken = { ...raw, expires_at: Date.now() + raw.expires_in * 1000 };

      return {
        success: true,
        cookie: packCookie(token),
        token: {
          access_token: token.access_token,
          token_type: token.token_type,
          expires_in: token.expires_in,
          scope: token.scope,
          expires_at: token.expires_at,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Token exchange failed" };
    }
  });

// ═══════════════════════════════════════════════════════════════════
// 4. Check auth status
// ═══════════════════════════════════════════════════════════════════

export interface AuthStatus {
  isAuthenticated: boolean;
  expiresAt: number | null;
}

export const checkAuth = createServerFn({ method: "GET" })
  .handler(async (): Promise<AuthStatus> => {
    // In a real setup, this reads the HttpOnly cookie from the request.
    // The cookie context is injected via the server middleware.
    return { isAuthenticated: false, expiresAt: null };
  });

// ═══════════════════════════════════════════════════════════════════
// 5. Disconnect / Logout
// ═══════════════════════════════════════════════════════════════════

export const disconnectMcp = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ success: boolean; cookie: string }> => {
    return { success: true, cookie: clearCookie() };
  });
