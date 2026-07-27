import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Boxes, ReceiptText, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { LangToggle } from "@/components/LangToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SheraPOS — Shop Billing, Stock & Reports" },
      {
        name: "description",
        content:
          "SheraPOS is a browser point-of-sale for retail shops: fast billing, automatic stock updates, daily sales reports. Bengali and English.",
      },
      { property: "og:title", content: "SheraPOS — Shop Billing, Stock & Reports" },
      {
        property: "og:description",
        content: "Fast billing, automatic stock and daily reports for your shop.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();

  const features = [
    { icon: ShoppingCart, title: t("featureBilling"), body: t("featureBillingD") },
    { icon: Boxes, title: t("featureStock"), body: t("featureStockD") },
    { icon: BarChart3, title: t("featureReport"), body: t("featureReportD") },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="gradient-brand flex size-9 items-center justify-center rounded-lg text-primary-foreground">
            <ReceiptText className="size-5" />
          </span>
          <span className="font-display text-lg font-bold">{t("appName")}</span>
        </div>
        <div className="flex items-center gap-2">
          <LangToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">{t("signIn")}</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-8 md:grid-cols-2 md:pt-16">
          <div>
            <p className="mb-3 inline-flex rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground">
              POS • Inventory • Reports
            </p>
            <h1 className="text-4xl font-bold leading-tight md:text-5xl">{t("tagline")}</h1>
            <p className="mt-4 max-w-md text-muted-foreground">{t("heroSub")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">
                  {t("getStarted")} <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">{t("signIn")}</Link>
              </Button>
            </div>
          </div>

          <div className="surface-panel p-4">
            <div className="gradient-brand rounded-lg p-4 text-primary-foreground">
              <p className="text-xs opacity-80">{t("todaySales")}</p>
              <p className="font-display text-3xl font-bold">৳12,480.00</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/50 p-3">
                  <div className="h-8 rounded bg-secondary" />
                  <div className="mt-2 h-2 w-3/4 rounded bg-border" />
                  <div className="mt-1 h-2 w-1/2 rounded bg-border" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-24 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="surface-panel p-5">
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
                <f.icon className="size-5" />
              </span>
              <h2 className="text-lg font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border py-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} {t("appName")}
      </footer>
    </div>
  );
}
