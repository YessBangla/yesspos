import { createFileRoute, redirect } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Legacy storefront path — the home delivery shop is now the site home page ("/"). */
export const Route = createFileRoute("/homedelivery")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        return new Response(null, {
          status: 301,
          headers: { Location: `/${url.search}${url.hash}` },
        });
      },
    },
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/", search: search as never, replace: true });
  },
});
