import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useBranches, useMyBranch, type Branch } from "@/lib/use-branch";
import { useMyRole } from "@/lib/use-my-role";
import { isAdminRole } from "@/lib/permissions";

const KEY = "sherapos.active-branch";
const listeners = new Set<() => void>();

function read(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY);
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Persist the branch the user is currently working in. */
export function setStoredBranchId(id: string | null) {
  if (typeof window === "undefined") return;
  if (id) window.localStorage.setItem(KEY, id);
  else window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

function useStoredBranchId() {
  return useSyncExternalStore(subscribe, read, () => null);
}

/**
 * The branch the user is currently operating in.
 * Admins/super admins may switch between every branch; everyone else is
 * locked to the branch assigned on their profile.
 */
export function useActiveBranch() {
  const me = useMyRole();
  const all = useBranches();
  const mine = useMyBranch();
  const stored = useStoredBranchId();

  const canSwitch = isAdminRole(me.data?.role);

  const options = useMemo<Branch[]>(() => {
    const list = (all.data ?? []).filter((b) => b.is_active);
    if (canSwitch) return list;
    return mine.data ? list.filter((b) => b.id === mine.data!.id) : [];
  }, [all.data, mine.data, canSwitch]);

  const branch =
    (canSwitch ? options.find((b) => b.id === stored) : null) ?? mine.data ?? options[0] ?? null;

  const setBranch = useCallback(
    (id: string) => {
      if (!canSwitch) return;
      setStoredBranchId(id);
    },
    [canSwitch],
  );

  return {
    branch,
    branchId: branch?.id ?? null,
    options,
    canSwitch,
    setBranch,
    isLoading: all.isLoading || mine.isLoading || me.isLoading,
  };
}
