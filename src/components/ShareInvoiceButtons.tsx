import { Copy, MessageCircle, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import {
  buildInvoiceMessage,
  copyMessage,
  shareOnSms,
  shareOnWhatsApp,
  type ShareInvoice,
} from "@/lib/share-invoice";

/** WhatsApp / SMS / copy buttons for one invoice. */
export function ShareInvoiceButtons({
  invoice,
  phone,
  size = "sm",
}: {
  invoice: ShareInvoice;
  phone?: string | null;
  size?: "sm" | "default";
}) {
  const { lang } = useI18n();
  const message = buildInvoiceMessage(invoice, lang);

  return (
    <div className="flex flex-wrap gap-2">
      <Button size={size} variant="outline" onClick={() => shareOnWhatsApp(phone ?? "", message)}>
        <MessageCircle className="mr-1.5 size-4" />
        WhatsApp
      </Button>
      <Button
        size={size}
        variant="outline"
        onClick={() => {
          if (!phone) return toast.error(lang === "bn" ? "ফোন নম্বর নেই" : "No phone number");
          shareOnSms(phone, message);
        }}
      >
        <Smartphone className="mr-1.5 size-4" />
        SMS
      </Button>
      <Button
        size={size}
        variant="outline"
        onClick={async () => {
          const ok = await copyMessage(message);
          toast[ok ? "success" : "error"](
            ok
              ? lang === "bn"
                ? "চালান কপি হয়েছে"
                : "Invoice copied"
              : lang === "bn"
                ? "কপি করা যায়নি"
                : "Copy failed",
          );
        }}
      >
        <Copy className="mr-1.5 size-4" />
        {lang === "bn" ? "কপি" : "Copy"}
      </Button>
    </div>
  );
}
