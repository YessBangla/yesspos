import { useMemo } from "react";
import { Bike, CalendarClock, Phone } from "lucide-react";
import { money, num, useI18n } from "@/lib/i18n";

type ScheduleOrder = {
  id: string;
  order_no: number;
  customer_name: string;
  customer_phone: string;
  address: string;
  area: string | null;
  slot: string | null;
  status: string;
  total: number;
  rider_id: string | null;
  created_at: string;
};

type Rider = { id: string; name: string; phone: string; vehicle: string; is_active: boolean };

function isToday(iso: string) {
  const d = new Date(iso);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
  );
}

/** Today's delivery schedule grouped by rider, then by delivery slot. */
export function RiderSchedule({
  orders,
  riders,
  statusText,
}: {
  orders: ScheduleOrder[];
  riders: Rider[];
  statusText: (s: string | null, bn: boolean) => string;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const today = useMemo(() => orders.filter((o) => isToday(o.created_at) && o.status !== "cancelled"), [orders]);

  const groups = useMemo(() => {
    const map = new Map<string, ScheduleOrder[]>();
    for (const o of today) {
      const key = o.rider_id ?? "none";
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    const list = [...map.entries()].map(([riderId, rows]) => {
      const rider = riders.find((r) => r.id === riderId);
      const slots = new Map<string, ScheduleOrder[]>();
      for (const o of rows) {
        const slot = o.slot?.trim() || (bn ? "স্লট নির্ধারিত নয়" : "No slot");
        slots.set(slot, [...(slots.get(slot) ?? []), o]);
      }
      return {
        riderId,
        rider,
        rows,
        value: rows.reduce((s, o) => s + Number(o.total), 0),
        slots: [...slots.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      };
    });
    return list.sort((a, b) => (a.riderId === "none" ? 1 : b.riderId === "none" ? -1 : b.rows.length - a.rows.length));
  }, [today, riders, bn]);

  return (
    <div className="surface-panel mt-3 p-3">
      <p className="mb-2 text-sm font-semibold">
        <CalendarClock className="mr-1 inline size-4 text-primary" />
        {bn ? "আজকের ডেলিভারি শিডিউল (রাইডার অনুযায়ী)" : "Today's delivery schedule (by rider)"}
        <span className="ml-2 text-xs font-normal text-muted-foreground">
          {bn ? `মোট ${num(today.length, lang)} অর্ডার` : `${today.length} orders`}
        </span>
      </p>

      {groups.length === 0 && (
        <p className="text-sm text-muted-foreground">{bn ? "আজকের কোনো অর্ডার নেই।" : "No orders today."}</p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <div key={g.riderId} className="rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1 font-semibold">
                  <Bike className="size-4 text-primary" />
                  {g.rider?.name ?? (bn ? "রাইডার নির্ধারিত নয়" : "Unassigned")}
                </p>
                {g.rider && (
                  <a
                    href={`tel:${g.rider.phone}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                  >
                    <Phone className="size-3" /> {g.rider.phone}
                    <span className="text-muted-foreground">· {g.rider.vehicle}</span>
                  </a>
                )}
              </div>
              <div className="text-right text-xs">
                <p className="font-display text-base font-bold">{num(g.rows.length, lang)}</p>
                <p className="text-muted-foreground">{money(g.value, lang)}</p>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {g.slots.map(([slot, rows]) => (
                <div key={slot}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {slot} · {num(rows.length, lang)}
                  </p>
                  <ul className="mt-1 space-y-1">
                    {rows.map((o) => (
                      <li key={o.id} className="rounded-md bg-muted/50 px-2 py-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold">#{num(o.order_no, lang)}</span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {statusText(o.status, bn)}
                          </span>
                        </div>
                        <p className="truncate text-muted-foreground">
                          {o.customer_name} · {o.area ? `${o.area}, ` : ""}
                          {o.address}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
