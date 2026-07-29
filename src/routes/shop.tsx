import { createFileRoute, redirect } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/** Legacy storefront path — permanently moved to /homedelivery. */
export const Route = createFileRoute("/shop")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        return new Response(null, {
          status: 301,
          headers: { Location: `/homedelivery${url.search}${url.hash}` },
        });
      },
    },
  },
  beforeLoad: ({ search }) => {
    throw redirect({ to: "/homedelivery", search: search as never, replace: true });
  },
});
