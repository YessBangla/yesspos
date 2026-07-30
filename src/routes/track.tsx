import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  Bike,
  Camera,
  MapPin,
  PackageSearch,
  Phone,
  Route as RouteIcon,
  Send,
  ThumbsUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/track")({
  head: () => ({
    meta: [
      { title: "Track your grocery order — Sokoler Bazar" },
      {
        name: "description",
        content:
          "Check the live status of your home delivery grocery order with order number and phone.",
      },
      { property: "og:title", content: "Track your grocery order — Sokoler Bazar" },
      { property: "og:description", content: "Live status of your home delivery order." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

type Tracked = {
  order_no: number;
  status: string;
  total: number;
  created_at: string;
  updated_at: string | null;
  slot: string | null;
  area: string | null;
  payment_method: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  rider_vehicle: string | null;
  eta_minutes: number | null;
  rider_lat: number | null;
  rider_lng: number | null;
  rider_location_at: string | null;
};

const FLOW = ["pending", "confirmed", "packed", "shipped", "delivered"] as const;

const STEP_LABEL: Record<string, { bn: string; en: string }> = {
  pending: { bn: "অর্ডার গৃহীত", en: "Order placed" },
  confirmed: { bn: "কনফার্মড", en: "Confirmed" },
  packed: { bn: "প্যাকিং সম্পন্ন", en: "Packed" },
  shipped: { bn: "রাস্তায়", en: "On the way" },
  delivered: { bn: "ডেলিভার্ড", en: "Delivered" },
};

/** Free OpenStreetMap embed – no API key needed. */
function mapSrc(lat: number, lng: number) {
  const d = 0.01;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}`;
}

type Notice = { id: string; title: string; body: string; created_at: string };
type Proof = {
  kind: string;
  file_path: string;
  receiver_name: string | null;
  note: string | null;
  created_at: string;
  captured_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  status: string | null;
};

/** Signed preview of a private proof image. */
function ProofThumb({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.storage
      .from("delivery-proofs")
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url) return <div className="h-24 w-24 animate-pulse rounded-lg bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt={alt}
        loading="lazy"
        className="h-24 w-24 rounded-lg border border-border object-cover"
      />
    </a>
  );
}

function TrackPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<Tracked | null | "none">(null);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedbackKind, setFeedbackKind] = useState<"confirm" | "issue" | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sentKind, setSentKind] = useState<"confirm" | "issue" | null>(null);

  const search = useCallback(
    async (no = orderNo, ph = phone) => {
      setLoading(true);
      setSentKind(null);
      setFeedbackKind(null);
      const { data } = await supabase.rpc("track_delivery_order", {
        _order_no: Number(no),
        _phone: ph.trim(),
      });
      const row = (data as unknown as Tracked[] | null)?.[0] ?? null;
      setResult(row ?? "none");
      if (row) {
        const { data: notes } = await supabase
          .from("customer_notifications")
          .select("id,title,body,created_at")
          .eq("order_no", row.order_no)
          .eq("customer_phone", ph.trim())
          .order("created_at", { ascending: false })
          .limit(20);
        setNotices((notes as unknown as Notice[] | null) ?? []);
        const { data: pr } = await supabase.rpc("track_delivery_proofs", {
          _order_no: Number(no),
          _phone: ph.trim(),
        });
        setProofs((pr as unknown as Proof[] | null) ?? []);
      } else {
        setNotices([]);
        setProofs([]);
      }
      setLoading(false);
    },
    [orderNo, phone],
  );

  async function sendFeedback(kind: "confirm" | "issue") {
    if (kind === "issue" && !feedbackMsg.trim()) {
      toast.error(bn ? "সমস্যার বিবরণ লিখুন" : "Describe the issue");
      return;
    }
    setSending(true);
    const { error } = await supabase.rpc("submit_delivery_feedback", {
      _order_no: Number(orderNo),
      _phone: phone.trim(),
      _kind: kind,
      _message: feedbackMsg.trim() || undefined,
    });
    setSending(false);
    if (error) {
      toast.error(bn ? "পাঠানো যায়নি, আবার চেষ্টা করুন" : "Could not send, please retry");
      return;
    }
    setFeedbackMsg("");
    setFeedbackKind(null);
    setSentKind(kind);
    toast.success(
      kind === "confirm"
        ? bn
          ? "ধন্যবাদ! ডেলিভারি কনফার্ম হয়েছে"
          : "Thanks! Delivery confirmed"
        : bn
          ? "আপনার সমস্যা রিপোর্ট করা হয়েছে"
          : "Your issue has been reported",
    );
  }

  // Auto-track when opened from a QR code / shared link: /track?order=123&phone=01…
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    const params = new URLSearchParams(window.location.search);
    const no = params.get("order") ?? "";
    const ph = params.get("phone") ?? "";
    if (!no || !ph) return;
    autoRan.current = true;
    setOrderNo(no);
    setPhone(ph);
    void search(no, ph);
  }, [search]);

  return (
    <main className="mx-auto max-w-lg px-4 py-16">
      <h1 className="font-display text-2xl font-bold">
        {bn ? "অর্ডার ট্র্যাক করুন" : "Track your order"}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {bn ? "অর্ডার নম্বর ও ফোন নম্বর দিন।" : "Enter your order number and phone."}
      </p>
      <div className="surface-panel mt-6 space-y-3 p-4">
        <div className="space-y-1.5">
          <Label>{bn ? "অর্ডার নম্বর" : "Order no."}</Label>
          <Input
            value={orderNo}
            onChange={(e) => setOrderNo(e.target.value)}
            inputMode="numeric"
            maxLength={12}
          />
        </div>
        <div className="space-y-1.5">
          <Label>{bn ? "ফোন" : "Phone"}</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
        </div>
        <Button
          className="w-full"
          onClick={() => search()}
          disabled={loading || !orderNo || !phone}
        >
          <PackageSearch className="mr-1 size-4" /> {bn ? "খুঁজুন" : "Track"}
        </Button>

        {result === "none" && (
          <p className="text-sm text-destructive">
            {bn ? "অর্ডার পাওয়া যায়নি।" : "No matching order found."}
          </p>
        )}
        {result && result !== "none" && (
          <div className="rounded-xl border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "অর্ডার" : "Order"}</span>
              <span className="font-semibold">#{result.order_no}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "অবস্থা" : "Status"}</span>
              <span className="font-semibold uppercase">{result.status}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{bn ? "মোট" : "Total"}</span>
              <span className="font-semibold">{money(Number(result.total), lang)}</span>
            </div>
            {result.slot && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">{bn ? "স্লট" : "Slot"}</span>
                <span className="font-semibold">{result.slot}</span>
              </div>
            )}
            {result.eta_minutes != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {bn ? "আনুমানিক সময়" : "Estimated time"}
                </span>
                <span className="font-semibold">
                  {result.eta_minutes} {bn ? "মিনিট" : "min"}
                </span>
              </div>
            )}
            {result.updated_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {bn ? "সর্বশেষ আপডেট" : "Last update"}
                </span>
                <span>{result.updated_at.slice(0, 16).replace("T", " ")}</span>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-border p-3">
              <p className="mb-2 flex items-center gap-1 font-semibold">
                <RouteIcon className="size-4 text-primary" />{" "}
                {bn ? "ডেলিভারি অগ্রগতি" : "Delivery progress"}
              </p>
              {result.status === "cancelled" ? (
                <p className="text-sm text-destructive">
                  {bn ? "অর্ডারটি বাতিল হয়েছে।" : "This order was cancelled."}
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {FLOW.map((step, i) => {
                    const idx = FLOW.indexOf(result.status as (typeof FLOW)[number]);
                    const done = idx >= i;
                    const current = idx === i;
                    return (
                      <li key={step} className="flex items-center gap-2 text-xs">
                        <span
                          className={
                            done
                              ? "size-2.5 rounded-full bg-primary"
                              : "size-2.5 rounded-full border border-border bg-background"
                          }
                        />
                        <span className={done ? "font-semibold" : "text-muted-foreground"}>
                          {bn ? STEP_LABEL[step].bn : STEP_LABEL[step].en}
                        </span>
                        {current && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                            {bn ? "চলমান" : "Now"}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
              {result.rider_lat != null && result.rider_lng != null ? (
                <div className="mt-3">
                  <iframe
                    title={bn ? "রাইডারের লোকেশন" : "Rider location"}
                    src={mapSrc(Number(result.rider_lat), Number(result.rider_lng))}
                    className="h-56 w-full rounded-lg border border-border"
                    loading="lazy"
                  />
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {bn ? "সর্বশেষ লোকেশন" : "Last location"}:{" "}
                      {result.rider_location_at?.slice(0, 16).replace("T", " ") ?? "—"}
                    </span>
                    <a
                      className="inline-flex items-center gap-1 font-semibold text-primary underline"
                      href={`https://www.openstreetmap.org/?mlat=${result.rider_lat}&mlon=${result.rider_lng}#map=15/${result.rider_lat}/${result.rider_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin className="size-3" /> {bn ? "বড় ম্যাপে দেখুন" : "Open in map"}
                    </a>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  {bn
                    ? "রাইডারের লাইভ লোকেশন এখনো পাওয়া যায়নি।"
                    : "Live rider location is not available yet."}
                </p>
              )}
            </div>

            <div className="mt-3 rounded-lg bg-muted/60 p-3">
              <p className="mb-1 flex items-center gap-1 font-semibold">
                <Bike className="size-4 text-primary" /> {bn ? "ডেলিভারি ম্যান" : "Delivery man"}
              </p>
              {result.rider_name ? (
                <>
                  <p>{result.rider_name}</p>
                  {result.rider_vehicle && (
                    <p className="text-xs text-muted-foreground">{result.rider_vehicle}</p>
                  )}
                  {result.rider_phone && (
                    <a
                      href={`tel:${result.rider_phone}`}
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-primary underline"
                    >
                      <Phone className="size-3" /> {result.rider_phone}
                    </a>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground">
                  {bn ? "এখনো রাইডার নির্ধারণ হয়নি।" : "No rider assigned yet."}
                </p>
              )}
            </div>

            {notices.length > 0 && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <p className="mb-1 flex items-center gap-1 font-semibold">
                  <BellRing className="size-4 text-primary" /> {bn ? "আপডেট বার্তা" : "Updates"}
                </p>
                <ol className="space-y-2">
                  {notices.map((n) => (
                    <li key={n.id} className="rounded-md bg-muted/60 p-2 text-xs">
                      <p className="font-semibold">{n.title}</p>
                      <p className="text-muted-foreground">{n.body}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {n.created_at.slice(0, 16).replace("T", " ")}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {proofs.length > 0 && (
              <div className="mt-3 rounded-lg border border-border p-3">
                <p className="mb-2 flex items-center gap-1 font-semibold">
                  <Camera className="size-4 text-primary" />{" "}
                  {bn ? "ডেলিভারির প্রমাণ" : "Proof of delivery"}
                </p>
                <div className="flex flex-wrap gap-3">
                  {proofs.map((p) => (
                    <div key={p.file_path} className="space-y-1">
                      <ProofThumb path={p.file_path} alt={p.kind} />
                      <p className="text-[10px] text-muted-foreground">
                        {p.kind === "signature"
                          ? bn
                            ? "স্বাক্ষর"
                            : "Signature"
                          : bn
                            ? "ছবি"
                            : "Photo"}{" "}
                        · {p.created_at.slice(0, 16).replace("T", " ")}
                      </p>
                      {p.receiver_name && <p className="text-[10px]">{p.receiver_name}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 rounded-lg border border-border p-3">
              <p className="mb-2 font-semibold">{bn ? "আপনার ফিডব্যাক" : "Your feedback"}</p>
              {sentKind ? (
                <p className="flex items-center gap-1 text-sm text-primary">
                  <ThumbsUp className="size-4" />
                  {sentKind === "confirm"
                    ? bn
                      ? "ধন্যবাদ, ডেলিভারি কনফার্ম করা হয়েছে।"
                      : "Thanks, your delivery is confirmed."
                    : bn
                      ? "আপনার সমস্যা রিপোর্ট করা হয়েছে, আমরা দ্রুত যোগাযোগ করব।"
                      : "Your issue was reported, we will contact you soon."}
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={feedbackKind === "confirm" ? "default" : "outline"}
                      onClick={() => setFeedbackKind("confirm")}
                    >
                      <ThumbsUp className="mr-1 size-4" />
                      {bn ? "ডেলিভারি কনফার্ম" : "Confirm delivery"}
                    </Button>
                    <Button
                      size="sm"
                      variant={feedbackKind === "issue" ? "destructive" : "outline"}
                      onClick={() => setFeedbackKind("issue")}
                    >
                      <AlertTriangle className="mr-1 size-4" />
                      {bn ? "সমস্যা রিপোর্ট" : "Report an issue"}
                    </Button>
                  </div>
                  {feedbackKind && (
                    <div className="mt-2 space-y-2">
                      <Textarea
                        value={feedbackMsg}
                        maxLength={1000}
                        rows={3}
                        onChange={(e) => setFeedbackMsg(e.target.value)}
                        placeholder={
                          feedbackKind === "issue"
                            ? bn
                              ? "কী সমস্যা হয়েছে লিখুন…"
                              : "Describe the problem…"
                            : bn
                              ? "মন্তব্য (ঐচ্ছিক)"
                              : "Comment (optional)"
                        }
                      />
                      <Button
                        size="sm"
                        disabled={sending}
                        onClick={() => void sendFeedback(feedbackKind)}
                      >
                        <Send className="mr-1 size-4" />
                        {bn ? "পাঠান" : "Send"}
                      </Button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <Link to="/homedelivery" className="mt-6 inline-block text-sm text-primary underline">
        {bn ? "← দোকানে ফিরে যান" : "← Back to shop"}
      </Link>
    </main>
  );
}
