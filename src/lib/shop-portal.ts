/**
 * Resolves where the consumer storefront ("home delivery" portal) lives.
 *
 * The portal is a standalone web app served from the `/shop` route. When a
 * dedicated sub-domain (e.g. shop.yourdomain.com) is connected in project
 * settings, set VITE_SHOP_PORTAL_URL to that origin and every "Order home
 * delivery" button will point at the sub-domain instead of the in-app route.
 */
const CONFIGURED = (import.meta.env.VITE_SHOP_PORTAL_URL as string | undefined)?.trim();

/** Absolute portal origin, or null when the portal is served from this app. */
export function shopPortalOrigin(): string | null {
  if (!CONFIGURED) return null;
  try {
    return new URL(CONFIGURED).origin;
  } catch {
    return null;
  }
}

/** URL to open for the storefront. Relative when no sub-domain is configured. */
export function shopPortalHref(path = "/"): string {
  const origin = shopPortalOrigin();
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return clean === "/" ? "/shop" : clean;
  return `${origin}${clean === "/" ? "" : clean}`;
}

/** True when the current page is being served from the storefront sub-domain. */
export function isPortalHost(): boolean {
  if (typeof window === "undefined") return false;
  const origin = shopPortalOrigin();
  return !!origin && window.location.origin === origin;
}
