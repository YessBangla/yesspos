import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "media-gallery";
/** ~10 years, so gallery links stay usable anywhere in the app/storefront. */
export const MEDIA_URL_TTL = 60 * 60 * 24 * 365 * 10;

export type MediaAsset = {
  id: string;
  path: string;
  url: string;
  name: string;
  folder: string;
  tags: string[];
  alt_text: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export const MEDIA_FOLDERS = [
  "general",
  "products",
  "brands",
  "banners",
  "categories",
  "staff",
] as const;

export function folderLabel(folder: string, bn: boolean) {
  const map: Record<string, [string, string]> = {
    general: ["সাধারণ", "General"],
    products: ["পণ্য", "Products"],
    brands: ["ব্র্যান্ড", "Brands"],
    banners: ["ব্যানার", "Banners"],
    categories: ["ক্যাটাগরি", "Categories"],
    staff: ["স্টাফ", "Staff"],
  };
  const hit = map[folder];
  return hit ? (bn ? hit[0] : hit[1]) : folder;
}

export function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function slug(name: string) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : "jpg";
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `${base || "image"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
}

export async function signedUrl(path: string) {
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, MEDIA_URL_TTL);
  if (error) throw error;
  return data.signedUrl;
}

/** Uploads one file to the gallery bucket and records it in media_assets. */
export async function uploadMedia(file: File, folder: string) {
  const path = `${folder}/${slug(file.name)}`;
  const up = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: file.type || undefined,
    upsert: false,
  });
  if (up.error) throw up.error;

  const url = await signedUrl(path);
  const { data: userRes } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      path,
      url,
      name: file.name,
      folder,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: userRes.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as MediaAsset;
}

export async function deleteMedia(asset: Pick<MediaAsset, "id" | "path">) {
  await supabase.storage.from(MEDIA_BUCKET).remove([asset.path]);
  const { error } = await supabase.from("media_assets").delete().eq("id", asset.id);
  if (error) throw error;
}

export async function listMedia() {
  const { data, error } = await supabase
    .from("media_assets")
    .select("id,path,url,name,folder,tags,alt_text,mime_type,size_bytes,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as MediaAsset[];
}

/**
 * Registers every image already used on the site (bundled files, product images,
 * brand logos and site-content banners) into the gallery, skipping duplicates.
 */
export async function syncSiteImages() {
  const { SITE_PRODUCT_IMAGES, SITE_OTHER_IMAGES } = await import("./site-images");

  const existing = await supabase.from("media_assets").select("url");
  if (existing.error) throw existing.error;
  const seen = new Set((existing.data ?? []).map((r) => r.url));

  type Row = { path: string; url: string; name: string; folder: string; tags: string[] };
  const rows: Row[] = [];
  const push = (url: string | null, name: string, folder: string, tag: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    rows.push({ path: `site:${url}`, url, name: name || url.split("/").pop() || "image", folder, tags: [tag] });
  };

  for (const i of SITE_PRODUCT_IMAGES) push(i.url, i.name, "products", "site");
  for (const i of SITE_OTHER_IMAGES) push(i.url, i.name, i.folder, "site");

  const [products, brands, content] = await Promise.all([
    supabase.from("products").select("name_en,image_url").not("image_url", "is", null).limit(2000),
    supabase.from("brands").select("name_en,logo_url").not("logo_url", "is", null).limit(500),
    supabase.from("site_content").select("label,value_en").limit(500),
  ]);
  for (const p of products.data ?? []) push(p.image_url, p.name_en, "products", "product");
  for (const b of brands.data ?? []) push(b.logo_url, b.name_en, "brands", "brand");
  for (const c of content.data ?? []) {
    if (/^(https?:\/\/|\/).+\.(jpg|jpeg|png|webp|gif|svg)$/i.test(c.value_en ?? "")) {
      push(c.value_en, c.label, "banners", "site");
    }
  }

  let added = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { error } = await supabase.from("media_assets").upsert(chunk, { onConflict: "path", ignoreDuplicates: true });
    if (error) throw error;
    added += chunk.length;
  }
  return added;
}
