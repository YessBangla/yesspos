import { Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useTextSize } from "@/lib/text-size";

/** One-tap bigger text for easier reading on any device. */
export function TextSizeToggle({ className }: { className?: string }) {
  const { lang } = useI18n();
  const { size, cycle } = useTextSize();
  const bn = lang === "bn";
  const label = size === "normal" ? (bn ? "স্বাভাবিক" : "Normal") : size === "large" ? (bn ? "বড়" : "Large") : bn ? "অনেক বড়" : "X-large";

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={cycle}
      title={bn ? "লেখার আকার বদলান" : "Change text size"}
      aria-label={bn ? "লেখার আকার বদলান" : "Change text size"}
    >
      <Type className="size-4 sm:mr-1.5" />
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}
