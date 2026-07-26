import { useEffect, useRef, useState } from "react";
import { Sparkles, CornerDownLeft, Zap, Loader2 } from "lucide-react";
import { SAMPLE_PROMPTS, type AgentRun, type AgentStep } from "@/lib/lifeos";
import { runAgent } from "@/lib/agent-runner";
import { cn } from "@/lib/utils";

const serverLabel: Record<AgentStep["server"], string> = {
  agent: "LifeOS Agent",
  food: "Food MCP",
  instamart: "Instamart MCP",
  dineout: "Dineout MCP",
};

function stepTone(server: AgentStep["server"]) {
  if (server === "food") return "text-food border-food/30 bg-food/10";
  if (server === "instamart") return "text-instamart border-instamart/30 bg-instamart/10";
  if (server === "dineout") return "text-dineout border-dineout/30 bg-dineout/10";
  return "text-accent border-accent/30 bg-accent/10";
}

export function AgentConsole({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function execute(query: string) {
    if (!query.trim()) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setLoading(true);

    try {
      const next = await runAgent(query);
      setRun(next);
      setRevealed(0);
      setDone(false);
      next.steps.forEach((_, i) => {
        timers.current.push(setTimeout(() => setRevealed(i + 1), 420 * (i + 1)));
      });
      timers.current.push(setTimeout(() => setDone(true), 420 * (next.steps.length + 1)));
    } catch (error) {
      console.error("Agent execution failed:", error);
      setRun({
        intent: "Error",
        plan: "Something went wrong",
        steps: [],
        answer: "Sorry, I encountered an error while processing your request. Please try again.",
      });
      setDone(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={cn("glass rounded-3xl p-5 sm:p-7", !compact && "glow")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
        </span>
        LifeOS Agent · live orchestration
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          execute(input);
        }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-input bg-background/50 px-4 py-3 focus-within:border-primary/60"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Tell LifeOS what you need — “plan this week's groceries”"
          aria-label="Ask the LifeOS agent"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Running...
            </>
          ) : (
            <>
              Run <CornerDownLeft className="h-3 w-3" />
            </>
          )}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.slice(0, compact ? 4 : 6).map((p) => (
          <button
            key={p}
            onClick={() => {
              setInput(p);
              execute(p);
            }}
            disabled={loading}
            className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-45 rounded-2xl border border-border bg-background/40 p-4">
        {!run ? (
          <p className="text-sm text-muted-foreground">
            Ask anything. The agent picks the right Swiggy MCP servers — Food, Instamart, Dineout —
            and chains the tool calls itself.
          </p>
        ) : (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {run.intent} · {run.plan}
            </p>
            <ol className="space-y-2">
              {run.steps.slice(0, revealed).map((s, i) => (
                <li key={i} className="animate-rise flex items-start gap-3 text-sm">
                  <span
                    className={cn(
                      "mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      stepTone(s.server),
                    )}
                  >
                    {serverLabel[s.server]}
                  </span>
                  <span className="min-w-0">
                    <code className="text-xs text-foreground/90">{s.tool}</code>
                    <span className="block text-xs text-muted-foreground">{s.detail}</span>
                  </span>
                </li>
              ))}
            </ol>
            {revealed < run.steps.length && (
              <p className="text-xs text-muted-foreground">orchestrating…</p>
            )}
            {done && (
              <div className="animate-rise flex gap-3 rounded-xl border border-primary/25 bg-primary/10 p-3">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <p className="text-sm leading-relaxed">{run.answer}</p>
              </div>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Connected to live Swiggy MCP servers via JSON-RPC 2.0.
      </p>
    </div>
  );
}
