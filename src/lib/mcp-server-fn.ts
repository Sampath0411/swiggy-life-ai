/**
 * Swiggy LifeOS — Server functions for MCP proxy and OAuth.
 *
 * TanStack Start `createServerFn` functions that handle:
 *   1. Proxying MCP tool calls (token stays server-side)
 *   2. OAuth 2.1 + PKCE flow initiation and code exchange
 *   3. Auth lifecycle management (check, disconnect — real Swiggy logout)
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
import type { McpServer, OAuthToken, JsonRpcRequest } from "./mcp-types";
import { MCP_SERVER_URLS } from "./mcp-types";

// ═══════════════════════════════════════════════════════════════════
// 1. Dynamic Client Registration — register with Swiggy MCP
// ═══════════════════════════════════════════════════════════════════

/**
 * RFC 7591 Dynamic Client Registration.
 * Registers this app with Swiggy's MCP OAuth server and gets a client_id.
 * The registration persists server-side, so subsequent calls return the same ID.
 *
 * Per Swiggy docs: "MCP-compatible clients call this registration endpoint
 * transparently — developers never see the step."
 */
let _registeredClientId: string | null = null;

interface DcrResponse {
  client_id: string;
}

async function registerClient(baseUrl: string): Promise<string> {
  if (_registeredClientId) return _registeredClientId;

  const redirectUri = `${baseUrl}/api/auth/callback`;

  const resp = await fetch("https://mcp.swiggy.com/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Swiggy LifeOS Agent",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: "mcp:tools mcp:resources mcp:prompts",
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    throw new Error(`DCR failed (${resp.status}): ${txt}`);
  }

  const body = (await resp.json()) as DcrResponse;
  _registeredClientId = body.client_id;
  return _registeredClientId;
}

// ═══════════════════════════════════════════════════════════════════
// 2. Initiate OAuth flow — returns the Swiggy authorization URL
// ═══════════════════════════════════════════════════════════════════

let _dcrPromise: Promise<string> | null = null;

/**
 * Generate PKCE challenge + Swiggy OAuth URL.
 * Registers the client via DCR first, then builds the authorize URL.
 * Client stores `codeVerifier` in sessionStorage, then redirects.
 *
 * Per Swiggy docs:
 *   - PKCE S256 challenge method is required
 *   - code verifier: 32 random bytes, base64url-encoded
 *   - code challenge: SHA-256 hash, base64url-encoded
 *   - redirect_uri exact-match allowlisted
 */
export const initOAuth = createServerFn({ method: "GET" })
  .handler(async (): Promise<{
    authorizeUrl: string;
    state: string;
    codeVerifier: string;
    clientId: string;
  }> => {
    const verifier = codeVerifierBytes();
    const challenge = await codeChallengeHash(verifier);

    const stateBytes = new Uint8Array(16);
    crypto.getRandomValues(stateBytes);
    const state = Array.from(stateBytes, (b) => b.toString(16).padStart(2, "0")).join("");

    // Use env var, fall back to localhost for dev
    // NOTE: Port fallback — if 8080 is taken, Vite assigns 8081, 8082 etc.
    // In those cases the user must update .env or set the env var at runtime.
    // Swiggy docs: "http://localhost allowed for local development deviates from HTTPS requirement"
    const baseUrl = process.env.LIFEOS_BASE_URL || "http://localhost:3000";

    if (!_dcrPromise) {
      _dcrPromise = registerClient(baseUrl).catch((err) => {
        _dcrPromise = null;
        throw err;
      });
    }
    const clientId = await _dcrPromise;

    const redirectUri = `${baseUrl}/api/auth/callback`;

    const params = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: challenge,
      code_challenge_method: "S256",
      state,
      scope: "mcp:tools",
    });

    return {
      authorizeUrl: `https://mcp.swiggy.com/auth/authorize?${params}`,
      state,
      codeVerifier: verifier,
      clientId,
    };
  });

// ═══════════════════════════════════════════════════════════════════
// 3. Exchange OAuth code for access token
// ═══════════════════════════════════════════════════════════════════

export interface ExchangeInput {
  code: string;
  codeVerifier: string;
}

export interface TokenData {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  /** Epoch ms at which this token expires */
  expires_at: number;
}

/**
 * Exchange the authorization code for an access token.
 *
 * Per Swiggy docs:
 *   - Access token lifetime: 5 days
 *   - Authorization code: 120 seconds, single-use
 *   - The access_token is a "signed JWT"
 *   - Store in "memory or secure storage"
 *   - Track expires_at = now() + expires_in
 *   - Proactively refresh when ≤ 60 seconds remain
 *   - Never log tokens in plaintext
 */
