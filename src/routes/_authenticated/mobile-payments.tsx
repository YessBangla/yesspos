import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import { CheckCircle2, Copy, MessageCircle, QrCode, RefreshCw, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { shareOnSms, shareOnWhatsApp } from "@/lib/share-invoice";
import {
  GATEWAYS,
  buildPaymentNote,
  buildPaymentRef,
  buildPushMessage,
  buildQrPayload,
  gatewayById,
  invoiceFromRef,
  parsePaymentNote,
  type GatewayId,
} from "@/lib/mobile-pay";

export const Route = createFileRoute("/_authenticated/mobile-payments")({
  head: () => ({
    meta: [
      { title: "Mobile payments & reconciliation — Bazar Bari" },
      {
        name: "description",
        content: "Collect bKash, Nagad, Rocket, Upay and SSLCommerz payments by QR or push request and reconcile them against invoices.",
      },
      { property: "og:title", content: "Mobile payments & reconciliation — Bazar Bari" },
      { property: "og:description", content: "QR and push mobile money collection with automatic reconciliation." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MobilePaymentsPage,
});

function MobilePaymentsPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const queryClient = useQueryClient();

  const [gateway, setGateway] = useState<GatewayId>("bkash");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [reference, setReference] = useState(() => buildPaymentRef());
  const [trxId, setTrxId] = useState("");
  const [qr, setQr] = useState("");

  const shop = useQuery({
    queryKey: ["business-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("business_settings").select("shop_name").limit(1).maybeSingle();
      return data;
    },
  });

  const gatewaySettings = useQuery({
    queryKey: ["api-settings-payment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("api_settings").select("provider,label,enabled,sender_id,base_url,extra");
      if (error) throw error;
      return data;
    },
  });

  const dueSales = useQuery({
    queryKey: ["mobile-pay-due-sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,invoice_no,customer_name,customer_phone,total,paid,created_at")
        .eq("status", "final")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).filter((s) => Number(s.total) - Number(s.paid) > 0.5);
    },
  });

  const gatewayPayments = useQuery({
    queryKey: ["mobile-pay-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id,amount,method,note,paid_on,direction,sale_id")
        .order("paid_on", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []).filter((p) => GATEWAYS.some((g) => g.id === p.method));
    },
  });

  /** Merchant number configured for the gateway in API Hub (falls back to sender id / extra). */
  const merchantNumber = useMemo(() => {
    const row = gatewaySettings.data?.find((r) => r.provider === gateway);
    const extra = (row?.extra ?? {}) as Record<string, unknown>;
    return (
      (typeof extra.merchant_number === "string" ? extra.merchant_number : "") ||
      row?.sender_id ||
      ""
    );
  }, [gatewaySettings.data, gateway]);

  const baseUrl = gatewaySettings.data?.find((r) => r.provider === gateway)?.base_url ?? undefined;
  const gatewayEnabled = gatewaySettings.data?.find((r) => r.provider === gateway)?.enabled ?? false;
  const amountNum = Number(amount) || 0;
  const g = gatewayById(gateway)!;
  const shopName = shop.data?.shop_name ?? "Bazar Bari";

  const payload = useMemo(
    () =>
      merchantNumber && amountNum > 0
        ? buildQrPayload({ gateway, merchantNumber, amount: amountNum, reference, baseUrl: baseUrl ?? undefined })
        : "",
    [gateway, merchantNumber, amountNum, reference, baseUrl],
  );

  useEffect(() => {
    let alive = true;
    if (!payload) {
      setQr("");
      return;
    }
    void QRCode.toDataURL(payload, { width: 320, margin: 1 }).then((url) => {
      if (alive) setQr(url);
    });
    return () => {
      alive = false;
    };
  }, [payload]);

  const message = buildPushMessage({
    lang: bn ? "bn" : "en",
    shopName,
    gatewayLabel: bn ? g.labelBn : g.label,
    merchantNumber: merchantNumber || "—",
    amount: amountNum,
    reference,
    invoiceNo: invoiceNo ? Number(invoiceNo) : null,
  });

  const record = useMutation({
    mutationFn: async () => {
      if (amountNum <= 0) throw new Error(bn ? "টাকার অঙ্ক দিন" : "Enter an amount");
      if (!trxId.trim()) throw new Error(bn ? "ট্রানজেকশন আইডি দিন" : "Enter the transaction ID");
      const sale = dueSales.data?.find((s) => String(s.invoice_no) === invoiceNo.trim());
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("payments").insert({
        direction: "in",
        amount: amountNum,
        method: gateway,
        note: buildPaymentNote(reference, trxId.trim()),
        sale_id: sale?.id ?? null,
        user_id: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void logAudit("payment", { entity: "mobile_payment", details: `${gateway} ${reference}` });
      toast.success(bn ? "পেমেন্ট রেকর্ড হয়েছে" : "Payment recorded");
      setTrxId("");
      setReference(buildPaymentRef(invoiceNo ? Number(invoiceNo) : null));
      queryClient.invalidateQueries({ queryKey: ["mobile-pay-payments"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  /** Auto reconciliation: match each gateway payment to an invoice by reference, sale link or exact amount. */
  const reconciliation = useMemo(() => {
    const sales = dueSales.data ?? [];
    return (gatewayPayments.data ?? []).map((p) => {
      const { ref, trx } = parsePaymentNote(p.note);
      const refInvoice = invoiceFromRef(ref);
      const bySale = p.sale_id ? sales.find((s) => s.id === p.sale_id) : undefined;
      const byRef = refInvoice ? sales.find((s) => s.invoice_no === refInvoice) : undefined;
      const byAmount = sales.find((s) => Math.abs(Number(s.total) - Number(s.paid) - Number(p.amount)) < 0.5);
      const match = bySale ?? byRef ?? byAmount;
      const how = bySale ? "sale" : byRef ? "ref" : byAmount ? "amount" : null;
      return { payment: p, ref, trx, match, how };
    });
  }, [gatewayPayments.data, dueSales.data]);

  const matchedCount = reconciliation.filter((r) => r.match).length;
  const collected = (gatewayPayments.data ?? []).reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{bn ? "মোবাইল পেমেন্ট" : "Mobile payments"}</h1>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "বিকাশ, নগদ, রকেট, উপায় ও SSLCommerz — QR/পুশ রিকোয়েস্ট ও অটো রিকনসিলিয়েশন"
              : "bKash, Nagad, Rocket, Upay and SSLCommerz — QR / push requests with auto reconciliation"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void gatewayPayments.refetch()}>
          <RefreshCw className="mr-1 size-4" /> {bn ? "রিফ্রেশ" : "Refresh"}
        </Button>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface-panel p-4">
          <h2 className="font-semibold">{bn ? "পেমেন্ট রিকোয়েস্ট তৈরি করুন" : "Create a payment request"}</h2>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {GATEWAYS.map((x) => (
              <button
                key={x.id}
                onClick={() => setGateway(x.id)}
                className={cn(
                  "rounded-xl border px-2 py-3 text-sm font-medium transition-colors",
                  gateway === x.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                )}
              >
                <Smartphone className="mx-auto mb-1 size-4" />
                {bn ? x.labelBn : x.label}
              </button>
            ))}
          </div>

          {!gatewayEnabled && (
            <p className="mt-3 rounded-lg border border-border bg-muted/40 p-2 text-xs text-muted-foreground">
              {bn
                ? "এই গেটওয়ে API Hub-এ চালু/কনফিগার করা নেই। মার্চেন্ট নম্বর দিতে API Hub → পেমেন্ট-এ গিয়ে provider হিসেবে "
                : "This gateway is not enabled in API Hub. Add it there with provider id "}
              <b>{gateway}</b>
              {bn ? " যোগ করুন (Sender ID ঘরে মার্চেন্ট নম্বর)।" : " and put the merchant number in the Sender ID field."}
            </p>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{bn ? "টাকার পরিমাণ" : "Amount"}</Label>
              <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label>{bn ? "চালান নম্বর" : "Invoice no."}</Label>
              <Select
                value={invoiceNo}
                onValueChange={(v) => {
                  setInvoiceNo(v);
                  const s = dueSales.data?.find((x) => String(x.invoice_no) === v);
                  if (s) {
                    setAmount((Number(s.total) - Number(s.paid)).toFixed(2));
                    setPhone(s.customer_phone ?? "");
                  }
                  setReference(buildPaymentRef(Number(v)));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={bn ? "বকেয়া চালান" : "Due invoice"} />
                </SelectTrigger>
                <SelectContent>
                  {(dueSales.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={String(s.invoice_no)}>
                      #{s.invoice_no} · {s.customer_name || (bn ? "ওয়াক-ইন" : "Walk-in")} ·{" "}
                      {money(Number(s.total) - Number(s.paid), lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{bn ? "মোবাইল নম্বর" : "Mobile number"}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-muted px-2 py-1 text-xs">
              {bn ? "রেফারেন্স" : "Reference"}: <b>{reference}</b>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setReference(buildPaymentRef(invoiceNo ? Number(invoiceNo) : null))}>
              <RefreshCw className="mr-1 size-4" /> {bn ? "নতুন" : "New"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!phone}
              onClick={() => shareOnWhatsApp(phone, message)}
            >
              <MessageCircle className="mr-1 size-4" /> WhatsApp
            </Button>
            <Button variant="outline" size="sm" disabled={!phone} onClick={() => shareOnSms(phone, message)}>
              <Smartphone className="mr-1 size-4" /> SMS
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(message);
                toast.success(bn ? "কপি হয়েছে" : "Copied");
              }}
            >
              <Copy className="mr-1 size-4" /> {bn ? "কপি" : "Copy"}
            </Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="grid place-items-center rounded-xl border border-border bg-muted/30 p-3">
              {qr ? (
                <img src={qr} alt={`${g.label} payment QR for ${reference}`} className="size-40" />
              ) : (
                <div className="flex flex-col items-center gap-2 p-6 text-center text-xs text-muted-foreground">
                  <QrCode className="size-8" />
                  {bn ? "মার্চেন্ট নম্বর ও টাকার অঙ্ক দিলে QR তৈরি হবে" : "QR appears once amount and merchant number are set"}
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="whitespace-pre-line rounded-lg border border-border bg-muted/30 p-3 text-sm">{message}</p>
              <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={trxId}
                  onChange={(e) => setTrxId(e.target.value)}
                  placeholder={bn ? "ট্রানজেকশন আইডি (TrxID)" : "Transaction ID (TrxID)"}
                />
                <Button onClick={() => record.mutate()} disabled={record.isPending}>
                  <CheckCircle2 className="mr-1 size-4" /> {bn ? "পেমেন্ট পেয়েছি" : "Mark received"}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="surface-panel p-4">
            <p className="text-xs uppercase text-muted-foreground">{bn ? "মোবাইল পেমেন্টে আদায়" : "Collected via mobile"}</p>
            <p className="mt-1 text-2xl font-bold">{money(collected, lang)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {bn ? "মিলেছে" : "Matched"}: {matchedCount}/{reconciliation.length}
            </p>
          </div>
          <div className="surface-panel p-4">
            <p className="text-xs uppercase text-muted-foreground">{bn ? "বকেয়া চালান" : "Open due invoices"}</p>
            <p className="mt-1 text-2xl font-bold">{dueSales.data?.length ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {money((dueSales.data ?? []).reduce((s, x) => s + Number(x.total) - Number(x.paid), 0), lang)}
            </p>
          </div>
        </div>
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="font-semibold">{bn ? "অটো রিকনসিলিয়েশন" : "Auto reconciliation"}</h2>
          <span className="text-xs text-muted-foreground">
            {bn ? "রেফারেন্স / চালান / টাকার অঙ্ক মিলিয়ে" : "Matched by reference, invoice link or amount"}
          </span>
        </div>
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-y border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2">{bn ? "তারিখ" : "Date"}</th>
              <th className="px-4 py-2">{bn ? "গেটওয়ে" : "Gateway"}</th>
              <th className="px-4 py-2">TrxID</th>
              <th className="px-4 py-2">{bn ? "রেফারেন্স" : "Reference"}</th>
              <th className="px-4 py-2 text-right">{bn ? "টাকা" : "Amount"}</th>
              <th className="px-4 py-2">{bn ? "চালান" : "Invoice"}</th>
              <th className="px-4 py-2">{bn ? "অবস্থা" : "Status"}</th>
            </tr>
          </thead>
          <tbody>
            {reconciliation.map((r) => (
              <tr key={r.payment.id} className="border-b border-border last:border-0">
                <td className="px-4 py-2">{r.payment.paid_on}</td>
                <td className="px-4 py-2">{bn ? gatewayById(r.payment.method)?.labelBn : gatewayById(r.payment.method)?.label}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.trx ?? "—"}</td>
                <td className="px-4 py-2 font-mono text-xs">{r.ref ?? "—"}</td>
                <td className="px-4 py-2 text-right font-medium">{money(Number(r.payment.amount), lang)}</td>
                <td className="px-4 py-2">{r.match ? `#${r.match.invoice_no}` : "—"}</td>
                <td className="px-4 py-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      r.how === "sale" || r.how === "ref"
                        ? "bg-primary/10 text-primary"
                        : r.how === "amount"
                          ? "bg-accent/15 text-accent-foreground"
                          : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {r.how === "sale" || r.how === "ref"
                      ? bn
                        ? "মিলেছে"
                        : "Matched"
                      : r.how === "amount"
                        ? bn
                          ? "সম্ভাব্য মিল"
                          : "Likely match"
                        : bn
                          ? "মিল নেই"
                          : "Unmatched"}
                  </span>
                </td>
              </tr>
            ))}
            {reconciliation.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={7}>
                  {bn ? "এখনও কোনো মোবাইল পেমেন্ট নেই" : "No mobile payments recorded yet"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
