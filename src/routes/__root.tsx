import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Swiggy LifeOS — Your Life. One AI. Zero Daily Decisions." },
      { name: "description", content: "An AI lifestyle operating system on Swiggy MCP. One agent orchestrates Food, Instamart and Dineout to run your meals, groceries, dining and routines." },
      { name: "author", content: "Swiggy LifeOS" },
      { property: "og:title", content: "Swiggy LifeOS — Your Life. One AI. Zero Daily Decisions." },
      { property: "og:description", content: "An AI lifestyle operating system on Swiggy MCP. One agent orchestrates Food, Instamart and Dineout to run your meals, groceries, dining and routines." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Swiggy LifeOS — Your Life. One AI. Zero Daily Decisions." },
      { name: "twitter:description", content: "An AI lifestyle operating system on Swiggy MCP. One agent orchestrates Food, Instamart and Dineout to run your meals, groceries, dining and routines." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4f7d7cf0-8c2f-469d-8151-8481a57dc173" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/4f7d7cf0-8c2f-469d-8151-8481a57dc173" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,700&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function Preloader() {
  const [phase, setPhase] = useState<"loading" | "exiting" | "hidden">("loading");
  const [showLogo, setShowLogo] = useState(false);
  const [showText, setShowText] = useState(false);
  const [loadingText, setLoadingText] = useState("Waking up LifeOS…");

  useEffect(() => {
    // Staggered entrance animation
    const t1 = setTimeout(() => setShowLogo(true), 200);
    const t2 = setTimeout(() => setShowText(true), 500);

    // Cycle through loading messages
    const messages = [
      "Waking up LifeOS…",
      "Connecting Swiggy MCP…",
      "Loading your smart lifestyle…",
      "Almost ready…",
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingText(messages[msgIdx]);
    }, 1200);

    const finish = () => {
      clearInterval(msgInterval);
      setPhase("exiting");
      setTimeout(() => setPhase("hidden"), 600);
    };

    if (document.readyState === "complete") {
      setTimeout(finish, 1000);
    } else {
      const onLoad = () => setTimeout(finish, 1000);
      window.addEventListener("load", onLoad);
      const safety = setTimeout(() => {
        setPhase("exiting");
        setTimeout(() => setPhase("hidden"), 600);
      }, 6000);
      return () => {
        window.removeEventListener("load", onLoad);
        clearTimeout(safety);
        clearInterval(msgInterval);
      };
    }

    return () => {
      clearInterval(msgInterval);
    };
  }, []);

  if (phase === "hidden") return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-8 bg-background will-change-[opacity,transform] transition-all duration-600 ${
        phase === "exiting"
          ? "pointer-events-none scale-[1.03] opacity-0 blur-sm"
          : "opacity-100"
      }`}
    >
      {/* Aurora glow behind */}
      <div className="pointer-events-none fixed inset-0 -z-10 aurora animate-aurora" />

      {/* Animated brand logo with rings */}
      <div
        className={`relative flex items-center justify-center transition-all duration-700 ${
          showLogo ? "scale-100 opacity-100" : "scale-75 opacity-0"
        }`}
      >
        {/* Outer glow */}
        <div className="absolute -inset-10 rounded-full bg-primary/10 blur-3xl animate-pulse" />

        {/* Ring 3 — outermost (counter-clockwise, dashed) */}
        <div
          className="absolute -inset-8 rounded-full border border-dashed border-transparent border-l-primary/30 border-b-accent/20"
          style={{ animation: "spin 3.5s linear infinite reverse" }}
        />

        {/* Ring 2 — middle (clockwise, solid) */}
        <div
          className="absolute -inset-5 rounded-2xl border-2 border-transparent border-t-primary/50 border-r-primary/30"
          style={{ animation: "spin 2s linear infinite" }}
        />

        {/* Ring 1 — inner (counter-clockwise, accent) */}
        <div
          className="absolute -inset-2.5 rounded-xl border border-transparent border-l-accent/40 border-b-accent/25"
          style={{ animation: "spin 1.2s linear infinite reverse" }}
        />

        {/* Logo */}
        <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-background shadow-2xl ring-1 ring-white/10">
          <img
            src="https://cdn.brandfetch.io/ideeTxiKQK/w/480/h/480/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B"
            alt="Swiggy"
            className="h-full w-full object-cover"
          />
        </div>
      </div>

      {/* Brand text — staggered fade in */}
      <div
        className={`flex flex-col items-center gap-3 text-center transition-all duration-500 ${
          showText ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        <span className="font-display text-xl font-semibold tracking-tight">
          Swiggy <span className="text-gradient">LifeOS</span>
        </span>

        {/* Animated loading dots */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
          </span>
          <span key={loadingText} className="animate-rise inline-block">
            {loadingText}
          </span>
        </div>

        {/* Subtle loading bar */}
        <div className="mt-1 h-0.5 w-32 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-primary"
            style={{
              animation: "loadingBar 1.6s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Preloader />
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
