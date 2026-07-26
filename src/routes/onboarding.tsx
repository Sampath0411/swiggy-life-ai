import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Check, Smartphone, Sparkles } from "lucide-react";
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

function Onboarding() {
  const navigate = useNavigate();
  const [signedIn, setSignedIn] = useState(false);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);

  const finished = signedIn && step >= ONBOARDING.length;
  const recommended = finished ? LIFE_MODES.find((m) => m.id === recommendMode(answers))! : null;

  function choose(i: number) {
    setAnswers((prev) => [...prev, i]);
    setStep((s) => s + 1);
  }

  return (
    <main className="relative min-h-screen px-5 py-10">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
      <div className="mx-auto max-w-2xl">
        <Link to="/" className="text-xs text-muted-foreground transition hover:text-foreground">
          ← Swiggy LifeOS
        </Link>

        {!signedIn ? (
          <div className="animate-rise glass glow mt-8 rounded-3xl p-8">
            <h1 className="text-3xl font-bold">Sign in to begin</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your LifeOS memory is tied to your account so the agent keeps learning.
            </p>
            <div className="mt-7 space-y-3">
              <button
                onClick={() => setSignedIn(true)}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
              >
                Continue with Google
              </button>
              <button
                onClick={() => setSignedIn(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-5 py-3 text-sm font-semibold transition hover:border-primary/50"
              >
                <Smartphone className="h-4 w-4" /> Continue with mobile OTP
              </button>
            </div>
            <p className="mt-5 text-[11px] text-muted-foreground">
              Demo sign-in. Connect Lovable Cloud to enable real Google and OTP authentication.
            </p>
          </div>
        ) : !finished ? (
          <div className="mt-8">
            <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${(step / ONBOARDING.length) * 100}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Question {step + 1} of {ONBOARDING.length}
            </p>

            <div key={step} className="animate-rise glass mt-6 rounded-3xl p-7">
              <div className="flex items-start gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/15">
                  <Sparkles className="h-4 w-4 text-primary" />
                </span>
                <p className="text-lg leading-relaxed">{ONBOARDING[step].ai}</p>
              </div>
              <div className="mt-6 space-y-2">
                {ONBOARDING[step].options.map((o, i) => (
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
        ) : (
          <div className="animate-rise glass glow mt-8 rounded-3xl p-8">
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Assessment complete</p>
            <h1 className="mt-3 text-3xl font-bold">
              LifeOS recommends <span className="text-gradient">{recommended!.name} Mode</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">{recommended!.tagline}</p>
            <ul className="mt-5 space-y-2">
              {recommended!.bullets.map((b) => (
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
                    m.id === recommended!.id
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.name}
                </Link>
              ))}
            </div>

            <button
              onClick={() => navigate({ to: "/dashboard", search: { mode: recommended!.id } })}
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Enter my LifeOS <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
