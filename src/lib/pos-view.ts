/**
 * Per-user POS view preferences (category, sort order, tile size).
 *
 * Sellers keep the same desktop layout between sessions, and each signed-in
 * user on a shared counter machine gets their own view, so we key the
 * localStorage entry by the Supabase user id.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TileSize = "small" | "medium" | "large";
export type SortOrder = "name" | "price-asc" | "price-desc" | "stock-desc";

export type PosView = {
  cat: string;
  sort: SortOrder;
  tile: TileSize;
};

export const DEFAULT_POS_VIEW: PosView = { cat: "all", sort: "name", tile: "medium" };

/** Minimum tile width per size — feeds the auto-fit grid so tiles never collapse. */
export const TILE_MIN_WIDTH: Record<TileSize, number> = {
  small: 150,
  medium: 200,
  large: 260,
};

/** Image height per tile size (px). */
export const TILE_IMAGE_HEIGHT: Record<TileSize, number> = {
  small: 96,
  medium: 132,
  large: 176,
};

const PREFIX = "sokoler-pos-view";

function keyFor(userId: string | null) {
  return `${PREFIX}:${userId ?? "anon"}`;
}

function read(userId: string | null): PosView {
  if (typeof localStorage === "undefined") return DEFAULT_POS_VIEW;
  try {
    const raw = localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_POS_VIEW;
    const parsed = JSON.parse(raw) as Partial<PosView>;
    return {
      cat: typeof parsed.cat === "string" ? parsed.cat : DEFAULT_POS_VIEW.cat,
      sort: (["name", "price-asc", "price-desc", "stock-desc"] as SortOrder[]).includes(
        parsed.sort as SortOrder,
      )
        ? (parsed.sort as SortOrder)
        : DEFAULT_POS_VIEW.sort,
      tile: (["small", "medium", "large"] as TileSize[]).includes(parsed.tile as TileSize)
        ? (parsed.tile as TileSize)
        : DEFAULT_POS_VIEW.tile,
    };
  } catch {
    return DEFAULT_POS_VIEW;
  }
}

export function usePosView() {
  const [userId, setUserId] = useState<string | null>(null);
  const [view, setView] = useState<PosView>(DEFAULT_POS_VIEW);

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      const id = data.user?.id ?? null;
      setUserId(id);
      setView(read(id));
    });
    return () => {
      alive = false;
    };
  }, []);

  const update = useCallback(
    (patch: Partial<PosView>) => {
      setView((prev) => {
        const next = { ...prev, ...patch };
        if (typeof localStorage !== "undefined") {
          try {
            localStorage.setItem(keyFor(userId), JSON.stringify(next));
          } catch {
            /* private mode — preferences just won't persist */
          }
        }
        return next;
      });
    },
    [userId],
  );

  return { view, update };
}

export function sortProducts<T extends { name_en: string; price: number | string; stock: number }>(
  rows: T[],
  sort: SortOrder,
): T[] {
  const out = [...rows];
  switch (sort) {
    case "price-asc":
      return out.sort((a, b) => Number(a.price) - Number(b.price));
    case "price-desc":
      return out.sort((a, b) => Number(b.price) - Number(a.price));
    case "stock-desc":
      return out.sort((a, b) => Number(b.stock) - Number(a.stock));
    default:
      return out.sort((a, b) => a.name_en.localeCompare(b.name_en));
  }
}
