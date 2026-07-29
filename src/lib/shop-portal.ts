/**
 * Resolves where the consumer storefront ("home delivery" portal) lives.
 *
 * The portal is served from the in-app `/homedelivery` route. If a dedicated
 * origin is ever needed, set VITE_SHOP_PORTAL_URL and every "Order home
 * delivery" link will point there instead.
 */
const CONFIGURED = (import.meta.env.VITE_SHOP_PORTAL_URL as string | undefined)?.trim();

/** Base path of the storefront inside this app. */
export const SHOP_PORTAL_PATH = "/homedelivery";

/** Absolute portal origin, or null when the portal is served from this app. */
export function shopPortalOrigin(): string | null {
  if (!CONFIGURED) return null;
  try {
    return new URL(CONFIGURED).origin;
  } catch {
    return null;
  }
}

/** URL to open for the storefront. Relative when no external origin is set. */
export function shopPortalHref(path = "/"): string {
  const origin = shopPortalOrigin();
  const clean = path.startsWith("/") ? path : `/${path}`;
  if (!origin) return clean === "/" ? SHOP_PORTAL_PATH : clean;
  return `${origin}${clean === "/" ? "" : clean}`;
}

/** True when the current page is being served from the storefront origin. */
export function isPortalHost(): boolean {
  if (typeof window === "undefined") return false;
  const origin = shopPortalOrigin();
  return !!origin && window.location.origin === origin;
}