export const exchangeOAuthCode = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: ExchangeInput }): Promise<{
    success: boolean;
    error?: string;
    token?: TokenData;
  }> => {
    const baseUrl = process.env.LIFEOS_BASE_URL || "http://localhost:3000";

    try {
      if (!_registeredClientId) {
        _registeredClientId = await registerClient(baseUrl);
      }

      const resp = await fetch("https://mcp.swiggy.com/auth/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "authorization_code",
          code: data.code,
          code_verifier: data.codeVerifier,
          redirect_uri: `${baseUrl}/api/auth/callback`,
          client_id: _registeredClientId,
        }),
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        return { success: false, error: `Token exchange failed (${resp.status}): ${txt}` };
      }

      const raw = (await resp.json()) as TokenData;
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
// 4. Check auth status (real — reads from provided token info)
// ═══════════════════════════════════════════════════════════════════

/**
 * Check whether a token is still valid.
 * Client sends the token data; server validates the expiry.
 * Uses a 60-second grace window per Swiggy docs recommendation:
 * "proactively refresh when ≤ 60 seconds remain"
 *
 * In production, this would read from an HttpOnly cookie.
 */
export const checkAuth = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { expiresAt: number } }): Promise<{
    isAuthenticated: boolean;
  }> => {
    const { expiresAt } = data;
    // 60-second grace window per Swiggy docs
    const isValid = expiresAt > Date.now() - 60_000;
    return { isAuthenticated: isValid };
  });

// ═══════════════════════════════════════════════════════════════════
// 5. Disconnect / Logout — calls Swiggy's real /auth/logout
// ═══════════════════════════════════════════════════════════════════

/**
 * Disconnect from Swiggy MCP.
 *
 * Per Swiggy docs: POST /auth/logout revokes the current session.
 * We pass the Bearer token to call the logout endpoint, then
 * the client clears sessionStorage on success.
 *
 * Previously this was a no-op — now it properly revokes the token
 * server-side so the session is invalidated at Swiggy too.
 */
export const disconnectMcp = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { accessToken?: string } }): Promise<{
    success: boolean;
    error?: string;
  }> => {
    const { accessToken } = data;

    if (!accessToken) {
      // No token to revoke — consider it disconnected
      return { success: true };
    }

    try {
      const resp = await fetch("https://mcp.swiggy.com/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      });

      if (resp.ok || resp.status === 401) {
        // 401 means token was already invalid — still a success for logout
        return { success: true };
      }

      return { success: false, error: `Logout failed (${resp.status})` };
    } catch (err: unknown) {
      // Network error — still clear locally so user isn't stuck
      return {
        success: true,
        error: err instanceof Error ? `Swiggy logout unreachable: ${err.message}` : undefined,
      };
    }
  });

// ═══════════════════════════════════════════════════════════════════
// 6. Proxy MCP tool calls (server-side, avoids CORS, token stays out of client logs)
// ═══════════════════════════════════════════════════════════════════

const MCP_LABELS: Record<McpServer, string> = {
  food: "Food MCP",
  instamart: "Instamart MCP",
  dineout: "Dineout MCP",
};

/**
 * Proxy an MCP tool call through the server.
 *
 * The browser CANNOT call Swiggy MCP endpoints directly (CORS).
 * This server function does the fetch server-to-server and returns
 * the result — the client only sees the parsed response.
 *
 * Per Swiggy docs:
 *   - Include Bearer token on every request
 *   - Treat 401 as re-auth signal
 *   - Never log tokens in plaintext
 *   - Respect 15s timeout
 */
export const proxyMcpToolCall = createServerFn({ method: "POST" })
  .handler(async ({ data }: {
    data: {
      server: McpServer;
      toolName: string;
      args: Record<string, unknown>;
      accessToken?: string;
    };
  }): Promise<{
    success: boolean;
    result?: unknown;
    error?: string;
    authError?: boolean;
    status?: number;
  }> => {
    const { server, toolName, args, accessToken } = data;
    const url = MCP_SERVER_URLS[server];

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: toolName, arguments: args },
        } as JsonRpcRequest),
        signal: AbortSignal.timeout(15_000),
      });

      // Per Swiggy docs: 401 means re-authenticate
      if (response.status === 401) {
        return { success: false, authError: true, error: "Token expired. Please reconnect Swiggy.", status: 401 };
      }

      if (!response.ok) {
        let detail = "";
        try {
          const errBody = await response.json();
          detail = errBody?.error?.message ?? JSON.stringify(errBody);
        } catch {
          detail = await response.text().catch(() => "");
        }
        return { success: false, error: `${MCP_LABELS[server]} returned ${response.status}: ${detail}`, status: response.status };
      }

      const rpc = await response.json() as { result?: unknown; error?: { message: string; code: number } };
      if (rpc.error) {
        return { success: false, error: `${MCP_LABELS[server]} error: ${rpc.error.message}` };
      }

      return { success: true, result: rpc.result };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "TimeoutError") {
        return { success: false, error: `${MCP_LABELS[server]} timed out` };
      }
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

// ═══════════════════════════════════════════════════════════════════
// PKCE helpers (RFC 7636)
// ═══════════════════════════════════════════════════════════════════

function b64url(b: Uint8Array): string {
  return btoa(String.fromCharCode(...b))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function codeVerifierBytes(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b64url(b);
}

async function codeChallengeHash(verifier: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(hash));
}
