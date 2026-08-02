import { createFileRoute } from "@tanstack/react-router";
import { MediaLibrary } from "@/components/MediaLibrary";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/media")({
  head: () => ({
    meta: [
      { title: "Image gallery — Bazar Bari" },
      {
        name: "description",
        content: "Store, organise and reuse product, brand and banner images from one dashboard gallery.",
      },
      { property: "og:title", content: "Image gallery — Bazar Bari" },
      { property: "og:description", content: "Upload once, reuse images anywhere in the POS and storefront." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MediaPage,
});

function MediaPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  return (
    <div className="p-4">
      <h1 className="font-display text-2xl font-bold">{bn ? "ইমেজ গ্যালারি" : "Image gallery"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {bn
          ? "একবার আপলোড করুন, পণ্য-ব্র্যান্ড-ব্যানার যেকোনো জায়গায় ব্যবহার করুন।"
          : "Upload once and reuse the same image for products, brands and banners."}
      </p>
      <div className="surface-panel mt-4 p-5">
        <MediaLibrary />
      </div>
    </div>
  );
}
