import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import {
  ArrowRight,
  Brain,
  CalendarClock,
  CheckCircle2,
  Gauge,
  Layers,
  ShoppingBasket,
  UtensilsCrossed,
  Wine,
} from "lucide-react";
import { AgentConsole } from "@/components/lifeos/agent-console";
import { McpConnect, type McpConnectionStatus } from "@/components/lifeos/mcp-connect";
import { LIFE_MODES, MCP_SERVERS, MEMORY_FACTS } from "@/lib/lifeos";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Swiggy LifeOS — Your Life. One AI. Zero Daily Decisions." },
      {
        name: "description",
        content:
          "An AI lifestyle operating system on Swiggy MCP. One agent orchestrates Food, Instamart and Dineout to run your meals, groceries, dining and routines.",
      },
      { property: "og:title", content: "Swiggy LifeOS — Your Life. One AI. Zero Daily Decisions." },
      {
        property: "og:description",
        content:
          "An AI lifestyle operating system on Swiggy MCP. One agent orchestrates Food, Instamart and Dineout to run your meals, groceries, dining and routines.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const mcpIcon = {
  food: UtensilsCrossed,
  instamart: ShoppingBasket,
  dineout: Wine,
} as const;

const WORKFLOWS = [
  {
    name: "Morning Routine",
    steps: ["Check pantry", "Order groceries", "Recommend breakfast"],
  },
  {
    name: "Date Night",
    steps: ["Find restaurants", "Compare ratings", "Reserve table", "Cab reminder"],
  },
  {
    name: "Gym Routine",
    steps: ["Protein meals", "Add supplements", "Schedule lunch"],
  },
  {
    name: "Student Budget Week",
    steps: ["Analyse spend", "Affordable picks", "Split bill", "Order together"],
  },
  {
    name: "Founder Sprint",
    steps: ["Pantry stock", "Office snacks", "Team lunch", "Track expenses"],
  },
];

const DECISIONS = [
  "What's for breakfast?",
  "Did we run out of milk?",
  "Where do we eat tonight?",
  "Am I over budget?",
  "Did I hit my protein?",
  "Who's ordering for the team?",
  "Is the table booked?",
  "What do the kids eat?",
];

