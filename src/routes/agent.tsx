/**
 * Swiggy LifeOS — Dedicated Life Agent OS page.
 *
 * Full-page conversational AI chat interface for ordering food,
 * groceries, booking tables, and managing your lifestyle — all
 * through natural conversation with Swiggy MCP.
 *
 * Features:
 *   - Message history with step-by-step MCP orchestration
 *   - Rich order cards with confirm/cancel
 *   - Quick action suggestions in sidebar
 *   - MCP connection status
 *   - Context-aware follow-ups
 */

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bot, ArrowLeft } from "lucide-react";
import { AgentChat } from "@/components/lifeos/agent-chat";

export const Route = createFileRoute("/agent")({
  head: () => ({
    meta: [
      { title: "LifeOS Agent — Your AI Lifestyle Assistant | Swiggy LifeOS" },
      {
        name: "description",
        content:
          "Chat with the LifeOS agent to order food, restock groceries, book restaurant tables, and manage your daily routines — all through natural conversation powered by Swiggy MCP.",
      },
      { property: "og:title", content: "LifeOS Agent — Your AI Lifestyle Assistant" },
      {
        property: "og:description",
        content:
          "Order food, restock groceries, book tables, and manage routines through natural conversation with the LifeOS agent.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AgentPage,
});

function AgentPage() {
  return (
    <main className="flex h-screen flex-col bg-background">
      {/* Aurora + grid background */}
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />
      <div className="pointer-events-none fixed inset-0 -z-10 grid-bg" />

      {/* Minimal top nav */}
      <nav className="flex shrink-0 items-center justify-between border-b border-border/60 bg-background/70 px-5 py-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <img
              src="https://cdn.brandfetch.io/ideeTxiKQK/w/480/h/480/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B"
              alt="Swiggy LifeOS"
              className="h-6 w-6 rounded-lg object-cover"
            />
            <span className="font-display text-sm font-semibold tracking-tight">
              Swiggy <span className="text-gradient">LifeOS</span>
            </span>
          </Link>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Link to="/dashboard" className="transition hover:text-foreground">
            Dashboard
          </Link>
          <Link to="/" className="transition hover:text-foreground">
            Home
          </Link>
          <a
            href="https://mcp.swiggy.com/builders/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:text-foreground"
          >
            MCP Docs
          </a>
        </div>
      </nav>

      {/* Chat area — fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <AgentChat />
      </div>
    </main>
  );
}
