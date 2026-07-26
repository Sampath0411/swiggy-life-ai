import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Loader2, Smartphone, Sparkles } from "lucide-react";
import { LIFE_MODES, ONBOARDING, recommendMode } from "@/lib/lifeos";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/onboarding")({
  head: () => ({
    meta: [
      { title: "Lifestyle assessment — Swiggy LifeOS" },
      {
        name: "description",
        content:
          "A two-minute conversation with the LifeOS agent picks the outcome-based membership that fits your life.",
      },
      { property: "og:title", content: "Lifestyle assessment — Swiggy LifeOS" },
      {
        property: "og:description",
        content: "No forms. The AI asks, listens, and recommends your LifeOS mode.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Onboarding,
});

/**
 * Check if a valid Swiggy MCP token exists in sessionStorage.
 */
function hasSwiggyToken(): boolean {
  try {
    const raw = sessionStorage.getItem("swiggy_mcp_token");
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed.access_token && parsed.expires_at && Date.now() < parsed.expires_at);
  } catch {
    return false;
  }
}

type OnboardingStep = "loading" | "signin" | "questions" | "complete";

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<OnboardingStep>("loading");
  const [questionsIdx, setQuestionsIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // On mount, detect if already connected to Swiggy
  useEffect(() => {
    if (hasSwiggyToken()) {
      // Already connected — go straight to dashboard
      navigate({ to: "/dashboard", search: { mode: "student" }, replace: true });
    } else {
      setStep("signin");
    }
  }, [navigate]);

  // Handle OAuth redirect back after Swiggy auth
  // (The callback already redirects to /dashboard, but just in case we land here
  //  with a token, redirect to dashboard)
  useEffect(() => {
    if (step === "signin" && hasSwiggyToken()) {
      navigate({ to: "/dashboard", search: { mode: "student" }, replace: true });
    }
  }, [step, navigate]);

  const finished = questionsIdx >= ONBOARDING.length;
  const recommended = finished ? LIFE_MODES.find((m) => m.id === recommendMode(answers))! : null;

  function choose(i: number) {
    setAnswers((prev) => [...prev, i]);
    setQuestionsIdx((s) => s + 1);
  }

  async function handleMobileOtp() {
    setIsConnecting(true);
    try {
      const { initOAuth } = await import("@/lib/mcp-server-fn");
      const { authorizeUrl, state, codeVerifier } = await initOAuth();
      sessionStorage.setItem("swiggy_oauth_state", state);
      sessionStorage.setItem("swiggy_code_verifier", codeVerifier);
      window.location.href = authorizeUrl;
    } catch (err) {
      console.error("Failed to start OAuth:", err);
      setIsConnecting(false);
    }
  }

  // Loading state
  if (step === "loading") {
    return (
      <main className="relative min-h-screen px-5 py-10">
        <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
        <div className="mx-auto max-w-2xl flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Checking your connection…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen px-5 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-xs text-muted-foreground transition hover:text-foreground">
          ← Swiggy LifeOS
        </Link>

        {step === "signin" ? (
          <div className="animate-rise glass glow mt-8 rounded-3xl p-8">
            <h1 className="text-3xl font-bold">Connect Swiggy to begin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your LifeOS memory is tied to your Swiggy account. Connect with mobile OTP to get started.
            </p>
            <div className="mt-7 space-y-3">
              <button
                onClick={handleMobileOtp}
                disabled={isConnecting}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {isConnecting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Connecting to Swiggy…</>
                ) : (
                  <><Smartphone className="h-4 w-4" /> Continue with mobile OTP</>
                )}
              </button>
            </div>
            <p className="mt-5 text-[11px] text-muted-foreground">
              You'll be redirected to Swiggy to authenticate with your phone number and OTP. Your data stays private.
            </p>

            {/* Separator */}
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or explore the demo</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              onClick={() => setStep("questions")}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-5 py-3 text-sm font-semibold text-muted-foreground transition hover:border-primary/50 hover:text-foreground"
            >
              Try the demo assessment first
            </button>
          </div>
        ) : step === "questions" && !finished ? (
          <div className="mt-8">
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(questionsIdx / ONBOARDING.length) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Question {questionsIdx + 1} of {ONBOARDING.length}
            </p>

            <div key={questionsIdx} className="animate-rise glass mt-6 rounded-3xl p-7">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15">
                  <Sparkles className="h-4 w-4 text-primary" />
                </span>
                <p className="text-lg leading-relaxed">{ONBOARDING[questionsIdx].ai}</p>
              </div>
              <div className="mt-6 space-y-2">
                {ONBOARDING[questionsIdx].options.map((o, i) => (
                  <button
                    key={o}
                    onClick={() => choose(i)}
                    className="group flex w-full items-center justify-between rounded-2xl border border-border bg-background/40 px-4 py-3.5 text-left text-sm transition hover:border-primary/60 hover:bg-primary/10"
                  >
                    {o}
                    <ArrowRight className="h-4 w-4 -translate-x-1 text-primary opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : finished && recommended ? (
          <div className="animate-rise glass glow mt-8 rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Assessment complete</p>
            <h1 className="mt-3 text-3xl font-bold">
              LifeOS recommends <span className="text-gradient">{recommended.name} Mode</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{recommended.tagline}</p>
            <ul className="mt-5 space-y-2">
              {recommended.bullets.map((b) => (
                <li key={b} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {b}
                </li>
              ))}
            </ul>

            <p className="mt-7 text-xs uppercase tracking-widest text-muted-foreground">
              Switch any time
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LIFE_MODES.map((m) => (
                <Link
                  key={m.id}
                  to="/dashboard"
                  search={{ mode: m.id }}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    m.id === recommended.id
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.name}
                </Link>
              ))}
            </div>

            <button
              onClick={() => navigate({ to: "/dashboard", search: { mode: recommended.id } })}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Enter my LifeOS <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