function Landing() {
  // ── MCP connection state ────────────────────────────────
  const [mcpStatus, setMcpStatus] = useState<McpConnectionStatus>("disconnected");

  const handleConnect = useCallback(async () => {
    setMcpStatus("connecting");
    try {
      const { initOAuth } = await import("@/server/functions/mcp");
      const { authorizeUrl, state, codeVerifier } = await initOAuth();
      sessionStorage.setItem("swiggy_oauth_state", state);
      sessionStorage.setItem("swiggy_code_verifier", codeVerifier);
      window.location.href = authorizeUrl;
    } catch {
      setMcpStatus("error");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      const { disconnectMcp } = await import("@/server/functions/mcp");
      await disconnectMcp();
    } catch { /* ignore */ }
    setMcpStatus("disconnected");
  }, []);

  return (
    <main className="relative overflow-x-hidden">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg" />

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://cdn.brandfetch.io/ideeTxiKQK/w/480/h/480/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B"
              alt="Swiggy LifeOS"
              className="h-8 w-8 rounded-lg object-cover"
            />
            <span className="font-display text-sm font-semibold tracking-tight">
              Swiggy <span className="text-gradient">LifeOS</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#problem" className="transition hover:text-foreground">Why</a>
            <a href="#modes" className="transition hover:text-foreground">Memberships</a>
            <a href="#mcp" className="transition hover:text-foreground">MCP</a>
            <a href="#demo" className="transition hover:text-foreground">Live demo</a>
          </nav>
          <div className="flex items-center gap-3">
            <McpConnect
              status={mcpStatus}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              compact
            />
            <Link
              to="/onboarding"
              className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-5 pt-20 pb-16 sm:pt-28">
        <div className="animate-rise mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built on Swiggy MCP · Food · Instamart · Dineout
          </span>
          <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] sm:text-7xl">
            Your Life. <span className="text-gradient">One AI.</span>
            <br />
            Zero Daily Decisions.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
            LifeOS is not a food app. It's an intelligent operating system that runs your meals,
            groceries, dining and routines — proactively, across Swiggy's three MCP servers.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to="/onboarding"
              className="animate-pulse-ring inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
            >
              Start lifestyle assessment <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/dashboard"
              search={{ mode: "student" }}

              className="rounded-xl border border-border bg-secondary/40 px-6 py-3 text-sm font-semibold transition hover:border-primary/50"
            >
              See the dashboard
            </Link>
          </div>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-3">
          {(Object.keys(MCP_SERVERS) as (keyof typeof MCP_SERVERS)[]).map((key, i) => {
            const Icon = mcpIcon[key];
            return (
              <div
                key={key}
                className="animate-rise glass rounded-2xl p-5"
                style={{ animationDelay: `${120 * i}ms` }}
              >
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-3 text-base font-semibold">{MCP_SERVERS[key].label}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{MCP_SERVERS[key].blurb}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Decision fatigue */}
      <section id="problem" className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">The problem</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">
              You make 200 food decisions a week. You want to make zero.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Decision fatigue is the real tax of daily life. Discounts don't fix it. Coupons don't
              fix it. An agent that already knows your budget, your allergies, your gym slot and
              your fridge does.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "Memberships priced on outcomes, not free delivery",
                "One agent, three MCP servers, dozens of tools",
                "Proactive — it acts before you ask",
              ].map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="glass overflow-hidden rounded-3xl p-6">
              <div className="grid grid-cols-2 gap-3">
                {DECISIONS.map((d, i) => (
                  <div
                    key={d}
                    className="animate-float rounded-xl border border-border bg-background/50 px-3 py-2 text-xs text-muted-foreground"
                    style={{ animationDelay: `${i * 350}ms` }}
                  >
                    {d}
                  </div>
                ))}
              </div>
              <div className="mt-5 hairline h-px w-full" />
              <div className="mt-5 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                <Brain className="h-5 w-5 text-primary" />
                <p className="text-sm font-medium">LifeOS answers all of them. Before breakfast.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Memberships */}
      <section id="modes" className="mx-auto max-w-6xl px-5 py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-primary">Outcome-based memberships</p>
        <h2 className="mt-3 max-w-2xl text-4xl font-bold sm:text-5xl">
          Six lifestyle modes. Each one solves a specific life problem.
        </h2>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {LIFE_MODES.map((m, i) => (
            <article
              key={m.id}
              className="animate-rise glass group rounded-3xl p-6 transition duration-300 hover:-translate-y-1 hover:border-primary/40"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="text-xl font-semibold">{m.name}</h3>
                <span className="text-xs text-muted-foreground">{m.price}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{m.tagline}</p>
              <p className="mt-3 inline-block rounded-lg border border-accent/30 bg-accent/10 px-2 py-1 text-[11px] font-medium text-accent">
                {m.outcome}
              </p>
              <ul className="mt-4 space-y-2">
                {m.bullets.map((b) => (
                  <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary" />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      {/* Workflows */}
      <section id="mcp" className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-primary">Orchestration engine</p>
            <h2 className="mt-3 text-4xl font-bold sm:text-5xl">
              One sentence in. A chain of MCP tool calls out.
            </h2>
            <p className="mt-4 text-muted-foreground">
              The agent decides which server to hit and in what order — no fixed API sequences.
              Discovery in Food, inventory in Instamart, reservations in Dineout, all in one run.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {[
                { icon: Layers, label: "Multi-server routing" },
                { icon: CalendarClock, label: "Recurring routines" },
                { icon: Gauge, label: "Budget guardrails" },
                { icon: Brain, label: "Persistent memory" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="glass flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm">
                  <Icon className="h-4 w-4 text-primary" /> {label}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {WORKFLOWS.map((w, i) => (
              <div
                key={w.name}
                className="animate-rise glass rounded-2xl p-4"
                style={{ animationDelay: `${i * 90}ms` }}
              >
                <p className="text-sm font-semibold">{w.name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {w.steps.map((s, j) => (
                    <span key={s} className="flex items-center gap-1.5">
                      <span className="rounded-lg border border-border bg-background/50 px-2 py-1 text-xs text-muted-foreground">
                        {s}
                      </span>
                      {j < w.steps.length - 1 && (
                        <ArrowRight className="h-3 w-3 text-primary/70" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live demo */}
      <section id="demo" className="mx-auto max-w-4xl px-5 py-20">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-primary">Live demo</p>
          <h2 className="mt-3 text-4xl font-bold sm:text-5xl">Talk to LifeOS</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Watch the agent choose servers and chain tools in real time.
          </p>
        </div>
        <div className="mt-8">
          <AgentConsole />
        </div>
      </section>

      {/* Memory */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="glass rounded-3xl p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary">AI memory</p>
              <h2 className="mt-2 text-3xl font-bold">It gets sharper every week.</h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Allergies, brands, office timings, workout slots, anniversaries, budgets — remembered
              and applied before you ask.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {MEMORY_FACTS.map((f) => (
              <span
                key={f}
                className="rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <h2 className="text-4xl font-bold">People stopped deciding.</h2>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            {
              q: "I haven't thought about groceries in four months. The pantry just stays full.",
              a: "Ananya R.",
              r: "Family mode",
            },
            {
              q: "It caught me at ₹340 left for the week and quietly switched my dinners. Wild.",
              a: "Rehan K.",
              r: "Student mode",
            },
            {
              q: "Team lunches, pantry, expenses — one agent replaced our office admin spreadsheet.",
              a: "Vikram S.",
              r: "Founder mode",
            },
          ].map((t, i) => (
            <figure
              key={t.a}
              className="animate-rise glass rounded-2xl p-6"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <blockquote className="text-sm leading-relaxed">“{t.q}”</blockquote>
              <figcaption className="mt-4 text-xs text-muted-foreground">
                {t.a} · {t.r}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 pb-24">
        <div className="glass glow rounded-3xl p-10 text-center">
          <h2 className="text-4xl font-bold sm:text-5xl">Stop opening the app when you're hungry.</h2>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground">
            Two minutes of conversation and LifeOS picks the membership that fits your life.
          </p>
          <Link
            to="/onboarding"
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            Begin assessment <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 text-xs text-muted-foreground">
          <p>Swiggy LifeOS — a concept lifestyle OS built on Swiggy MCP.</p>
          <p>Food · Instamart · Dineout · OAuth 2.1 + PKCE ready</p>
        </div>
      </footer>
    </main>
  );
}
