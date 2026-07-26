import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Activity,
  Bell,
  Clock,
  Flame,
  IndianRupee,
  PackageCheck,
  ShoppingBasket,
  Sparkles,
  Truck,
  Users,
} from "lucide-react";
import { AgentConsole } from "@/components/lifeos/agent-console";
import { LIFE_MODES, MEMORY_FACTS, type LifeModeId } from "@/lib/lifeos";
import { cn } from "@/lib/utils";
import { getTimeGreeting, getDisplayName } from "@/lib/user-info";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (typeof s.mode === "string" ? s.mode : "student") as LifeModeId,
    oauth: typeof s.oauth === "string" ? s.oauth : undefined,
  }),
  head: () => ({
    meta: [
      { title: "LifeOS Dashboard — meals, groceries, dining on autopilot" },
      {
        name: "description",
        content:
          "AI insights, today's plan, deliveries, pantry status, budget and calorie tracking, reminders and predictive recommendations in one LifeOS dashboard.",
      },
      { property: "og:title", content: "LifeOS Dashboard" },
      {
        property: "og:description",
        content: "Your lifestyle OS: today's plan, pantry, budget, deliveries and AI reminders.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const TIMELINE = [
  { time: "07:20", label: "Pantry checked · eggs low", tone: "instamart" },
  { time: "08:00", label: "Breakfast delivered · Idli + sambar", tone: "food" },
  { time: "13:15", label: "Lunch queued · high-protein bowl", tone: "food" },
  { time: "18:30", label: "Instamart slot · 12 items", tone: "instamart" },
  { time: "20:45", label: "Dineout hold · table for 2", tone: "dineout" },
];

const PANTRY = [
  { item: "Milk", pct: 18 },
  { item: "Eggs", pct: 12 },
  { item: "Atta", pct: 64 },
  { item: "Coffee", pct: 40 },
];

const REMINDERS = [
  "Roommate split pending — ₹62 from Aditya",
  "Gym at 7 AM tomorrow, protein shake auto-added",
  "Anniversary in 9 days — 2 restaurants held",
  "Weekly grocery cap resets Sunday",
];

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  delay = 0,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  sub: string;
  delay?: number;
}) {
  return (
    <div
      className="glass rounded-2xl p-4 animate-rise"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </div>
      <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Card({
  title,
  icon: Icon,
  children,
  className,
  delay = 0,
}: {
  title: string;
  icon: typeof Flame;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={cn("glass rounded-3xl p-5 animate-rise", className)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Dashboard() {
  const { mode, oauth } = Route.useSearch();
  const navigate = useNavigate();
  const active = LIFE_MODES.find((m) => m.id === mode) ?? LIFE_MODES[0];

  const [greeting, setGreeting] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showConnectedBanner, setShowConnectedBanner] = useState(false);

  useEffect(() => {
    setGreeting(getTimeGreeting());
    setDisplayName(getDisplayName());

    // Show connected banner if redirected from OAuth
    if (oauth === "connected") {
      setShowConnectedBanner(true);
      // Clean the param from URL so banner doesn't reappear on refresh
      navigate({ search: { mode }, replace: true });
      const timer = setTimeout(() => setShowConnectedBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [oauth]);

  return (
    <main className="relative min-h-screen px-5 py-8">
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />

      <div className="mx-auto max-w-6xl">
        {/* Connected banner */}
        <div
          className={cn(
            "mb-4 flex items-center gap-3 overflow-hidden rounded-2xl border border-instamart/30 bg-instamart/10 px-4 py-3 text-sm text-instamart transition-all duration-500",
            showConnectedBanner
              ? "max-h-20 translate-y-0 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-4 opacity-0",
          )}
        >
          <Sparkles className="h-4 w-4 shrink-0" />
          <span>
            Swiggy account connected successfully! Your MCP calls will use live data.
          </span>
          <button
            onClick={() => setShowConnectedBanner(false)}
            className="ml-auto shrink-0 rounded-full p-1 transition hover:bg-instamart/20"
            aria-label="Dismiss"
          >
            <span className="text-xs">&times;</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="animate-rise" style={{ animationDelay: "0ms" }}>
            <Link to="/" className="text-xs text-muted-foreground transition hover:text-foreground">
              ← Swiggy LifeOS
            </Link>
            <span className="mx-2 text-xs text-muted-foreground/30">·</span>
            <Link to="/agent" className="text-xs text-accent transition hover:text-foreground">
              Agent Chat
            </Link>
            <h1 className="mt-2 text-3xl font-bold">
              {greeting}, {displayName}. <span className="text-gradient">{active.name} Mode</span>
            </h1>
            <p className="text-sm text-muted-foreground">{active.outcome}</p>
          </div>
          <div
            className="flex flex-wrap gap-1.5 animate-rise"
            style={{ animationDelay: "100ms" }}
          >
            {LIFE_MODES.map((m) => (
              <Link
                key={m.id}
                to="/dashboard"
                search={{ mode: m.id }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  m.id === active.id
                    ? "border-primary bg-primary/15"
                    : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
                )}
              >
                {m.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={IndianRupee} label="Budget left" value="₹4,180" sub="of ₹9,000 · 11 days" delay={120} />
          <Stat icon={Flame} label="Calories today" value="1,420" sub="Protein 96g / 150g" delay={180} />
          <Stat icon={Activity} label="Lifestyle score" value="82" sub="+6 this week" delay={240} />
          <Stat icon={PackageCheck} label="Decisions saved" value="47" sub="this week by LifeOS" delay={300} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Card title="AI insights · today's plan" icon={Sparkles} delay={140}>
              <div className="space-y-2">
                {[
                  "You're ₹320 ahead of pace — I upgraded tonight's dinner pick.",
                  "Eggs and milk hit reorder threshold; slot held for 6:30 PM.",
                  "Gym at 7 AM tomorrow — post-workout meal pre-queued.",
                ].map((t) => (
                  <p
                    key={t}
                    className="rounded-xl border border-border bg-background/40 px-3 py-2.5 text-sm text-muted-foreground"
                  >
                    {t}
                  </p>
                ))}
              </div>
            </Card>

            <AgentConsole compact />

            <div className="grid gap-4 sm:grid-cols-2">
              <Card title="Meal timeline" icon={Clock} delay={200}>
                <ol className="space-y-3">
                  {TIMELINE.map((t) => (
                    <li key={t.time} className="flex items-start gap-3 text-sm">
                      <span className="w-11 shrink-0 text-xs text-muted-foreground">{t.time}</span>
                      <span
                        className={cn(
                          "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                          t.tone === "food" && "bg-food",
                          t.tone === "instamart" && "bg-instamart",
                          t.tone === "dineout" && "bg-dineout",
                        )}
                      />
                      <span className="text-muted-foreground">{t.label}</span>
                    </li>
                  ))}
                </ol>
              </Card>

              <Card title="Grocery status" icon={ShoppingBasket} delay={260}>
                <div className="space-y-3">
                  {PANTRY.map((p) => (
                    <div key={p.item}>
                      <div className="flex justify-between text-xs">
                        <span>{p.item}</span>
                        <span className="text-muted-foreground">{p.pct}%</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            p.pct < 25 ? "bg-destructive" : "bg-instamart",
                          )}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <Card title="Monthly analytics" icon={Activity} delay={320}>
              <div className="flex h-32 items-end gap-1.5">
                {[42, 58, 35, 71, 64, 80, 52, 47, 66, 74, 39, 61].map((v, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-md bg-primary/70 transition hover:bg-primary animate-rise"
                    style={{ height: `${v}%`, animationDelay: `${400 + i * 40}ms` }}
                    title={`Week day ${i + 1}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Food ₹5,120 · Instamart ₹3,240 · Dineout ₹1,460 — 14% under last month.
              </p>
            </Card>
          </div>

          <div className="space-y-4">
            <Card title="Upcoming deliveries" icon={Truck} delay={180}>
              <div className="space-y-2 text-sm">
                {[
                  { t: "Instamart · 12 items", s: "Today 6:30 PM" },
                  { t: "Dinner · Bowl Company", s: "In 28 min" },
                  { t: "Dineout · Toscano", s: "Sat 8:30 PM" },
                ].map((d) => (
                  <div
                    key={d.t}
                    className="flex items-center justify-between rounded-xl border border-border bg-background/40 px-3 py-2.5"
                  >
                    <span>{d.t}</span>
                    <span className="text-xs text-muted-foreground">{d.s}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card title={`${active.name} widgets`} icon={Users} delay={240}>
              <div className="flex flex-wrap gap-2">
                {active.widgets.map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs"
                  >
                    {w}
                  </span>
                ))}
              </div>
            </Card>

            <Card title="Smart reminders" icon={Bell} delay={300}>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {REMINDERS.map((r) => (
                  <li key={r} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {r}
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="AI memory" icon={Sparkles} delay={360}>
              <div className="flex flex-wrap gap-1.5">
                {MEMORY_FACTS.slice(0, 6).map((f) => (
                  <span
                    key={f}
                    className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] text-muted-foreground"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
