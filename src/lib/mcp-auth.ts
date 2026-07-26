/**
 * Swiggy MCP — OAuth 2.1 with PKCE authentication.
 *
 * Implements the full OAuth 2.1 + PKCE flow for Swiggy MCP:
 *   1. Dynamic Client Registration (RFC 7591)
 *   2. PKCE challenge/verifier generation
 *   3. Authorization request with redirect
 *   4. Code exchange for access token
 *   5. Token storage and re-auth on 401
 *
 * @see https://mcp.swiggy.com/builders/docs/start/authenticate/
 */

import { McpAuthError } from "./mcp-client";
import type { McpServer, OAuthToken, OAuthWellKnown, ClientRegistration } from "./mcp-types";

// ─── Configuration ─────────────────────────────────────────────────

const AUTH_BASE = "https://mcp.swiggy.com";

const OAUTH_ENDPOINTS = {
  authorize: `${AUTH_BASE}/auth/authorize`,
  token: `${AUTH_BASE}/auth/token`,
  register: `${AUTH_BASE}/auth/register`,
  logout: `${AUTH_BASE}/auth/logout`,
  wellKnown: `${AUTH_BASE}/.well-known/oauth-authorization-server`,
};

const SCOPES = "mcp:tools mcp:resources mcp:prompts";

// ─── PKCE helpers ──────────────────────────────────────────────────

/**
 * Generate a cryptographic random code verifier (RFC 7636 §4.1).
 * 32 bytes → 43 base64url characters.
 */
export function generateCodeVerifier(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return base64UrlEncode(buffer);
}

/**
 * Derive the S256 code challenge from the verifier (RFC 7636 §4.2).
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(buffer: Uint8Array): string {
  return btoa(String.fromCharCode(...buffer))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// ─── Client registration ───────────────────────────────────────────

/**
 * Dynamically register an OAuth client with Swiggy (RFC 7591).
 * Most MCP-compatible clients do this automatically.
 * Stores the returned client_id for subsequent auth flows.
 */
export async function registerClient(redirectUri: string): Promise<ClientRegistration> {
  const response = await fetch(OAUTH_ENDPOINTS.register, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Swiggy LifeOS",
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: "none", // PKCE — no client secret
      grant_types: ["authorization_code"],
      response_types: ["code"],
      scope: SCOPES,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Client registration failed (${response.status}): ${detail}`);
  }

  return response.json() as Promise<ClientRegistration>;
}

// ─── Authorization URL builder ─────────────────────────────────────

/**
 * Build the OAuth authorization URL to redirect the user to Swiggy's
 * consent page where they authenticate via phone + OTP.
 *
 * Store `state` and `codeVerifier` in the user's session before redirecting.
 */
export function buildAuthorizationUrl(opts: {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    code_challenge: opts.codeChallenge,
    code_challenge_method: "S256",
    state: opts.state,
    scope: SCOPES,
  });
  return `${OAUTH_ENDPOINTS.authorize}?${params.toString()}`;
}

// ─── Token exchange ────────────────────────────────────────────────

/**
 * Exchange the authorization code for an access token (RFC 6749 §4.1.3).
 */
export async function exchangeCode(opts: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
}): Promise<OAuthToken> {
  const response = await fetch(OAUTH_ENDPOINTS.token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code: opts.code,
      code_verifier: opts.codeVerifier,
      redirect_uri: opts.redirectUri,
      client_id: opts.clientId,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Token exchange failed (${response.status}): ${detail}`);
  }

  const token = (await response.json()) as Omit<OAuthToken, "expires_at">;
  return {
    ...token,
    expires_at: Date.now() + token.expires_in * 1000,
  };
}

// ─── Token lifecycle helpers ───────────────────────────────────────

const TOKEN_STORAGE_KEY = "swiggy_mcp_token";

/**
 * Persist the token. In a browser, this stores to sessionStorage.
 * On the server, a different store should be injected.
 */
export function storeToken(token: OAuthToken): void {
  try {
    sessionStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(token));
  } catch {
    // sessionStorage unavailable (SSR) — caller should handle server-side storage
  }
}

/**
 * Retrieve the persisted token, or null if expired / missing.
 */
export function getStoredToken(): OAuthToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    if (!raw) return null;
    const token = JSON.parse(raw) as OAuthToken;
    // Allow 60 s grace before treating as expired
    if (Date.now() > token.expires_at - 60_000) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return null;
    }
    return token;
  } catch {
    return null;
  }
}

/**
 * Clear the stored token (logout / sign-out).
 */
export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Check whether the stored token is still valid (within the grace window).
 */
export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}

// ─── State management for CSRF protection ──────────────────────────

const STATE_KEY = "swiggy_oauth_state";
const VERIFIER_KEY = "swiggy_code_verifier";

export function storeOAuthSession(state: string, codeVerifier: string): void {
  try {
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, codeVerifier);
  } catch {
    // ignore
  }
}

export function consumeOAuthSession(): { state: string; codeVerifier: string } | null {
  try {
    const state = sessionStorage.getItem(STATE_KEY);
    const verifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    if (state && verifier) return { state, codeVerifier: verifier };
    return null;
  } catch {
    return null;
  }
}

// ─── Server-side cookie helpers (for SSR / API routes) ─────────────

/**
 * Serialise the token into an HTTP-only cookie string.
 * Use this on the server side after a successful token exchange.
 */
export function tokenToCookie(token: OAuthToken, maxAge?: number): string {
  const parts = [
    `swiggy_token=${encodeURIComponent(JSON.stringify(token))}`,
    "HttpOnly",
    "Secure",
    "Path=/",
    "SameSite=Lax",
  ];
  const age = maxAge ?? token.expires_in;
  parts.push(`Max-Age=${age}`);
  return parts.join("; ");
}

/**
 * Parse a token from a cookie string.
 */
export function tokenFromCookie(cookie: string): OAuthToken | null {
  const match = cookie.match(/swiggy_token=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(decodeURIComponent(match[1])) as OAuthToken;
  } catch {
    return null;
  }
}
