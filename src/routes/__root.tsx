import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { registerServiceWorker } from "@/lib/pwa";
import { CareChat } from "@/components/CareChat";

/** Staff dashboard routes where the public Care chat is hidden. */
const DASHBOARD_PATHS = [
  "accounts","api-hub","assistant","audit-logs","branches","catalog","chart-of-accounts","commerce","contacts","coupons","dashboard","data-backup","day-book","delivery-orders","delivery-zones","expenses","financials","inventory","journal","labels","media","mobile-payments","notifications","party-statement","payments","pos","product-audit","products","promotions","purchase-orders","purchases","reports","reviews","riders","sales","settings","site-content","stock-adjustments","stock-count","stock-transfers","users",
].map((r) => `/${r}`);


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
      { name: "theme-color", content: "#0f766e" },

      { title: "Bazar Bari — Shop Billing, Stock & Reports" },
      { name: "description", content: "Bazar Bari is a browser point-of-sale for retail shops: fast billing, automatic stock updates, daily sales reports. Bengali and English." },
      { name: "author", content: "Bazar Bari" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:title", content: "Bazar Bari — Shop Billing, Stock & Reports" },
      { name: "twitter:title", content: "Bazar Bari — Shop Billing, Stock & Reports" },
      { property: "og:description", content: "Bazar Bari is a browser point-of-sale for retail shops: fast billing, automatic stock updates, daily sales reports. Bengali and English." },
      { name: "twitter:description", content: "Bazar Bari is a browser point-of-sale for retail shops: fast billing, automatic stock updates, daily sales reports. Bengali and English." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7aaf6c28-2774-4e90-804e-d7f75381e47e/id-preview-4ca43efd--43fef4c0-9947-45bd-9f85-e8ddb480b1c4.lovable.app-1785148415388.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/7aaf6c28-2774-4e90-804e-d7f75381e47e/id-preview-4ca43efd--43fef4c0-9947-45bd-9f85-e8ddb480b1c4.lovable.app-1785148415388.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=Outfit:wght@500;600;700;800&family=Figtree:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/pwa-192.png" },

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

function AuthSync() {
  const router = useRouter();
  useEffect(() => {
    registerServiceWorker();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
    });
    return () => data.subscription.unsubscribe();
  }, [router]);
  return null;
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const pathname = router.state.location.pathname;
  // Staff dashboard has its own AI assistant page; Care chat is for the public site.
  const showCare = !pathname.startsWith("/auth") && !DASHBOARD_PATHS.some((p: string) => pathname.startsWith(p));

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthSync />
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        {showCare && <CareChat />}
        <Toaster position="top-center" />
      </I18nProvider>
    </QueryClientProvider>
  );
}
