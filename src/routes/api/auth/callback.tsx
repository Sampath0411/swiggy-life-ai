/**
 * Swiggy MCP — OAuth 2.1 callback route.
 *
 * Swiggy redirects here after the user authenticates via phone + OTP.
 * This page exchanges the code for a token and stores it client-side.
 *
 * Flow:
 *   1. Read ?code=... from URL params
 *   2. Read codeVerifier from sessionStorage
 *   3. Call the server to exchange the code for an access token
 *   4. Store the token in sessionStorage
 *   5. Redirect to dashboard
 */

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

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
    exchangeCode(code, codeVerifier).then((result) => {
      if (result.success && result.token) {
        setState("success");
        sessionStorage.setItem("swiggy_mcp_token", JSON.stringify(result.token));
        setTimeout(() => {
          window.location.href = "/dashboard?oauth=connected";
        }, 1200);
      } else {
        setState("error");
        setErrorMsg(result.error ?? "Token exchange failed.");
      }
    });
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-5">
      <div className="glass glow max-w-md rounded-3xl p-8 text-center">
        {state === "exchanging" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/15">
              <Loader2 className="h-6 w-6 animate-spin text-accent" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Connecting Swiggy</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Exchanging your authorization code for access…
            </p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-instamart/15">
              <CheckCircle2 className="h-6 w-6 text-instamart" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Connected!</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Redirecting to your LifeOS dashboard…
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/15">
              <XCircle className="h-6 w-6 text-destructive" />
            </div>
            <h1 className="mt-4 text-xl font-bold">Connection failed</h1>
            <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
            <button
              onClick={() => window.location.href = "/"}
              className="mt-6 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Back to LifeOS
            </button>
          </>
        )}
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
    // Call our server function which proxies to Swiggy's MCP token endpoint
    const { exchangeOAuthCode } = await import("@/server/functions/mcp");
    return await exchangeOAuthCode({ data: { code, codeVerifier } });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Network error" };
  }
}
