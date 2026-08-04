/**
 * Customer delivery area selection.
 *
 * The header chip lets shoppers pick the zone they want delivery in; the zone
 * decides the base delivery charge and the estimated delivery window shown in
 * the cart and at checkout. The choice is persisted in localStorage and
 * broadcast so every mounted component (header chip, cart drawer, checkout)
 * stays in sync.
 */
import { useCallback, useEffect, useState } from "react";

export type DeliveryArea = {
  id: string;
  bn: string;
  en: string;
  /** Base delivery charge in BDT before the free-delivery threshold. */
  fee: number;
  eta_bn: string;
  eta_en: string;
};

export const DELIVERY_AREAS: DeliveryArea[] = [
  { id: "dhanmondi", bn: "ধানমন্ডি", en: "Dhanmondi", fee: 40, eta_bn: "১ ঘণ্টা", eta_en: "1 hour" },
  { id: "gulshan", bn: "গুলশান / বনানী", en: "Gulshan / Banani", fee: 50, eta_bn: "১ ঘণ্টা", eta_en: "1 hour" },
  { id: "mirpur", bn: "মিরপুর", en: "Mirpur", fee: 60, eta_bn: "১–২ ঘণ্টা", eta_en: "1–2 hours" },
  { id: "uttara", bn: "উত্তরা", en: "Uttara", fee: 70, eta_bn: "২ ঘণ্টা", eta_en: "2 hours" },
  { id: "old-dhaka", bn: "পুরান ঢাকা", en: "Old Dhaka", fee: 70, eta_bn: "২ ঘণ্টা", eta_en: "2 hours" },
  { id: "savar", bn: "সাভার / কেরানীগঞ্জ", en: "Savar / Keraniganj", fee: 120, eta_bn: "একই দিনে", eta_en: "Same day" },
  { id: "outside", bn: "ঢাকার বাইরে", en: "Outside Dhaka", fee: 150, eta_bn: "১–২ দিন", eta_en: "1–2 days" },
];

export const DEFAULT_AREA = DELIVERY_AREAS[0];

const KEY = "shop-delivery-area-v1";
const EVENT = "shop-delivery-area-change";

export function areaById(id: string | null | undefined) {
  return DELIVERY_AREAS.find((a) => a.id === id) ?? DEFAULT_AREA;
}

function readArea(): DeliveryArea {
  if (typeof window === "undefined") return DEFAULT_AREA;
  try {
    return areaById(localStorage.getItem(KEY));
  } catch {
    return DEFAULT_AREA;
  }
}

export function useDeliveryArea() {
  const [area, setAreaState] = useState<DeliveryArea>(DEFAULT_AREA);

  useEffect(() => {
    setAreaState(readArea());
    const sync = () => setAreaState(readArea());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setArea = useCallback((next: DeliveryArea) => {
    setAreaState(next);
    try {
      localStorage.setItem(KEY, next.id);
    } catch {
      /* storage blocked — selection stays in memory */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { area, setArea };
}
