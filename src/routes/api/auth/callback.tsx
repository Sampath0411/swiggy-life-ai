/**
 * Swiggy MCP — OAuth 2.1 callback route.
 *
 * Swiggy redirects here after the user authenticates via phone + OTP.
 * This page exchanges the code for a token, extracts user info from
 * the JWT, and redirects to the dashboard.
 *
 * Flow:
 *   1. Read ?code=... from URL params
 *   2. Read codeVerifier from sessionStorage
 *   3. Call the server to exchange the code for an access token
 *   4. Decode JWT payload to extract user name/phone
 *   5. Store the token + user info in sessionStorage
 *   6. Redirect to dashboard
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { extractUserInfoFromToken, saveUserInfo } from "@/lib/user-info";

export const Route = createFileRoute("/api/auth/callback")({
  component: OAuthCallbackPage,
});

type CallbackState = "exchanging" | "success" | "error";

function OAuthCallbackPage() {
  const [state, setState] = useState<CallbackState>("exchanging");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const stateParam = params.get("state");
    const errorParam = params.get("error");

    if (errorParam) {
      setState("error");
      setErrorMsg(`Swiggy OAuth error: ${errorParam}. Please try again.`);
      return;
    }

    if (!code || !stateParam) {
      setState("error");
      setErrorMsg("Missing OAuth parameters. Please try connecting again.");
      return;
    }

    const storedState = sessionStorage.getItem("swiggy_oauth_state");
    const codeVerifier = sessionStorage.getItem("swiggy_code_verifier");

    if (!storedState || !codeVerifier) {
      setState("error");
      setErrorMsg("Session expired. Please go back and try connecting again.");
      return;
    }

    if (storedState !== stateParam) {
      setState("error");
      setErrorMsg("Security validation failed. Please try connecting again.");
      return;
    }

    // Clean up session storage
    sessionStorage.removeItem("swiggy_oauth_state");
    sessionStorage.removeItem("swiggy_code_verifier");

    // Exchange the code via the server
    // Swiggy docs: authorization code is valid for 120 seconds, single-use
    const exchangePromise = exchangeCode(code, codeVerifier);

    // Timeout: if the exchange hangs for > 30s, show error
    const timeoutPromise = new Promise<ExchangeResult>((_, reject) => {
      setTimeout(() => reject(new Error("Token exchange timed out. Please try again.")), 30_000);
    });

    Promise.race([exchangePromise, timeoutPromise])
      .then((result) => {
        if (result.success && result.token) {
          // Try to extract user info from the JWT token
          const userInfo = extractUserInfoFromToken(result.token.access_token);
          if (userInfo) {
            saveUserInfo(userInfo);
          }

          setState("success");
          sessionStorage.setItem("swiggy_mcp_token", JSON.stringify(result.token));

          // Brief pause so user sees success animation, then redirect
          setTimeout(() => {
            window.location.href = "/dashboard?oauth=connected";
          }, 1800);
        } else {
          setState("error");
          setErrorMsg(result.error ?? "Token exchange failed.");
        }
      })
      .catch((err: Error) => {
        // Catch unexpected errors (network split, dynamic import failure, timeout)
        setState("error");
        setErrorMsg(err.message || "An unexpected error occurred. Please try again.");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      {/* Aurora background */}
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg" />

      {state === "exchanging" && <ExchangingState />}
      {state === "success" && <SuccessState />}
      {state === "error" && <ErrorState errorMsg={errorMsg} />}
    </div>
  );
}

// ─── Exchanging State ───────────────────────────────────────

