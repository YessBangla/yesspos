import { createFileRoute } from "@tanstack/react-router";
import { SiteContentEditor } from "@/components/SiteContentEditor";
import { TextSizeToggle } from "@/components/TextSizeToggle";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/site-content")({
  head: () => ({
    meta: [
      { title: "Website content — Bazar Bari" },
      {
        name: "description",
        content: "Edit every public text of the storefront and home page from the dashboard.",
      },
      { property: "og:title", content: "Website content — Bazar Bari" },
      { property: "og:description", content: "Edit public website texts from the dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SiteContentPage,
});

function SiteContentPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">
          {bn ? "ওয়েবসাইট কনটেন্ট" : "Website content"}
        </h1>
        <TextSizeToggle />
      </div>
      <div className="surface-panel mt-4 max-w-4xl p-5">
        <SiteContentEditor />
      </div>
    </div>
  );
}
