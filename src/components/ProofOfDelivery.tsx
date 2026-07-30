import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Eraser, ImageIcon, Loader2, PenLine, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { logAudit } from "@/lib/audit";

type Proof = {
  id: string;
  kind: string;
  file_path: string;
  receiver_name: string | null;
  note: string | null;
  created_at: string;
  captured_at: string | null;
  lat: number | null;
  lng: number | null;
  accuracy_m: number | null;
  status: string;
  reject_reason: string | null;
  verified_at: string | null;
};

/** Best-effort browser geolocation; resolves null when unavailable/denied. */
async function currentPosition(): Promise<{
  lat: number;
  lng: number;
  accuracy_m: number;
} | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          lat: p.coords.latitude,
          lng: p.coords.longitude,
          accuracy_m: p.coords.accuracy,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

const BUCKET = "delivery-proofs";

/** Signed URL preview for a private storage object. */
function ProofImage({ path, alt }: { path: string; alt: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (alive) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      alive = false;
    };
  }, [path]);
  if (!url)
    return <div className="h-24 w-24 animate-pulse rounded-lg border border-border bg-muted" />;
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

/** Signature pad on a canvas; returns a PNG blob. */
function SignaturePad({ onSave, saving }: { onSave: (blob: Blob) => void; saving: boolean }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * c.width,
      y: ((e.clientY - r.top) / r.height) * c.height,
    };
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={600}
        height={220}
        className="h-32 w-full touch-none rounded-lg border border-dashed border-border bg-background"
        onPointerDown={(e) => {
          drawing.current = true;
          dirty.current = true;
          const ctx = canvasRef.current!.getContext("2d")!;
          ctx.lineWidth = 3;
          ctx.lineCap = "round";
          ctx.strokeStyle = "#111827";
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = canvasRef.current!.getContext("2d")!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const c = canvasRef.current!;
            c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
            dirty.current = false;
          }}
        >
          <Eraser className="mr-1 size-3.5" /> {bn ? "মুছুন" : "Clear"}
        </Button>
        <Button
          size="sm"
          disabled={saving}
          onClick={() => {
            if (!dirty.current) {
              toast.error(bn ? "আগে স্বাক্ষর করুন" : "Draw a signature first");
              return;
            }
            const c = canvasRef.current!;
            // white background for readability
            const out = document.createElement("canvas");
            out.width = c.width;
            out.height = c.height;
            const octx = out.getContext("2d")!;
            octx.fillStyle = "#ffffff";
            octx.fillRect(0, 0, out.width, out.height);
            octx.drawImage(c, 0, 0);
            out.toBlob((b) => b && onSave(b), "image/png");
          }}
        >
          {saving ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <Upload className="mr-1 size-3.5" />
          )}
          {bn ? "স্বাক্ষর সংরক্ষণ" : "Save signature"}
        </Button>
      </div>
    </div>
  );
}

