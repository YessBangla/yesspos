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

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
/** Images wider/taller than this get resized before upload. */
const MAX_DIMENSION = 1600;

/** Returns an error message when the file cannot be accepted, otherwise null. */
export function validateImageFile(file: File, bn: boolean): string | null {
  if (!file.type.startsWith("image/") || !ALLOWED_MIME.includes(file.type)) {
    return bn
      ? "শুধু JPG, PNG, WEBP, GIF বা SVG ফরম্যাট চলবে"
      : "Only JPG, PNG, WEBP, GIF or SVG files are allowed";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return bn
      ? `ফাইলটি ${formatBytes(file.size)} — সর্বোচ্চ ১০ MB পর্যন্ত চলবে`
      : `File is ${formatBytes(file.size)} — the limit is 10 MB`;
  }
  return null;
}

/** Downscales + re-encodes large raster images to WEBP to save storage. */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (typeof document === "undefined") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 350 * 1024) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();

    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp" });
  } catch {
    return file;
  }
}

/** Uploads one file to the gallery bucket and records it in media_assets. */
export async function uploadMedia(rawFile: File, folder: string) {
  const file = await compressImage(rawFile);
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


export type MediaUsage = { kind: "product" | "brand" | "content"; label: string; id: string };

/** Where each gallery image is currently used across the site. */
export async function fetchMediaUsage(): Promise<Record<string, MediaUsage[]>> {
  const [products, brands, content] = await Promise.all([
    supabase.from("products").select("id,name_en,name_bn,image_url").not("image_url", "is", null).limit(3000),
    supabase.from("brands").select("id,name_en,logo_url").not("logo_url", "is", null).limit(500),
    supabase.from("site_content").select("id,label,value_en").limit(500),
  ]);

  const map: Record<string, MediaUsage[]> = {};
  const add = (url: string | null, u: MediaUsage) => {
    if (!url) return;
    (map[url] ||= []).push(u);
  };
  for (const p of products.data ?? []) add(p.image_url, { kind: "product", label: p.name_en, id: p.id });
  for (const b of brands.data ?? []) add(b.logo_url, { kind: "brand", label: b.name_en, id: b.id });
  for (const c of content.data ?? []) {
    if (/^(https?:\/\/|\/).+\.(jpg|jpeg|png|webp|gif|svg)$/i.test(c.value_en ?? "")) {
      add(c.value_en, { kind: "content", label: c.label, id: c.id });
    }
  }
  return map;
}

export function usageKindLabel(kind: MediaUsage["kind"], bn: boolean) {
  if (kind === "product") return bn ? "পণ্য" : "Product";
  if (kind === "brand") return bn ? "ব্র্যান্ড" : "Brand";
  return bn ? "ওয়েবসাইট কনটেন্ট" : "Website content";
}

/** Assigns one gallery image as the cover image of several products at once. */
export async function assignImageToProducts(url: string, productIds: string[]) {
  if (!productIds.length) return 0;
  const { error } = await supabase.from("products").update({ image_url: url }).in("id", productIds);
  if (error) throw error;
  return productIds.length;
}
