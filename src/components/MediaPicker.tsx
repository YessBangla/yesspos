import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MediaLibrary } from "@/components/MediaLibrary";
import { useI18n } from "@/lib/i18n";
import type { MediaAsset } from "@/lib/media";

/** Reusable "pick an image from the gallery" button for any form in the app. */
export function MediaPicker({
  onSelect,
  onSelectMany,
  label,
  variant = "outline",
  size = "sm",
}: {
  onSelect?: (url: string, alt?: string | null) => void;
  /** Enables multi-select mode inside the gallery dialog. */
  onSelectMany?: (assets: MediaAsset[]) => void;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)}>
        <ImagePlus className="mr-2 size-4" />
        {label ?? (bn ? "গ্যালারি থেকে বাছুন" : "Pick from gallery")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bn ? "ইমেজ গ্যালারি" : "Image gallery"}</DialogTitle>
          </DialogHeader>
          <MediaLibrary
            compact
            onPick={
              onSelect
                ? (a) => {
                    onSelect(a.url, a.alt_text);
                    setOpen(false);
                  }
                : undefined
            }
            onPickMany={
              onSelectMany
                ? (list) => {
                    onSelectMany(list);
                    setOpen(false);
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
