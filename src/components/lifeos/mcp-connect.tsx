/**
 * Swiggy LifeOS — MCP connection management UI.
 *
 * Shows the connection status to Swiggy MCP servers and allows
 * the user to initiate OAuth or disconnect.
 *
 * When connected, the agent console and dashboard make real MCP
 * calls. When disconnected, they fall back to the simulator.
 */

import { useState, useEffect, useCallback } from "react";
import { Plug, Unplug, Loader2, CheckCircle2, XCircle, ExternalLink, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type McpConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface McpConnectProps {
  /** Current connection status */
  status?: McpConnectionStatus;
  /** Called when the user clicks "Connect" */
  onConnect?: () => void;
  /** Called when the user clicks "Disconnect" */
  onDisconnect?: () => void;
  /** Error message to display */
  error?: string | null;
  /** Token expiry timestamp (epoch ms) or null */
  expiresAt?: number | null;
  /** Compact mode for embedding in nav/header */
  compact?: boolean;
  className?: string;
}

function formatExpiry(expiresAt: number | null): string {
  if (!expiresAt) return "";
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return "Expired";
  const hours = Math.floor(remaining / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function McpConnect({
  status = "disconnected",
  onConnect,
  onDisconnect,
  error = null,
  expiresAt = null,
  compact = false,
  className,
}: McpConnectProps) {
  const [animating, setAnimating] = useState(false);

  const handleConnect = useCallback(() => {
    setAnimating(true);
    onConnect?.();
    // Reset animation after a timeout (in case OAuth redirect takes time)
    setTimeout(() => setAnimating(false), 10_000);
  }, [onConnect]);

  if (compact) {
    return (
      <button
        onClick={status === "connected" ? onDisconnect : handleConnect}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition",
          status === "connected" && "border border-instamart/30 bg-instamart/10 text-instamart",
          status === "connecting" && "border border-accent/30 bg-accent/10 text-accent",
          status === "disconnected" && "border border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
          status === "error" && "border border-destructive/30 bg-destructive/10 text-destructive",
          className,
        )}
        disabled={status === "connecting"}
        title={
          status === "connected"
            ? `Connected · token expires in ${formatExpiry(expiresAt)}`
            : status === "error"
              ? `Error: ${error ?? "Connection failed"}`
              : "Connect to Swiggy MCP"
        }
      >
        {status === "connected" ? (
          <><CheckCircle2 className="h-3 w-3" /> Connected</>
        ) : status === "connecting" ? (
          <><Loader2 className="h-3 w-3 animate-spin" /> Connecting…</>
        ) : status === "error" ? (
          <><XCircle className="h-3 w-3" /> Retry</>
        ) : (
          <><Plug className="h-3 w-3" /> Connect</>
        )}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "glass rounded-2xl p-5 transition",
        status === "connected" && "border-instamart/20",
        status === "error" && "border-destructive/20",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
              status === "connected" && "bg-instamart/15",
              status === "connecting" && "bg-accent/15",
              status === "error" && "bg-destructive/15",
              status === "disconnected" && "bg-secondary",
            )}
          >
            {status === "connected" ? (
              <CheckCircle2 className="h-4 w-4 text-instamart" />
            ) : status === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
            ) : status === "error" ? (
              <XCircle className="h-4 w-4 text-destructive" />
            ) : (
              <Plug className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {status === "connected"
                ? "Swiggy account connected"
                : status === "connecting"
                  ? "Connecting to Swiggy…"
                  : status === "error"
                    ? "Connection failed"
                    : "Connect to Swiggy"}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {status === "connected"
                ? `Token expires in ${formatExpiry(expiresAt)}`
                : status === "connecting"
                  ? "Redirecting to Swiggy for authentication…"
                  : status === "error"
                    ? error ?? "Could not connect to Swiggy MCP"
                    : "Authenticate to make real MCP calls"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          {status === "connected" ? (
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-xs font-medium transition hover:border-destructive/50 hover:text-destructive"
            >
              <LogOut className="h-3 w-3" /> Disconnect
            </button>
          ) : (
            <button
              onClick={handleConnect}
              disabled={status === "connecting" || animating}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "connecting" ? (
                <><Loader2 className="h-3 w-3 animate-spin" /> Connecting</>
              ) : (
                <><ExternalLink className="h-3 w-3" /> Connect</>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Server status list */}
      <div className="mt-4 grid grid-cols-3 gap-2">
        {(["food", "instamart", "dineout"] as const).map((srv) => (
          <div
            key={srv}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs",
              status === "connected"
                ? "bg-instamart/5 text-muted-foreground"
                : "bg-secondary/30 text-muted-foreground/60",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                status === "connected" ? "bg-instamart" : "bg-muted-foreground/30",
              )}
            />
            {srv === "food" ? "Food" : srv === "instamart" ? "Instamart" : "Dineout"}
          </div>
        ))}
      </div>
    </div>
  );
}
