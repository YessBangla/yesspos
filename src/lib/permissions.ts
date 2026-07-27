import type { AppRole } from "@/lib/users.functions";

/** Every navigable feature of the app. */
export const FEATURES = [
  "pos",
  "sales",
  "products",
  "stock-adjustments",
  "labels",
  "purchases",
  "contacts",
  "payments",
  "expenses",
  "catalog",
  "reports",
  "dashboard",
  "users",
  "audit-logs",
  "settings",
  "api-hub",
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
    "stock-adjustments",
    "labels",
    "purchases",
    "contacts",
    "payments",
    "expenses",
    "catalog",
    "reports",
    "dashboard",
  ],
  cashier: ["pos", "sales", "products", "contacts", "payments"],
  staff: ["pos", "products", "labels"],
};

export function canAccess(role: AppRole | null | undefined, feature: Feature) {
  if (!role) return false;
  return ROLE_FEATURES[role]?.includes(feature) ?? false;
}

export function isAdminRole(role: AppRole | null | undefined) {
  return role === "admin" || role === "super_admin";
}
