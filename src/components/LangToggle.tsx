import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={cn("inline-flex rounded-lg border border-border p-0.5", className)}>
      {(["bn", "en"] as const).map((l) => (
        <Button
          key={l}
          type="button"
          size="sm"
          variant={lang === l ? "secondary" : "ghost"}
          className="h-7 px-2.5 text-xs font-semibold"
          onClick={() => setLang(l)}
        >
          {l === "bn" ? "বাংলা" : "EN"}
        </Button>
      ))}
    </div>
  );
}
