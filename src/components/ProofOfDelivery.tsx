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
};

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
function SignaturePad({
  onSave,
  saving,
}: {
  onSave: (blob: Blob) => void;
  saving: boolean;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
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
        .select("id,kind,file_path,receiver_name,note,created_at")
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
      });
      if (error) throw error;
      await logAudit("delivery_proof_upload", {
        entity: "delivery_proofs",
        entityId: orderId,
        details: `#${orderNo} ${kind}`,
      });
    },
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["delivery-proofs", orderId] });
      toast.success(bn ? "প্রমাণ সংরক্ষিত হয়েছে" : "Proof saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Upload failed"),
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
              <Button size="sm" onClick={() => fileRef.current?.click()} disabled={upload.isPending}>
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
              <div key={p.id} className="space-y-1">
                <ProofImage path={p.file_path} alt={p.kind} />
                <p className="text-[10px] text-muted-foreground">
                  {p.kind === "signature" ? (bn ? "স্বাক্ষর" : "Signature") : bn ? "ছবি" : "Photo"} ·{" "}
                  {p.created_at.slice(0, 16).replace("T", " ")}
                </p>
                {p.receiver_name && <p className="text-[10px]">{p.receiver_name}</p>}
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
