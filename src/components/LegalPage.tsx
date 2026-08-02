import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export type LegalSection = { heading: string; body: string[]; list?: string[] };

/** Shared corporate layout for Privacy Policy / Terms of Service pages. */
export function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  sections,
  footnote,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  footnote?: ReactNode;
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo size={32} priority />

            <span className="font-display font-bold">{t("appName")}</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="mr-1 size-4" /> {t("home")}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
        <p className="mt-6 leading-relaxed text-muted-foreground">{intro}</p>

        <nav aria-label="Contents" className="surface-panel mt-8 p-5">
          <ol className="grid gap-2 text-sm sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.heading}>
                <a href={`#s-${i + 1}`} className="text-muted-foreground hover:text-foreground">
                  {i + 1}. {s.heading}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.heading} id={`s-${i + 1}`} className="scroll-mt-20">
              <h2 className="font-display text-xl font-bold tracking-tight">
                {i + 1}. {s.heading}
              </h2>
              {s.body.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
              {s.list && (
                <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
                  {s.list.map((li) => (
                    <li key={li} className="leading-relaxed">
                      {li}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {footnote && <div className="surface-panel mt-12 p-6 text-sm text-muted-foreground">{footnote}</div>}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-4xl flex-col items-center justify-between gap-2 px-5 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {t("appName")} — a part of Shondhaan, a sister concern of Yess Bangla Private
            Limited
          </p>
          <div className="flex gap-4">

            <Link to="/privacy" className="hover:text-foreground">
              {t("privacyPolicy")}
            </Link>
            <Link to="/terms" className="hover:text-foreground">
              {t("termsOfService")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
