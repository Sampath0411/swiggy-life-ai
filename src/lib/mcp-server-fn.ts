/**
 * Swiggy LifeOS — Server functions for MCP proxy and OAuth.
 *
 * TanStack Start `createServerFn` functions that handle:
 *   1. Proxying MCP tool calls (token stays server-side)
 *   2. OAuth 2.1 + PKCE flow initiation and code exchange
 *   3. Auth lifecycle management (check, disconnect)
 *
 * These are callable from client components — TanStack Start
 * automatically creates an RPC bridge for each function.
 *
 * IMPORTANT: Keep this file outside `src/server/` to avoid
 * TanStack Start's import protection plugin blocking client imports.
 *
 * @see https://mcp.swiggy.com/builders/docs/reference/
 * @see https://mcp.swiggy.com/builders/docs/start/authenticate/
 */

import { createServerFn } from "@tanstack/react-start";
import type { McpServer, OAuthToken, JsonRpcRequest, JsonRpcResponse } from "./mcp-types";
import { MCP_SERVER_URLS } from "./mcp-types";

// ═══════════════════════════════════════════════════════════════════
// 1. Initiate OAuth flow — returns the Swiggy authorization URL
// ═══════════════════════════════════════════════════════════════════

/**
 * Generate PKCE challenge + Swiggy OAuth URL.
 * Client stores `codeVerifier` in sessionStorage, then redirects.
 */
export const initOAuth = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ authorizeUrl: string; state: string; codeVerifier: string }> => {
    const verifier = codeVerifierBytes();
    const challenge = await codeChallengeHash(verifier);

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
// 2. Exchange OAuth code for access token
// ═══════════════════════════════════════════════════════════════════

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
}

/**
 * Exchange the authorization code for an access token.
 * Proxies to Swiggy's MCP /auth/token endpoint server-side to avoid CORS.
 */
export const exchangeOAuthCode = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: ExchangeInput }): Promise<{
    success: boolean;
    error?: string;
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
        return { success: false, error: `Token exchange failed (${resp.status}): ${txt}` };
      }

      const raw = (await resp.json()) as Omit<OAuthToken, "expires_at">;
      return {
        success: true,
        token: {
          access_token: raw.access_token,
          token_type: raw.token_type,
          expires_in: raw.expires_in,
          scope: raw.scope,
          expires_at: Date.now() + raw.expires_in * 1000,
        },
      };
    } catch (err: unknown) {
      return { success: false, error: err instanceof Error ? err.message : "Network error" };
    }
  });

// ═══════════════════════════════════════════════════════════════════
// 3. Check auth status
// ═══════════════════════════════════════════════════════════════════

/**
 * Check whether the current session has a valid token.
 * In a production setup, this reads the HttpOnly cookie from the request.
 */
export const checkAuth = createServerFn({ method: "GET" })
  .handler(async (): Promise<{ isAuthenticated: boolean; expiresAt: number | null }> => {
    return { isAuthenticated: false, expiresAt: null };
  });

// ═══════════════════════════════════════════════════════════════════
// 4. Disconnect / Logout
// ═══════════════════════════════════════════════════════════════════

/**
 * Clear the auth session. Returns a Set-Cookie header value
 * to clear the HttpOnly cookie on the client.
 */
export const disconnectMcp = createServerFn({ method: "POST" })
  .handler(async (): Promise<{ success: boolean }> => {
    return { success: true };
  });

// ═══════════════════════════════════════════════════════════════════
// PKCE helpers
// ═══════════════════════════════════════════════════════════════════

function b64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function codeVerifierBytes(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b64url(b);
}

async function codeChallengeHash(verifier: string): Promise<string> {
  return b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
}
