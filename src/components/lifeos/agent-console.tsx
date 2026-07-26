/**
 * Swiggy LifeOS — Agent console with MCP integration.
 *
 * When a Swiggy OAuth token is available (via mcp-connect), this
 * makes real calls to Swiggy's Food, Instamart, and Dineout MCP
 * servers. When not authenticated, it falls back to the client-side
 * simulator so the app stays functional during development.
 *
 * Architecture:
 *   User query → classifyIntent() → pick MCP servers/tools →
 *   call via proxyMcpTool() server fn → display orchestration steps
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Sparkles, CornerDownLeft, Zap, Plug, Loader2 } from "lucide-react";
import { runAgent as simulatedRunAgent, SAMPLE_PROMPTS } from "@/lib/lifeos";
import type { AgentRun, AgentStep } from "@/lib/lifeos";
import { cn } from "@/lib/utils";
import { McpConnect, type McpConnectionStatus } from "./mcp-connect";

// ─── Server-side MCP runner ───────────────────────────────────

function getAccessToken(): string | null {
  try {
    const raw = sessionStorage.getItem("swiggy_mcp_token");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.expires_at && Date.now() > parsed.expires_at) {
      sessionStorage.removeItem("swiggy_mcp_token");
      return null;
    }
    return parsed.access_token ?? null;
  } catch {
    return null;
  }
}

async function runRealAgent(query: string): Promise<{ run: AgentRun; real: boolean }> {
  const token = getAccessToken();
  if (!token) {
    const run = simulatedRunAgent(query);
    return { run, real: false };
  }

  try {
    // Use the server-proxied MCP calls to avoid CORS
    const { classifyIntent, resolveArgs } = await import("@/lib/mcp-tools");
    const { proxyMcpToolCall } = await import("@/lib/mcp-server-fn");

    const route = classifyIntent(query);
    const plan = route.plan(query);

    const steps: AgentStep[] = [];
    for (const item of plan.serverChain) {
      if (item.server === "agent") {
        steps.push({ server: "agent", tool: item.tool, detail: (item.args?.detail as string) ?? "Processing…" });
        continue;
      }
      const resolvedArgs = resolveArgs(item.args, query, steps as any);
      const result = await proxyMcpToolCall({
        data: { server: item.server, toolName: item.tool, args: resolvedArgs, accessToken: token },
      });
      (steps as any[]).push({
        server: item.server,
        tool: item.tool,
        detail: result.success ? "✅ Completed" : `⚠️ ${result.error ?? "Failed"}`,
        result: result.result,
      });
    }

    // Generate honest answer based on results
    const successfulSteps = steps.filter(
      (s) => s.server !== "agent" && s.detail && !s.detail.startsWith("⚠️") && !s.detail.startsWith("🔐")
    );
    const hasData = successfulSteps.some((s) => !s.detail.includes("0 ") && s.detail !== "✅ Completed");
    const answer = hasData
      ? successfulSteps.map((s) => s.detail).join(". ") + "."
      : "Connected to Swiggy but didn't find any data. You may need to save a delivery address in your Swiggy account first.";

    return {
      run: { intent: plan.intent, plan: plan.plan, steps, answer },
      real: true,
    };
  } catch {
    const run = simulatedRunAgent(query);
    return { run, real: false };
  }
}

// ─── Step colour coding ─────────────────────────────────────────────

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

// ─── Component ─────────────────────────────────────────────────────

export function AgentConsole({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("");
  const [run, setRun] = useState<AgentRun | null>(null);
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const [isReal, setIsReal] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  const [mcpStatus, setMcpStatus] = useState<McpConnectionStatus>("disconnected");
  const [mcpError, setMcpError] = useState<string | null>(null);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  // ── Detect existing token on mount ──────────────────
  useEffect(() => {
    if (getAccessToken()) {
      setMcpStatus("connected");
    }
  }, []);

  const handleConnect = useCallback(async () => {
    setMcpStatus("connecting");
    setMcpError(null);
    try {
      const { initOAuth } = await import("@/lib/mcp-server-fn");
      const { authorizeUrl, state, codeVerifier } = await initOAuth();
      sessionStorage.setItem("swiggy_oauth_state", state);
      sessionStorage.setItem("swiggy_code_verifier", codeVerifier);
      window.location.href = authorizeUrl;
    } catch (err) {
      setMcpStatus("error");
      setMcpError(err instanceof Error ? err.message : "Failed to initiate connection");
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    try {
      const { disconnectMcp } = await import("@/lib/mcp-server-fn");
      await disconnectMcp();
      sessionStorage.removeItem("swiggy_mcp_token");
      sessionStorage.removeItem("swiggy_oauth_state");
      sessionStorage.removeItem("swiggy_code_verifier");
    } catch { /* ignore */ }
    setMcpStatus("disconnected");
    setMcpError(null);
  }, []);

  async function execute(query: string) {
    if (!query.trim()) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    setIsExecuting(true);
    setRun(null);
    setRevealed(0);
    setDone(false);

    try {
      const { run: agentRun, real } = await runRealAgent(query);
      setRun(agentRun);
      setIsReal(real);

      agentRun.steps.forEach((_, i) => {
        timers.current.push(setTimeout(() => setRevealed(i + 1), 360 * (i + 1)));
      });
      timers.current.push(
        setTimeout(() => { setDone(true); setIsExecuting(false); }, 360 * (agentRun.steps.length + 1)),
      );
    } catch {
      const fallback = simulatedRunAgent(query);
      setRun(fallback);
      setIsReal(false);
      fallback.steps.forEach((_, i) => {
        timers.current.push(setTimeout(() => setRevealed(i + 1), 360 * (i + 1)));
      });
      timers.current.push(
        setTimeout(() => { setDone(true); setIsExecuting(false); }, 360 * (fallback.steps.length + 1)),
      );
    }
  }

  return (
    <div className={cn("glass rounded-3xl p-5 sm:p-7", !compact && "glow")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          LifeOS Agent · {isReal ? "live MCP" : "simulated orchestration"}
        </div>
        <McpConnect status={mcpStatus} onConnect={handleConnect} onDisconnect={handleDisconnect} error={mcpError} compact />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); execute(input); }}
        className="mt-4 flex items-center gap-2 rounded-2xl border border-input bg-background/50 px-4 py-3 focus-within:border-primary/60"
      >
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Tell LifeOS what you need — “plan this week's groceries”"
          aria-label="Ask the LifeOS agent"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
          disabled={isExecuting}
        />
        <button
          type="submit" disabled={isExecuting || !input.trim()}
          className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isExecuting ? <><Loader2 className="h-3 w-3 animate-spin" /> Running</> : <><CornerDownLeft className="h-3 w-3" /> Run</>}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap gap-2">
        {SAMPLE_PROMPTS.slice(0, compact ? 4 : 6).map((p) => (
          <button key={p} onClick={() => { setInput(p); execute(p); }} disabled={isExecuting}
            className="rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
          >
            {p}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-45 rounded-2xl border border-border bg-background/40 p-4">
        {!run ? (
          <p className="text-sm text-muted-foreground">
            Ask anything. The agent picks the right Swiggy MCP servers — Food, Instamart, Dineout — and chains the tool calls itself.
            {mcpStatus !== "connected" && (
              <span className="block mt-2 text-xs text-muted-foreground/70">
                💡 <span className="text-instamart">Connect your Swiggy account</span> above for live MCP calls. Without it, I'll demonstrate the orchestration flow.
              </span>
            )}
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">{run.intent} · {run.plan}</p>
              {isReal && <span className="shrink-0 rounded-full bg-instamart/10 px-2 py-0.5 text-[10px] text-instamart">Live</span>}
            </div>
            <ol className="space-y-2">
              {run.steps.slice(0, revealed).map((s, i) => (
                <li key={i} className="animate-rise flex items-start gap-3 text-sm">
                  <span className={cn("mt-0.5 shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide", stepTone(s.server))}>
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
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> orchestrating…</p>
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

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-muted-foreground">
          {isReal ? "⚡ Live Swiggy MCP calls · Food · Instamart · Dineout" : "⚡ Demo orchestration · connect your Swiggy account for live calls"}
        </p>
        {mcpStatus === "disconnected" && !compact && (
          <button onClick={handleConnect}
            className="flex shrink-0 items-center gap-1 rounded-full border border-instamart/30 bg-instamart/10 px-2.5 py-1 text-[10px] text-instamart transition hover:bg-instamart/20"
          >
            <Plug className="h-3 w-3" /> Connect Swiggy
          </button>
        )}
      </div>
    </div>
  );
}
