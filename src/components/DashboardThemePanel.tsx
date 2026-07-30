import { Check, Moon, Palette, RotateCcw, Sparkles, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  DASHBOARD_THEMES,
  dashboardThemeAttrs,
  type DashboardMode,
  type DashboardThemeId,
} from "@/lib/dashboard-theme";

type Props = {
  theme: DashboardThemeId;
  mode: DashboardMode;
  glass: boolean;
  onChange: (patch: { theme?: DashboardThemeId; mode?: DashboardMode; glass?: boolean }) => void;
  onReset: () => void;
};

/** Live mini-preview of a palette in a given light/dark mode. */
function ThemePreview({ theme, mode, glass }: { theme: DashboardThemeId; mode: "light" | "dark"; glass: boolean }) {
  return (
    <div
      className="dashboard-skin h-24 w-full overflow-hidden p-2"
      {...dashboardThemeAttrs(theme, mode, glass)}
      aria-hidden
    >
      <div className="surface-panel flex h-full flex-col justify-between p-2">
        <div className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary" />
          <span className="h-1.5 w-10 rounded-full bg-muted-foreground/40" />
          <span className="ml-auto h-1.5 w-5 rounded-full bg-accent" />
        </div>
        <div className="flex items-end gap-1">
          {[8, 14, 10, 18, 12].map((h, i) => (
            <span key={i} className="w-2 rounded-sm bg-primary/70" style={{ height: h }} />
          ))}
          <span className="ml-auto h-4 w-8 rounded-md bg-primary" />
        </div>
      </div>
    </div>
  );
}

/** Dashboard-only theme settings: palette, light/dark mode and glass effect. */
export function DashboardThemePanel({ theme, mode, glass, onChange, onReset }: Props) {
  const { lang } = useI18n();
  const bn = lang === "bn";

  const modes: { key: DashboardMode; label: string; icon: typeof Sun }[] = [
    { key: "light", label: bn ? "লাইট" : "Light", icon: Sun },
    { key: "dark", label: bn ? "ডার্ক" : "Dark", icon: Moon },
    { key: "system", label: bn ? "সিস্টেম" : "System", icon: SunMoon },
  ];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Palette className="mr-1 size-4" />
          {bn ? "থিম" : "Theme"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{bn ? "ড্যাশবোর্ড থিম সেটিংস" : "Dashboard theme settings"}</DialogTitle>
          <DialogDescription>
            {bn
              ? "রং, লাইট/ডার্ক মোড ও গ্লাস ইফেক্ট বেছে নিন — শুধু ড্যাশবোর্ডে প্রযোজ্য এবং স্বয়ংক্রিয়ভাবে সেভ হয়।"
              : "Pick a palette, light/dark mode and glass effect. Applies to the dashboard only and saves automatically."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <section>
            <p className="mb-2 text-sm font-semibold">{bn ? "কালার প্যালেট" : "Colour palette"}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {DASHBOARD_THEMES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onChange({ theme: p.id })}
                  className={cn(
                    "overflow-hidden rounded-xl border-2 text-left transition-all",
                    theme === p.id ? "border-primary shadow-lg" : "border-border hover:border-primary/50",
                  )}
                >
                  <ThemePreview theme={p.id} mode={mode === "dark" ? "dark" : "light"} glass={glass} />
                  <div className="flex items-center gap-1.5 px-2.5 py-2">
                    <span className="flex gap-1">
                      {p.swatch.map((c) => (
                        <span key={c} className="size-3 rounded-full" style={{ backgroundColor: c }} />
                      ))}
                    </span>
                    <span className="ml-auto text-xs font-semibold">{bn ? p.name.bn : p.name.en}</span>
                    {theme === p.id && <Check className="size-3.5 text-primary" />}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-sm font-semibold">{bn ? "লাইট / ডার্ক মোড" : "Light / dark mode"}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["light", "dark"] as const).map((m) => (
                <div key={m} className="overflow-hidden rounded-xl border border-border">
                  <ThemePreview theme={theme} mode={m} glass={glass} />
                  <p className="px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                    {m === "light" ? (bn ? "লাইট প্রিভিউ" : "Light preview") : bn ? "ডার্ক প্রিভিউ" : "Dark preview"}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 inline-flex rounded-xl border border-border p-0.5">
              {modes.map((m) => (
                <Button
                  key={m.key}
                  type="button"
                  size="sm"
                  variant={mode === m.key ? "secondary" : "ghost"}
                  onClick={() => onChange({ mode: m.key })}
                >
                  <m.icon className="mr-1.5 size-4" />
                  {m.label}
                </Button>
              ))}
            </div>
          </section>

          <section className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant={glass ? "default" : "outline"}
              onClick={() => onChange({ glass: !glass })}
            >
              <Sparkles className="mr-1.5 size-4" />
              {glass ? (bn ? "গ্লাস ইফেক্ট চালু" : "Glass effect on") : bn ? "গ্লাস ইফেক্ট বন্ধ" : "Glass effect off"}
            </Button>
            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onReset}>
              <RotateCcw className="mr-1.5 size-4" />
              {bn ? "ডিফল্টে ফেরান" : "Reset to default"}
            </Button>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
