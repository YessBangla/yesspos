import { useEffect, useState } from "react";
import { Copy, QrCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

/** Builds the public tracking URL for a delivery order. */
export function trackingUrl(orderNo: number, phone: string) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/track?order=${orderNo}&phone=${encodeURIComponent(phone)}`;
}

/** Auto-generated customer tracking link + QR code for one delivery order. */
export function DeliveryTrackingQr({ orderNo, phone }: { orderNo: number; phone: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [open, setOpen] = useState(false);
  const [png, setPng] = useState<string | null>(null);
  const url = trackingUrl(orderNo, phone);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    import("qrcode")
      .then((m) => m.toDataURL(url, { width: 320, margin: 1 }))
      .then((d) => alive && setPng(d))
      .catch(() => alive && setPng(null));
    return () => {
      alive = false;
    };
  }, [open, url]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(bn ? "লিংক কপি হয়েছে" : "Link copied");
    } catch {
      toast.error(bn ? "কপি করা যায়নি" : "Copy failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <QrCode className="mr-1 size-4" /> {bn ? "ট্র্যাকিং QR" : "Tracking QR"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {bn ? "কাস্টমার ট্র্যাকিং" : "Customer tracking"} #{orderNo}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-center rounded-lg bg-card p-3">
            {png ? (
              <img src={png} alt={`Tracking QR code for order ${orderNo}`} className="size-56" />
            ) : (
              <p className="py-16 text-sm text-muted-foreground">…</p>
            )}
          </div>
          <p className="break-all rounded-md bg-muted/60 p-2 text-xs">{url}</p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" className="flex-1" onClick={copy}>
              <Copy className="mr-1 size-4" /> {bn ? "লিংক কপি" : "Copy link"}
            </Button>
            <Button size="sm" className="flex-1" onClick={() => window.print()}>
              {bn ? "প্রিন্ট" : "Print"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
