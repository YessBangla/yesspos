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
  ],

  cashier: ["pos", "sales", "products", "media", "contacts", "payments", "assistant", "mobile-payments", "delivery-orders", "commerce"],
  staff: ["pos", "products", "labels"],
};

export function canAccess(role: AppRole | null | undefined, feature: Feature) {
  if (!role) return false;
  return ROLE_FEATURES[role]?.includes(feature) ?? false;
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "admin" || role === "super_admin";
}
