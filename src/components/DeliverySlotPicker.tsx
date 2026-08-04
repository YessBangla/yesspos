/**
 * Compact delivery date + time-window picker used inside the cart drawer.
 *
 * Shown after a delivery area is confirmed; capacity comes live from the
 * database so two shoppers cannot book the same full window.
 */
import { useEffect, useMemo } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { dayKey, nextDays, slotStates, useSlotAvailability } from "@/lib/slots";
import { useI18n } from "@/lib/i18n";

export type SlotChoice = { day: string; slotId: string } | null;

export function DeliverySlotPicker({
  value,
  onChange,
  days = 3,
}: {
  value: SlotChoice;
  onChange: (v: SlotChoice) => void;
  days?: number;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const dayList = useMemo(() => nextDays(days).map(dayKey), [days]);
  const day = value?.day && dayList.includes(value.day) ? value.day : dayList[0];
  const avail = useSlotAvailability(day);
  const states = useMemo(() => slotStates(day, avail.data), [day, avail.data]);

  // Drop a selection that has become unbookable (window passed or sold out).
  useEffect(() => {
    if (!value) return;
    const s = states.find((x) => x.slot.id === value.slotId);
    if (value.day === day && s && !s.bookable) onChange(null);
  }, [states, value, day, onChange]);

  const dayLabel = (key: string, i: number) => {
    if (i === 0) return bn ? "আজ" : "Today";
    if (i === 1) return bn ? "আগামীকাল" : "Tomorrow";
    return new Date(`${key}T00:00:00`).toLocaleDateString(bn ? "bn-BD" : "en-GB", {
      day: "numeric",
      month: "short",
    });
  };

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background p-2.5">
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        <CalendarClock className="size-3.5" />
        {bn ? "ডেলিভারির দিন ও সময়" : "Delivery date & time"}
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="group" aria-label={bn ? "দিন" : "Day"}>
        {dayList.map((k, i) => (
          <button
            key={k}
            type="button"
            aria-pressed={k === day}
            onClick={() => onChange({ day: k, slotId: "" })}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              k === day
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            {dayLabel(k, i)}
          </button>
        ))}
      </div>

      {avail.isLoading ? (
        <p className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          {bn ? "সময় দেখা হচ্ছে…" : "Checking windows…"}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-1.5">
          {states.map((s) => {
            const active = value?.day === day && value.slotId === s.slot.id;
            return (
              <button
                key={s.slot.id}
                type="button"
                disabled={!s.bookable}
                aria-pressed={active}
                onClick={() => onChange({ day, slotId: s.slot.id })}
                className={`rounded-xl border px-2.5 py-2 text-left text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                }`}
              >
                <span className="block leading-tight">{bn ? s.slot.bn : s.slot.en}</span>
                <span className="mt-0.5 block text-[10px] font-medium text-muted-foreground">
                  {s.passed
                    ? bn
                      ? "সময় শেষ"
                      : "Passed"
                    : s.closed || s.available <= 0
                      ? bn
                        ? "পূর্ণ"
                        : "Full"
                      : bn
                        ? `${s.available}টি খালি`
                        : `${s.available} left`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
