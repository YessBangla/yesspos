import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Copy, Loader2, Trash2, Upload, Check, Search, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  MEDIA_FOLDERS,
  deleteMedia,
  folderLabel,
  formatBytes,
  listMedia,
  uploadMedia,
  syncSiteImages,
  type MediaAsset,
} from "@/lib/media";

export function MediaLibrary({
  onPick,
  compact = false,
}: {
  onPick?: (asset: MediaAsset) => void;
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>("general");
  const [filter, setFilter] = useState<string>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  const assets = useQuery({ queryKey: ["media-assets"], queryFn: listMedia });

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (assets.data ?? []).filter((a) => {
      if (filter !== "all" && a.folder !== filter) return false;
      if (!term) return true;
      return (
        a.name.toLowerCase().includes(term) ||
        (a.alt_text ?? "").toLowerCase().includes(term) ||
        a.tags.join(" ").toLowerCase().includes(term)
      );
    });
  }, [assets.data, filter, q]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        await uploadMedia(file, folder);
        ok += 1;
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) toast.success(bn ? `${ok}টি ছবি আপলোড হয়েছে` : `${ok} image(s) uploaded`);
    qc.invalidateQueries({ queryKey: ["media-assets"] });
  }

  const sync = useMutation({
    mutationFn: syncSiteImages,
    onSuccess: (n) => {
      toast.success(
        n
          ? bn
            ? `${n}টি সাইটের ছবি গ্যালারিতে যোগ হয়েছে`
            : `${n} site image(s) added to the gallery`
          : bn
            ? "সব ছবি আগে থেকেই গ্যালারিতে আছে"
            : "All site images are already in the gallery",
      );
      qc.invalidateQueries({ queryKey: ["media-assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Sync failed"),
  });

  // First visit: pull every image already used on the site into the gallery.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || assets.isLoading) return;
    if ((assets.data ?? []).length > 0) return;
    autoRan.current = true;
    sync.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets.isLoading, assets.data]);

  const remove = useMutation({
    mutationFn: (a: MediaAsset) => deleteMedia(a),
    onSuccess: () => {
      toast.success(bn ? "ছবি মুছে ফেলা হয়েছে" : "Image deleted");
      qc.invalidateQueries({ queryKey: ["media-assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const saveMeta = useMutation({
    mutationFn: async (a: { id: string; alt_text: string; tags: string[] }) => {
      const { error } = await supabase
        .from("media_assets")
        .update({ alt_text: a.alt_text || null, tags: a.tags })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(bn ? "সংরক্ষিত" : "Saved");
      qc.invalidateQueries({ queryKey: ["media-assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">
            {bn ? "ফোল্ডার (আপলোডের জন্য)" : "Folder (for upload)"}
          </label>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          >
            {MEDIA_FOLDERS.map((f) => (
              <option key={f} value={f}>
                {folderLabel(f, bn)}
              </option>
            ))}
          </select>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Upload className="mr-2 size-4" />}
          {bn ? "ছবি আপলোড" : "Upload images"}
        </Button>
        <Button variant="outline" onClick={() => sync.mutate()} disabled={sync.isPending}>
          {sync.isPending ? (
            <Loader2 className="mr-2 size-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 size-4" />
          )}
          {bn ? "সাইটের ছবি আনুন" : "Import site images"}
        </Button>

        <div className="ml-auto flex flex-wrap items-end gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="w-52 pl-9"
              placeholder={bn ? "নাম / ট্যাগ খুঁজুন" : "Search name / tag"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">{bn ? "সব ফোল্ডার" : "All folders"}</option>
            {MEDIA_FOLDERS.map((f) => (
              <option key={f} value={f}>
                {folderLabel(f, bn)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFiles(e.dataTransfer.files);
        }}
        className="rounded-2xl border border-dashed border-border p-3"
      >
        {assets.isLoading ? (
          <p className="p-6 text-center text-sm text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : items.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {bn
              ? "কোনো ছবি নেই। 'সাইটের ছবি আনুন' চাপুন, বা ছবি আপলোড করুন / এখানে টেনে ছাড়ুন।"
              : "No images yet. Click “Upload images” or drag & drop files here."}
          </p>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 130 : 160}px, 1fr))` }}
          >
            {items.map((a) => (
              <MediaCard
                key={a.id}
                asset={a}
                bn={bn}
                onPick={onPick}
                onDelete={() => remove.mutate(a)}
                onSaveMeta={(alt, tags) => saveMeta.mutate({ id: a.id, alt_text: alt, tags })}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {bn
          ? "টিপস: আপলোড করা ছবির লিংক কপি করে পণ্য, ব্র্যান্ড বা ওয়েবসাইট কনটেন্টে ব্যবহার করা যাবে।"
          : "Tip: copy an image link and reuse it in products, brands or website content."}
      </p>
    </div>
  );
}

function MediaCard({
  asset,
  bn,
  onPick,
  onDelete,
  onSaveMeta,
}: {
  asset: MediaAsset;
  bn: boolean;
  onPick?: (a: MediaAsset) => void;
  onDelete: () => void;
  onSaveMeta: (alt: string, tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [alt, setAlt] = useState(asset.alt_text ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [copied, setCopied] = useState(false);

  return (
    <div className="group overflow-hidden rounded-xl border border-border bg-card">
      <button
        type="button"
        className={cn("block w-full", onPick && "cursor-pointer")}
        onClick={() => onPick?.(asset)}
        title={onPick ? (bn ? "এই ছবিটি বেছে নিন" : "Use this image") : asset.name}
      >
        <img
          src={asset.url}
          alt={asset.alt_text ?? asset.name}
          loading="lazy"
          className="aspect-square w-full bg-muted object-cover transition group-hover:scale-[1.02]"
        />
      </button>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {folderLabel(asset.folder, bn)} · {formatBytes(asset.size_bytes)}
        </p>
        {editing ? (
          <div className="space-y-1 pt-1">
            <Input
              className="h-8 text-xs"
              value={alt}
              maxLength={120}
              placeholder={bn ? "বিকল্প টেক্সট" : "Alt text"}
              onChange={(e) => setAlt(e.target.value)}
            />
            <Input
              className="h-8 text-xs"
              value={tags}
              maxLength={160}
              placeholder={bn ? "ট্যাগ, কমা দিয়ে" : "tags, comma separated"}
              onChange={(e) => setTags(e.target.value)}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => {
                  onSaveMeta(
                    alt.trim(),
                    tags
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                  );
                  setEditing(false);
                }}
              >
                {bn ? "সেভ" : "Save"}
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditing(false)}>
                {bn ? "বাতিল" : "Cancel"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-1 pt-1">
            {onPick ? (
              <Button size="sm" className="h-7 flex-1 text-xs" onClick={() => onPick(asset)}>
                {bn ? "ব্যবহার করুন" : "Use"}
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2"
              title={bn ? "লিংক কপি" : "Copy link"}
              onClick={async () => {
                await navigator.clipboard.writeText(asset.url);
                setCopied(true);
                toast.success(bn ? "লিংক কপি হয়েছে" : "Link copied");
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => setEditing(true)}
              title={bn ? "তথ্য সম্পাদনা" : "Edit info"}
            >
              ✎
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-destructive"
              onClick={() => {
                if (confirm(bn ? "ছবিটি মুছে ফেলবেন?" : "Delete this image?")) onDelete();
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