export function ProofOfDelivery({ orderId, orderNo }: { orderId: string; orderNo: number }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receiver, setReceiver] = useState("");
  const [note, setNote] = useState("");
  const [mode, setMode] = useState<"photo" | "signature">("photo");
  const fileRef = useRef<HTMLInputElement | null>(null);

  const proofs = useQuery({
    queryKey: ["delivery-proofs", orderId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_proofs")
        .select(
          "id,kind,file_path,receiver_name,note,created_at,captured_at,lat,lng,accuracy_m,status,reject_reason,verified_at",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Proof[];
    },
  });

  const upload = useMutation({
    mutationFn: async ({ blob, kind }: { blob: Blob; kind: "photo" | "signature" }) => {
      const ext = kind === "signature" ? "png" : ((blob as File).name?.split(".").pop() ?? "jpg");
      const path = `${orderId}/${kind}-${Date.now()}.${ext}`;
      const gps = await currentPosition();
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, blob, { contentType: blob.type || "image/png", upsert: false });
      if (upErr) throw upErr;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("delivery_proofs").insert({
        order_id: orderId,
        kind,
        file_path: path,
        receiver_name: receiver.trim() || null,
        note: note.trim() || null,
        created_by: auth.user?.id ?? null,
        captured_at: new Date().toISOString(),
        lat: gps?.lat ?? null,
        lng: gps?.lng ?? null,
        accuracy_m: gps?.accuracy_m ?? null,
      });
      if (error) throw error;
      await logAudit("delivery_proof_upload", {
        entity: "delivery_proofs",
        entityId: orderId,
        details: `#${orderNo} ${kind}${gps ? ` @${gps.lat.toFixed(5)},${gps.lng.toFixed(5)}` : ""}`,
      });
      return { gps };
    },
    onSuccess: ({ gps }) => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["delivery-proofs", orderId] });
      void qc.invalidateQueries({ queryKey: ["delivery-orders"] });
      void qc.invalidateQueries({ queryKey: ["delivery-order-events", orderId] });
      toast.success(
        bn
          ? `প্রমাণ সংরক্ষিত — অর্ডার ডেলিভার্ড${gps ? "" : " (লোকেশন পাওয়া যায়নি)"}`
          : `Proof saved — order marked delivered${gps ? "" : " (no GPS)"}`,
      );
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
  });

  const verify = useMutation({
    mutationFn: async ({
      p,
      status,
      reason,
    }: {
      p: Proof;
      status: "approved" | "rejected";
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("delivery_proofs")
        .update({ status, reject_reason: status === "rejected" ? (reason ?? null) : null })
        .eq("id", p.id);
      if (error) throw error;
      await logAudit("delivery_proof_verify", {
        entity: "delivery_proofs",
        entityId: p.id,
        details: `#${orderNo} ${status}${reason ? `: ${reason}` : ""}`,
      });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["delivery-proofs", orderId] });
      void qc.invalidateQueries({ queryKey: ["delivery-order-events", orderId] });
      toast.success(bn ? "যাচাই আপডেট হয়েছে" : "Verification updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });


  const remove = useMutation({
    mutationFn: async (p: Proof) => {
      await supabase.storage.from(BUCKET).remove([p.file_path]);
      const { error } = await supabase.from("delivery_proofs").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["delivery-proofs", orderId] });
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-sm font-semibold"
      >
        <Camera className="size-4 text-primary" />
        {bn ? "প্রুফ-অফ-ডেলিভারি" : "Proof of delivery"}
        <span className="ml-auto text-xs text-muted-foreground">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={receiver}
              maxLength={60}
              onChange={(e) => setReceiver(e.target.value)}
              placeholder={bn ? "যিনি গ্রহণ করেছেন" : "Received by"}
            />
            <Input
              value={note}
              maxLength={140}
              onChange={(e) => setNote(e.target.value)}
              placeholder={bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={mode === "photo" ? "default" : "outline"}
              onClick={() => setMode("photo")}
            >
              <ImageIcon className="mr-1 size-3.5" /> {bn ? "ছবি" : "Photo"}
            </Button>
            <Button
              size="sm"
              variant={mode === "signature" ? "default" : "outline"}
              onClick={() => setMode("signature")}
            >
              <PenLine className="mr-1 size-3.5" /> {bn ? "স্বাক্ষর" : "Signature"}
            </Button>
          </div>

          {mode === "photo" ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  if (f.size > 5 * 1024 * 1024) {
                    toast.error(bn ? "ছবি ৫MB এর কম হতে হবে" : "Image must be under 5MB");
                    return;
                  }
                  upload.mutate({ blob: f, kind: "photo" });
                }}
              />
              <Button
                size="sm"
                onClick={() => fileRef.current?.click()}
                disabled={upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <Camera className="mr-1 size-3.5" />
                )}
                {bn ? "ছবি তুলুন / আপলোড" : "Capture / upload photo"}
              </Button>
            </div>
          ) : (
            <SignaturePad
              saving={upload.isPending}
              onSave={(blob) => upload.mutate({ blob, kind: "signature" })}
            />
          )}

          <div className="flex flex-wrap gap-3">
            {(proofs.data ?? []).map((p) => (
              <div key={p.id} className="w-32 space-y-1">
                <ProofImage path={p.file_path} alt={p.kind} />
                <p className="text-[10px] text-muted-foreground">
                  {p.kind === "signature" ? (bn ? "স্বাক্ষর" : "Signature") : bn ? "ছবি" : "Photo"}{" "}
                  · {(p.captured_at ?? p.created_at).slice(0, 16).replace("T", " ")}
                </p>
                <span
                  className={
                    p.status === "approved"
                      ? "inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                      : p.status === "rejected"
                        ? "inline-block rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold text-destructive"
                        : "inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground"
                  }
                >
                  {p.status === "approved"
                    ? bn
                      ? "অ্যাপ্রুভড"
                      : "Approved"
                    : p.status === "rejected"
                      ? bn
                        ? "রিজেক্টেড"
                        : "Rejected"
                      : bn
                        ? "অপেক্ষমাণ"
                        : "Pending"}
                </span>
                {p.lat != null && p.lng != null ? (
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=17/${p.lat}/${p.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[10px] text-primary underline"
                  >
                    <MapPin className="mr-0.5 inline size-3" />
                    {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                    {p.accuracy_m ? ` ±${Math.round(p.accuracy_m)}m` : ""}
                  </a>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    {bn ? "লোকেশন নেই" : "No GPS"}
                  </p>
                )}
                {p.receiver_name && <p className="text-[10px]">{p.receiver_name}</p>}
                {p.reject_reason && (
                  <p className="text-[10px] text-destructive">{p.reject_reason}</p>
                )}
                {canVerify && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      disabled={verify.isPending || p.status === "approved"}
                      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-primary disabled:opacity-40"
                      onClick={() => verify.mutate({ p, status: "approved" })}
                    >
                      <ShieldCheck className="size-3" /> {bn ? "অ্যাপ্রুভ" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={verify.isPending}
                      className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-destructive disabled:opacity-40"
                      onClick={() => {
                        const reason = window.prompt(
                          bn ? "রিজেক্টের কারণ লিখুন (বাধ্যতামূলক)" : "Reason for rejection (required)",
                          p.reject_reason ?? "",
                        );
                        if (reason === null) return;
                        if (reason.trim().length < 3) {
                          toast.error(bn ? "কারণ লিখতে হবে" : "A reason is required");
                          return;
                        }
                        verify.mutate({ p, status: "rejected", reason: reason.trim() });
                      }}
                    >
                      <ShieldX className="size-3" /> {bn ? "রিজেক্ট" : "Reject"}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10px] text-destructive"
                  onClick={() => remove.mutate(p)}
                >
                  <Trash2 className="size-3" /> {bn ? "মুছুন" : "Delete"}
                </button>
              </div>
            ))}
            {proofs.data && proofs.data.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {bn ? "এখনো কোনো প্রমাণ যোগ হয়নি।" : "No proof added yet."}
              </p>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
