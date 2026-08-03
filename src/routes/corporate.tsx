import { createFileRoute, redirect } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Legacy corporate landing page — removed; the storefront is now the only home page. */
export const Route = createFileRoute("/corporate")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 301, headers: { Location: "/" } }),
    },
  },
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
