import type { AppRole } from "@/lib/users.functions";

/** Every navigable feature of the app. */
export const FEATURES = [
  "pos",
  "sales",
  "products",
  "product-audit",
  "stock-adjustments",
  "labels",
  "purchases",
  "contacts",
  "payments",
  "expenses",
  "catalog",
  "reports",
  "inventory",
  "dashboard",
  "users",
  "audit-logs",
  "data-backup",
  "settings",
  "site-content",
  "media",
  "api-hub",
  "accounts",
  "chart-of-accounts",
  "journal",
  "day-book",
  "financials",
  "party-statement",
  "branches",
  "stock-transfers",
  "stock-count",
  "purchase-orders",
  "assistant",
  "mobile-payments",
  "delivery-orders",
  "commerce",
  "delivery-zones",
  "riders",
  "promotions",
  "reviews",
  "coupons",
  "notifications",
] as const;



export type Feature = (typeof FEATURES)[number];

/** Which features each role can open. Super Admin gets everything. */
export const ROLE_FEATURES: Record<AppRole, readonly Feature[]> = {
  super_admin: FEATURES,
  admin: FEATURES,
  manager: [
    "pos",
    "sales",
    "products",
    "product-audit",
    "media",
    "stock-adjustments",
    "labels",
    "purchases",
    "contacts",
    "payments",
    "expenses",
    "catalog",
    "reports",
    "inventory",
    "dashboard",
    "accounts",
    "day-book",
    "party-statement",
    "financials",
    "stock-transfers",
    "stock-count",
    "purchase-orders",
    "assistant",
    "delivery-orders",
    "commerce",
    "delivery-zones",
    "riders",
    "promotions",
    "reviews",
    "coupons",
    "notifications",
  ],

  cashier: ["pos", "sales", "products", "media", "contacts", "payments", "assistant", "mobile-payments", "delivery-orders", "commerce", "notifications"],
  staff: ["pos", "products", "labels"],
};

export function canAccess(role: AppRole | null | undefined, feature: Feature) {
  if (!role) return false;
  return ROLE_FEATURES[role]?.includes(feature) ?? false;
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "admin" || role === "super_admin";
}

/** Who may upload images, edit tags/alt text or assign product images. */
export function canEditMedia(role: AppRole | null | undefined) {
  return role === "super_admin" || role === "admin" || role === "manager";
}

/** Who may move images to trash, restore them or delete them permanently. */
export function canDeleteMedia(role: AppRole | null | undefined) {
  return role === "super_admin" || role === "admin" || role === "manager";
}

/** Who may see the media audit log (admins only, matching audit_logs access). */
export function canViewMediaLog(role: AppRole | null | undefined) {
  return isAdminRole(role);
}
