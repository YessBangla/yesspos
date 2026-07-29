import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Download, MessageCircle, Search, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money, num, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/audit";
import { buildDueReminder, shareOnSms, shareOnWhatsApp } from "@/lib/share-invoice";

export type DueSale = {
  id: string;
  invoice_no: number;
  customer_name: string | null;
  customer_phone: string | null;
  total: number | string;
  paid: number | string;
  created_at: string;
};

type StatusKey = "unpaid" | "partial";
type AgeKey = "0-7" | "8-30" | "31-60" | "60+";

function ageDays(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function ageBucket(days: number): AgeKey {
  if (days <= 7) return "0-7";
  if (days <= 30) return "8-30";
  if (days <= 60) return "31-60";
  return "60+";
}

export function DueCollection({ sales, shopName }: { sales: DueSale[]; shopName: string }) {
  const { t, lang } = useI18n();
  const L = (bn: string, en: string) => (lang === "bn" ? bn : en);

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | StatusKey>("all");
  const [age, setAge] = useState<"all" | AgeKey>("all");
  const [minDue, setMinDue] = useState("");
  const [sort, setSort] = useState<"due" | "oldest" | "name">("due");
  const [open, setOpen] = useState<string | null>(null);

  const invoices = useMemo(
    () =>
      sales.map((s) => {
        const total = Number(s.total);
        const paid = Number(s.paid);
        const days = ageDays(s.created_at);
        return {
          ...s,
          total,
          paid,
          due: total - paid,
          days,
          bucket: ageBucket(days),
          status: (paid <= 0 ? "unpaid" : "partial") as StatusKey,
          key: (s.customer_phone || s.customer_name || "walkin").trim().toLowerCase(),
        };
      }),
    [sales],
  );

  const filteredInvoices = useMemo(() => {
    const min = Number(minDue) || 0;
    const needle = q.trim().toLowerCase();
    return invoices.filter((i) => {
      if (status !== "all" && i.status !== status) return false;
      if (age !== "all" && i.bucket !== age) return false;
      if (i.due < min) return false;
      if (needle) {
        const hay = `${i.customer_name ?? ""} ${i.customer_phone ?? ""} ${i.invoice_no}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [invoices, status, age, minDue, q]);

  const customers = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        name: string;
        phone: string | null;
        due: number;
        billed: number;
        paid: number;
        oldest: number;
        items: typeof filteredInvoices;
      }
    >();
    for (const i of filteredInvoices) {
      const cur =
        map.get(i.key) ??
        {
          key: i.key,
          name: i.customer_name || L("ওয়াক-ইন", "Walk-in"),
          phone: i.customer_phone,
          due: 0,
          billed: 0,
          paid: 0,
          oldest: 0,
          items: [] as typeof filteredInvoices,
        };
      cur.due += i.due;
      cur.billed += i.total;
      cur.paid += i.paid;
      cur.oldest = Math.max(cur.oldest, i.days);
      cur.phone = cur.phone || i.customer_phone;
      cur.items.push(i);
      map.set(i.key, cur);
    }
    const list = [...map.values()];
    list.forEach((c) => c.items.sort((a, b) => b.days - a.days));
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "oldest") list.sort((a, b) => b.oldest - a.oldest);
    else list.sort((a, b) => b.due - a.due);
    return list;
  }, [filteredInvoices, sort, lang]);

  const totalDue = customers.reduce((s, c) => s + c.due, 0);
  const overdue = filteredInvoices.filter((i) => i.days > 30).reduce((s, i) => s + i.due, 0);
  const collectionRate =
    filteredInvoices.reduce((s, i) => s + i.total, 0) > 0
      ? (filteredInvoices.reduce((s, i) => s + i.paid, 0) / filteredInvoices.reduce((s, i) => s + i.total, 0)) * 100
      : 0;

  const buckets: { key: AgeKey; label: string }[] = [
    { key: "0-7", label: L("০–৭ দিন", "0–7 days") },
    { key: "8-30", label: L("৮–৩০ দিন", "8–30 days") },
    { key: "31-60", label: L("৩১–৬০ দিন", "31–60 days") },
    { key: "60+", label: L("৬০+ দিন", "60+ days") },
  ];

  const bucketTotals = buckets.map((b) => ({
    ...b,
    amount: filteredInvoices.filter((i) => i.bucket === b.key).reduce((s, i) => s + i.due, 0),
    count: filteredInvoices.filter((i) => i.bucket === b.key).length,
  }));

  const exportCustomers = () =>
    downloadCsv(
      `due-by-customer-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        L("গ্রাহক", "Customer"),
        L("ফোন", "Phone"),
        L("চালান", "Invoices"),
        L("মোট বিল", "Billed"),
        t("paid"),
        t("due"),
        L("পুরনো (দিন)", "Oldest (days)"),
      ],
      customers.map((c) => [
        c.name,
        c.phone ?? "",
        c.items.length,
        c.billed.toFixed(2),
        c.paid.toFixed(2),
        c.due.toFixed(2),
        c.oldest,
      ]),
    );

  const reminderFor = (name: string, invoice: number, due: number) =>
    buildDueReminder({ shopName, customer: name, invoice, due }, lang);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card label={L("মোট বকেয়া", "Total due")} value={money(totalDue, lang)} tone="danger" />
        <Card label={L("বকেয়া গ্রাহক", "Customers with due")} value={num(customers.length, lang)} />
        <Card label={L("৩০+ দিনের বকেয়া", "Overdue 30+ days")} value={money(overdue, lang)} tone="danger" />
        <Card label={L("আদায়ের হার", "Collection rate")} value={`${collectionRate.toFixed(1)}%`} tone="primary" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {bucketTotals.map((b) => (
          <button
            key={b.key}
            onClick={() => setAge(age === b.key ? "all" : b.key)}
            className={cn(
              "surface-panel p-3 text-left transition-colors",
              age === b.key && "ring-2 ring-primary",
            )}
          >
            <p className="text-xs uppercase text-muted-foreground">{b.label}</p>
            <p className="font-display text-lg font-bold">{money(b.amount, lang)}</p>
            <p className="text-xs text-muted-foreground">
              {num(b.count, lang)} {t("invoices")}
            </p>
          </button>
        ))}
      </div>

      <div className="surface-panel flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label>{L("খুঁজুন", "Search")}</Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={L("নাম, ফোন বা চালান নম্বর", "Name, phone or invoice no.")}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{L("পেমেন্ট স্ট্যাটাস", "Payment status")}</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব", "All")}</SelectItem>
              <SelectItem value="unpaid">{L("অপরিশোধিত", "Unpaid")}</SelectItem>
              <SelectItem value="partial">{L("আংশিক পরিশোধ", "Partially paid")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{L("বয়স", "Ageing")}</Label>
          <Select value={age} onValueChange={(v) => setAge(v as typeof age)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{L("সব", "All")}</SelectItem>
              {buckets.map((b) => (
                <SelectItem key={b.key} value={b.key}>
                  {b.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{L("সর্বনিম্ন বকেয়া", "Min due")}</Label>
          <Input inputMode="decimal" className="w-28" value={minDue} onChange={(e) => setMinDue(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>{L("সাজান", "Sort by")}</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as typeof sort)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due">{L("বকেয়া (বেশি আগে)", "Due (high first)")}</SelectItem>
              <SelectItem value="oldest">{L("পুরনো আগে", "Oldest first")}</SelectItem>
              <SelectItem value="name">{L("নাম", "Name")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={exportCustomers}>
          <Download className="mr-1 size-4" /> CSV
        </Button>
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{L("গ্রাহক", "Customer")}</th>
              <th className="px-4 py-3">{L("স্ট্যাটাস", "Status")}</th>
              <th className="px-4 py-3 text-right">{t("invoices")}</th>
              <th className="px-4 py-3 text-right">{t("paid")}</th>
              <th className="px-4 py-3 text-right">{t("due")}</th>
              <th className="px-4 py-3 text-right">{L("পুরনো", "Oldest")}</th>
              <th className="px-4 py-3 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => {
              const expanded = open === c.key;
              const allUnpaid = c.items.every((i) => i.status === "unpaid");
              const msg = reminderFor(c.name, Number(c.items[0]?.invoice_no ?? 0), c.due);
              return (
                <Fragment key={c.key}>
                  <tr className="border-b border-border">
                    <td className="px-4 py-3">
                      <button
                        className="flex items-center gap-1 font-medium"
                        onClick={() => setOpen(expanded ? null : c.key)}
                      >
                        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                        <span className="truncate">{c.name}</span>
                      </button>
                      {c.phone && <p className="pl-5 text-xs text-muted-foreground">{c.phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          allUnpaid ? "bg-destructive/10 text-destructive" : "bg-accent/15 text-accent-foreground",
                        )}
                      >
                        {allUnpaid ? L("অপরিশোধিত", "Unpaid") : L("আংশিক পরিশোধ", "Partial")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{num(c.items.length, lang)}</td>
                    <td className="px-4 py-3 text-right">{money(c.paid, lang)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-destructive">{money(c.due, lang)}</td>
                    <td className="px-4 py-3 text-right">
                      {num(c.oldest, lang)} {L("দিন", "d")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => shareOnWhatsApp(c.phone ?? "", msg)}>
                          <MessageCircle className="size-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!c.phone}
                          onClick={() => shareOnSms(c.phone ?? "", msg)}
                        >
                          <Smartphone className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {expanded &&
                    c.items.map((i) => (
                      <tr key={i.id} className="border-b border-border bg-muted/30 text-xs">
                        <td className="px-4 py-2 pl-10">
                          #{num(Number(i.invoice_no), lang)} · {i.created_at.slice(0, 10)}
                        </td>
                        <td className="px-4 py-2">
                          {i.status === "unpaid" ? L("অপরিশোধিত", "Unpaid") : L("আংশিক", "Partial")}
                        </td>
                        <td className="px-4 py-2 text-right">{money(i.total, lang)}</td>
                        <td className="px-4 py-2 text-right">{money(i.paid, lang)}</td>
                        <td className="px-4 py-2 text-right font-medium text-destructive">{money(i.due, lang)}</td>
                        <td className="px-4 py-2 text-right">
                          {num(i.days, lang)} {L("দিন", "d")}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                shareOnWhatsApp(
                                  i.customer_phone ?? c.phone ?? "",
                                  reminderFor(c.name, Number(i.invoice_no), i.due),
                                )
                              }
                            >
                              <MessageCircle className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
            {customers.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: "danger" | "primary" }) {
  return (
    <div className="surface-panel p-4">
      <p className="text-xs uppercase text-muted-foreground">{label}</p>
      <p
        className={cn(
          "font-display text-2xl font-bold",
          tone === "danger" && "text-destructive",
          tone === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}
