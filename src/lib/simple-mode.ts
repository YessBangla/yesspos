import { useCallback, useSyncExternalStore } from "react";

const KEY = "sherapos.simple-mode";
const listeners = new Set<() => void>();

/** Menus shown when simple mode is on — the 7 essentials a small shop needs. */
export const SIMPLE_ROUTES = [
  "/pos",
  "/sales",
  "/products",
  "/stock-adjustments",
  "/contacts",
  "/expenses",
  "/dashboard",
] as const;

function read(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(KEY) === "1";
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Turn the beginner-friendly reduced menu on or off. */
export function setSimpleMode(on: boolean) {
  if (typeof window === "undefined") return;
  if (on) window.localStorage.setItem(KEY, "1");
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function useSimpleMode() {
  const simple = useSyncExternalStore(subscribe, read, () => false);
  const toggle = useCallback(() => setSimpleMode(!read()), []);
  return { simple, setSimple: setSimpleMode, toggle };
}
