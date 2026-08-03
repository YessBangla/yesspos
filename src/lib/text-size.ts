import { useCallback, useEffect, useState } from "react";

export const TEXT_SIZES = ["normal", "large", "xlarge"] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

const STORAGE_KEY = "sb-text-size";
const SCALE: Record<TextSize, string> = { normal: "1", large: "1.125", xlarge: "1.25" };

export function applyTextSize(size: TextSize) {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--text-scale", SCALE[size]);
  document.documentElement.dataset.textSize = size;
}

/** Reader-friendly text scaling, remembered on the device. */
export function useTextSize() {
  const [size, setSize] = useState<TextSize>("normal");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as TextSize | null;
    const next = stored && (TEXT_SIZES as readonly string[]).includes(stored) ? stored : "normal";
    setSize(next);
    applyTextSize(next);
  }, []);

  const change = useCallback((next: TextSize) => {
    setSize(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTextSize(next);
  }, []);

  const cycle = useCallback(() => {
    setSize((prev) => {
      const next = TEXT_SIZES[(TEXT_SIZES.indexOf(prev) + 1) % TEXT_SIZES.length];
      window.localStorage.setItem(STORAGE_KEY, next);
      applyTextSize(next);
      return next;
    });
  }, []);

  return { size, change, cycle };
}