function ExchangingState() {
  return (
    <div className="flex flex-col items-center gap-8">
      {/* Animated brand rings */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow */}
        <div className="absolute -inset-12 rounded-full bg-primary/10 blur-3xl animate-pulse" />

        {/* Outer spinner ring (counter-clockwise) */}
        <div
          className="absolute -inset-8 rounded-3xl border-2 border-transparent border-l-primary/30 border-b-accent/20"
          style={{ animation: "spin 2.8s linear infinite reverse" }}
        />

        {/* Middle spinner ring (clockwise) */}
        <div
          className="absolute -inset-5 rounded-full border border-transparent border-t-primary/50 border-r-primary/30"
          style={{ animation: "spin 1.8s linear infinite" }}
        />

        {/* Inner ring with dots */}
        <div
          className="absolute -inset-2 rounded-full border border-dashed border-transparent border-t-accent/40"
          style={{ animation: "spin 3.5s linear infinite reverse" }}
        />

        {/* Logo */}
        <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-white/10">
          <img
            src="https://cdn.brandfetch.io/ideeTxiKQK/w/480/h/480/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B"
            alt="Swiggy"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Text */}
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="font-display text-2xl font-semibold tracking-tight">
          Swiggy <span className="text-gradient">LifeOS</span>
        </span>

        {/* Animated dots */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span>Connecting your Swiggy account…</span>
        </div>

        <p className="mt-1 text-xs text-muted-foreground/60">
          Exchanging authorization code for access
        </p>
      </div>

      {/* Loading bar */}
      <div className="h-1 w-48 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
          style={{
            width: "40%",
            animation: "loadingBar 1.8s ease-in-out infinite",
          }}
        />
      </div>
    </div>
  );
}

// ─── Success State ───────────────────────────────────────────

function SuccessState() {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Stagger animations on mount
    const t1 = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(t1);
  }, []);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Success ring animation */}
      <div className="relative flex items-center justify-center">
        {/* Expanding rings */}
        <div
          className={`absolute -inset-10 rounded-full border-2 border-instamart/20 transition-all duration-700 ${
            showContent ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        />
        <div
          className={`absolute -inset-6 rounded-full border border-instamart/30 transition-all delay-150 duration-500 ${
            showContent ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        />

        {/* Check icon with bounce */}
        <div
          className={`relative flex h-20 w-20 items-center justify-center rounded-2xl bg-instamart/15 transition-all duration-500 ${
            showContent ? "scale-100 opacity-100" : "scale-0 opacity-0"
          }`}
        >
          <CheckCircle2 className="h-10 w-10 text-instamart animate-bounce-in" />
        </div>
      </div>

      {/* Success text with stagger */}
      <div className="flex flex-col items-center gap-2 text-center">
        <h1
          className={`font-display text-2xl font-bold transition-all duration-500 delay-200 ${
            showContent ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Swiggy Connected!
        </h1>
        <p
          className={`text-sm text-muted-foreground transition-all duration-500 delay-300 ${
            showContent ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
          }`}
        >
          Your account is linked. Taking you to LifeOS…
        </p>
      </div>
    </div>
  );
}

// ─── Error State ─────────────────────────────────────────────

function ErrorState({ errorMsg }: { errorMsg: string | null }) {
  return (
    <div className="glass glow max-w-md rounded-3xl p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/15">
        <XCircle className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="mt-4 text-xl font-bold">Connection failed</h1>
      <p className="mt-3 text-sm text-muted-foreground">{errorMsg}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={() => window.location.href = "/agent"}
          className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          Try again
        </button>
        <button
          onClick={() => window.location.href = "/"}
          className="rounded-xl border border-border bg-secondary/40 px-5 py-2.5 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          Back home
        </button>
      </div>
    </div>
  );
}

// ─── Server-side token exchange ────────────────────────────────────

interface ExchangeResult {
  success: boolean;
  token?: {
    access_token: string;
    token_type: string;
    expires_in: number;
    scope: string;
    expires_at: number;
  };
  error?: string;
}

async function exchangeCode(code: string, codeVerifier: string): Promise<ExchangeResult> {
  try {
    const mod = await import("@/lib/mcp-server-fn");
    const exchangeFn = mod.exchangeOAuthCode;
    return await exchangeFn({ data: { code, codeVerifier } });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
