/** Shared delivery-window helpers: labels, cut-off rules and live capacity. */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Slot = { id: string; bn: string; en: string };

/** Chaldal-style delivery windows (ids match delivery_slot_capacity.slot_id). */
export const TIME_SLOTS: Slot[] = [
  { id: "08:00-11:00", bn: "সকাল ৮টা - ১১টা", en: "8:00 AM - 11:00 AM" },
  { id: "11:00-14:00", bn: "সকাল ১১টা - দুপুর ২টা", en: "11:00 AM - 2:00 PM" },
  { id: "14:00-17:00", bn: "দুপুর ২টা - বিকাল ৫টা", en: "2:00 PM - 5:00 PM" },
  { id: "17:00-20:00", bn: "বিকাল ৫টা - রাত ৮টা", en: "5:00 PM - 8:00 PM" },
];

export function nextDays(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** A slot is only bookable if it ends at least 1 hour from now. */
export function slotNotPassed(date: Date | string, slotId: string) {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00`) : new Date(date);
  const [, end] = slotId.split("-");
  const [h, m] = end.split(":").map(Number);
  const endsAt = new Date(d);
  endsAt.setHours(h, m, 0, 0);
  return endsAt.getTime() - Date.now() > 60 * 60 * 1000;
}

export function slotText(slotId: string, bn: boolean) {
  const t = TIME_SLOTS.find((x) => x.id === slotId);
  return t ? (bn ? t.bn : t.en) : slotId;
}

export function slotLabel(day: string, slotId: string, bn: boolean) {
  return `${day} ${slotText(slotId, bn)}`;
}

export type SlotAvailability = {
  slot_id: string;
  capacity: number;
  booked: number;
  available: number;
  is_active: boolean;
};

export async function fetchSlotAvailability(day: string): Promise<SlotAvailability[]> {
  const { data, error } = await supabase.rpc("slot_availability", { _day: day });
  if (error) throw error;
  return (data ?? []) as SlotAvailability[];
}

/** Live capacity for one day — refreshed often so two customers cannot double-book. */
export function useSlotAvailability(day: string, enabled = true) {
  return useQuery({
    queryKey: ["slot-availability", day],
    enabled: enabled && !!day,
    staleTime: 10_000,
    refetchInterval: 30_000,
    queryFn: () => fetchSlotAvailability(day),
  });
}

export type SlotState = {
  slot: Slot;
  available: number;
  capacity: number;
  passed: boolean;
  closed: boolean;
  bookable: boolean;
};

/** Merge the static windows with live counts for a given day. */
export function slotStates(day: string, rows: SlotAvailability[] | undefined): SlotState[] {
  return TIME_SLOTS.map((slot) => {
    const row = rows?.find((r) => r.slot_id === slot.id);
    const capacity = row?.capacity ?? 0;
    const available = row ? row.available : capacity;
    const passed = !slotNotPassed(day, slot.id);
    const closed = row ? !row.is_active : false;
    return {
      slot,
      available,
      capacity,
      passed,
      closed,
      bookable: !passed && !closed && (!row || available > 0),
    };
  });
}

/** First few bookable alternatives across the next days — used on conflicts. */
export async function findAlternatives(fromDay: string, days = 3, limit = 3) {
  const out: { day: string; slotId: string; available: number }[] = [];
  const start = new Date(`${fromDay}T00:00:00`);
  for (let i = 0; i < days && out.length < limit; i += 1) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = dayKey(d);
    let rows: SlotAvailability[] = [];
    try {
      rows = await fetchSlotAvailability(key);
    } catch {
      rows = [];
    }
    for (const s of slotStates(key, rows)) {
      if (s.bookable && out.length < limit) {
        out.push({ day: key, slotId: s.slot.id, available: s.available });
      }
    }
  }
  return out;
}
