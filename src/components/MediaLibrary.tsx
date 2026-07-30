import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Copy,
  Loader2,
  Trash2,
  Upload,
  Check,
  Search,
  RefreshCw,
  FolderOpen,
  Link2,
  AlertTriangle,
  Undo2,
  History,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { useMyRole } from "@/lib/use-my-role";
import { canDeleteMedia, canEditMedia, canViewMediaLog } from "@/lib/permissions";
import {
  MEDIA_FOLDERS,
  TRASH_RETENTION_DAYS,
  daysLeftInTrash,
  deleteMedia,
  fetchMediaUsage,
  folderLabel,
  formatBytes,
  listMedia,
  listMediaLog,
  listTrashedMedia,
  logMediaAction,
  pickVariant,
  purgeMedia,
  restoreMedia,
  uploadMedia,
  usageKindLabel,
  variantSrcSet,
  syncSiteImages,
  validateImageFile,
  type MediaAsset,
  type MediaUsage,
} from "@/lib/media";


type UsageFilter = "all" | "used" | "unused";

export function MediaLibrary({
  onPick,
  onPickMany,
  compact = false,
}: {
  onPick?: (asset: MediaAsset) => void;
  /** When provided the gallery turns into a multi-select picker. */
  onPickMany?: (assets: MediaAsset[]) => void;
  compact?: boolean;
}) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>("general");
  const [filter, setFilter] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [view, setView] = useState<"gallery" | "trash" | "log">("gallery");

  const me = useMyRole();
  const mayEdit = canEditMedia(me.data?.role);
  const mayDelete = canDeleteMedia(me.data?.role);
  const mayViewLog = canViewMediaLog(me.data?.role);

  const assets = useQuery({ queryKey: ["media-assets"], queryFn: listMedia });
  const usage = useQuery({ queryKey: ["media-usage"], queryFn: fetchMediaUsage, staleTime: 30_000 });
  const trash = useQuery({
    queryKey: ["media-trash"],
    queryFn: listTrashedMedia,
    enabled: view === "trash" && mayDelete,
  });
  const log = useQuery({ queryKey: ["media-log"], queryFn: listMediaLog, enabled: view === "log" && mayViewLog });
  const usageFor = (a: MediaAsset): MediaUsage[] => usage.data?.[a.url] ?? [];


  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const a of assets.data ?? []) a.tags.forEach((t) => set.add(t));
    return [...set].sort();
  }, [assets.data]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: 0 };
    for (const a of assets.data ?? []) {
      m.all += 1;
      m[a.folder] = (m[a.folder] ?? 0) + 1;
    }
    return m;
  }, [assets.data]);

  const items = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (assets.data ?? []).filter((a) => {
      if (filter !== "all" && a.folder !== filter) return false;
      if (tag !== "all" && !a.tags.includes(tag)) return false;
      if (usageFilter !== "all") {
        const used = (usage.data?.[a.url] ?? []).length > 0;
        if (usageFilter === "used" && !used) return false;
        if (usageFilter === "unused" && used) return false;
      }
      if (!term) return true;
      return (
        a.name.toLowerCase().includes(term) ||
        (a.alt_text ?? "").toLowerCase().includes(term) ||
        a.folder.toLowerCase().includes(term) ||
        a.tags.join(" ").toLowerCase().includes(term)
      );
    });
  }, [assets.data, filter, tag, usageFilter, usage.data, q]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    let ok = 0;
    let saved = 0;
    for (const file of Array.from(files)) {
      const invalid = validateImageFile(file, bn);
      if (invalid) {
        toast.error(`${file.name}: ${invalid}`);
        continue;
      }
      try {
        const asset = await uploadMedia(file, folder);
        ok += 1;
        saved += Math.max(0, file.size - (asset.size_bytes ?? file.size));
      } catch (e) {
        toast.error(`${file.name}: ${e instanceof Error ? e.message : "upload failed"}`);
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (ok) {
      const extra = saved > 1024 ? (bn ? ` · ${formatBytes(saved)} সাশ্রয়` : ` · saved ${formatBytes(saved)}`) : "";
      toast.success((bn ? `${ok}টি ছবি আপলোড হয়েছে` : `${ok} image(s) uploaded`) + extra);
    }
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
      qc.invalidateQueries({ queryKey: ["media-usage"] });
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
      qc.invalidateQueries({ queryKey: ["media-usage"] });
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

  const selectable = Boolean(onPickMany);
  const selectedAssets = (assets.data ?? []).filter((a) => selected.includes(a.id));

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
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
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
              className="w-56 pl-9"
              placeholder={bn ? "নাম, ট্যাগ বা অল্ট টেক্সট" : "Name, tag or alt text"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="all">{bn ? "সব ট্যাগ" : "All tags"}</option>
            {allTags.map((tg) => (
              <option key={tg} value={tg}>
                #{tg}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
            value={usageFilter}
            onChange={(e) => setUsageFilter(e.target.value as UsageFilter)}
          >
            <option value="all">{bn ? "ব্যবহার: সব" : "Usage: all"}</option>
            <option value="used">{bn ? "শুধু ব্যবহৃত" : "Used only"}</option>
            <option value="unused">{bn ? "শুধু যেগুলো ব্যবহার হয়নি" : "Unused only"}</option>
          </select>
        </div>
      </div>

      {/* Folder navigation */}
      <div className="flex flex-wrap items-center gap-2">
        <FolderOpen className="size-4 text-muted-foreground" />
        {["all", ...MEDIA_FOLDERS].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-semibold transition",
              filter === f
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-primary/50",
            )}
          >
            {f === "all" ? (bn ? "সব" : "All") : folderLabel(f, bn)}
            <span className="ml-1 opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
        {(tag !== "all" || usageFilter !== "all" || q) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setTag("all");
              setUsageFilter("all");
              setQ("");
            }}
          >
            {bn ? "ফিল্টার সরান" : "Clear filters"}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {bn ? `${items.length}টি ছবি` : `${items.length} images`}
        </span>
      </div>

      {selectable && selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 p-2">
          <span className="text-sm font-semibold">
            {bn ? `${selected.length}টি ছবি নির্বাচিত` : `${selected.length} selected`}
          </span>
          <div className="flex flex-wrap gap-1">
            {selectedAssets.slice(0, 8).map((a) => (
              <img key={a.id} src={a.url} alt="" className="size-9 rounded-md border border-border object-cover" />
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              {bn ? "বাতিল" : "Clear"}
            </Button>
            <Button size="sm" onClick={() => onPickMany?.(selectedAssets)}>
              {bn ? "নির্বাচিত ছবি ব্যবহার করুন" : "Use selected"}
            </Button>
          </div>
        </div>
      )}

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
              ? "এই ফিল্টারে কোনো ছবি নেই। 'সাইটের ছবি আনুন' চাপুন, ফিল্টার সরান, বা ছবি আপলোড করুন।"
              : "No images for this filter. Import site images, clear filters, or upload new files."}
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
                usage={usageFor(a)}
                onPick={onPick}
                selectable={selectable}
                checked={selected.includes(a.id)}
                onToggle={() =>
                  setSelected((s) => (s.includes(a.id) ? s.filter((x) => x !== a.id) : [...s, a.id]))
                }
                onDelete={() => remove.mutate(a)}
                onSaveMeta={(alt, tags) => saveMeta.mutate({ id: a.id, alt_text: alt, tags })}
              />
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {bn
          ? "টিপস: বড় ছবি আপলোডের সময় স্বয়ংক্রিয়ভাবে ছোট (WEBP) করা হয়। ব্যবহৃত ছবি মুছতে গেলে সতর্কবার্তা দেখাবে।"
          : "Tip: large uploads are auto-compressed to WEBP, and images in use warn before deletion."}
      </p>
    </div>
  );
}

function MediaCard({
  asset,
  bn,
  usage,
  onPick,
  onDelete,
  onSaveMeta,
  selectable,
  checked,
  onToggle,
}: {
  asset: MediaAsset;
  bn: boolean;
  usage: MediaUsage[];
  onPick?: (a: MediaAsset) => void;
  onDelete: () => void;
  onSaveMeta: (alt: string, tags: string[]) => void;
  selectable?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [alt, setAlt] = useState(asset.alt_text ?? "");
  const [tags, setTags] = useState(asset.tags.join(", "));
  const [copied, setCopied] = useState(false);

  const used = usage.length > 0;

  function confirmDelete() {
    if (used) {
      const list = usage
        .slice(0, 5)
        .map((u) => `• ${usageKindLabel(u.kind, bn)}: ${u.label}`)
        .join("\n");
      const more = usage.length > 5 ? (bn ? `\n… আরও ${usage.length - 5}টি` : `\n… ${usage.length - 5} more`) : "";
      const msg = bn
        ? `সতর্কতা! এই ছবিটি এখন ${usage.length} জায়গায় ব্যবহার হচ্ছে:\n${list}${more}\n\nমুছে ফেললে ওইসব জায়গায় ছবি ভাঙা দেখাবে। তবুও মুছবেন?`
        : `Warning! This image is used in ${usage.length} place(s):\n${list}${more}\n\nDeleting it will break those images. Delete anyway?`;
      if (!confirm(msg)) return;
      const second = bn
        ? "নিশ্চিত করতে আবার চাপুন — এটি ফেরানো যাবে না।"
        : "Press OK once more to confirm — this cannot be undone.";
      if (!confirm(second)) return;
    } else if (!confirm(bn ? "ছবিটি মুছে ফেলবেন?" : "Delete this image?")) {
      return;
    }
    onDelete();
  }

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-xl border bg-card",
        checked ? "border-primary ring-2 ring-primary/40" : "border-border",
      )}
    >
      <div className="relative">
        <button
          type="button"
          className={cn("block w-full", (onPick || selectable) && "cursor-pointer")}
          onClick={() => (selectable ? onToggle?.() : onPick?.(asset))}
          title={onPick ? (bn ? "এই ছবিটি বেছে নিন" : "Use this image") : asset.name}
        >
          <img
            src={asset.url}
            alt={asset.alt_text ?? asset.name}
            loading="lazy"
            className="aspect-square w-full bg-muted object-cover transition group-hover:scale-[1.02]"
          />
        </button>
        {selectable && (
          <span
            className={cn(
              "pointer-events-none absolute left-2 top-2 grid size-6 place-items-center rounded-md border bg-background/90",
              checked ? "border-primary text-primary" : "border-border text-transparent",
            )}
          >
            <Check className="size-4" />
          </span>
        )}
        <span
          className={cn(
            "absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            used ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
          )}
          title={used ? (bn ? "ব্যবহৃত হচ্ছে" : "In use") : bn ? "কোথাও ব্যবহার হয়নি" : "Not used"}
        >
          {used ? `${usage.length} ${bn ? "ব্যবহার" : "uses"}` : bn ? "অব্যবহৃত" : "unused"}
        </span>
      </div>
      <div className="space-y-1 p-2">
        <p className="truncate text-xs font-medium" title={asset.name}>
          {asset.name}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {folderLabel(asset.folder, bn)} · {formatBytes(asset.size_bytes)}
        </p>
        {asset.tags.length > 0 && (
          <p className="truncate text-[10px] text-primary">{asset.tags.map((t) => `#${t}`).join(" ")}</p>
        )}
        {showUsage && (
          <div className="max-h-28 space-y-0.5 overflow-y-auto rounded-lg bg-muted/60 p-1.5 text-[11px]">
            {used ? (
              usage.map((u, i) => (
                <p key={`${u.id}-${i}`} className="truncate">
                  <span className="font-semibold">{usageKindLabel(u.kind, bn)}:</span> {u.label}
                </p>
              ))
            ) : (
              <p className="flex items-center gap-1 text-muted-foreground">
                <AlertTriangle className="size-3" />
                {bn ? "কোথাও ব্যবহার হয়নি — মুছে ফেলা নিরাপদ" : "Not used anywhere — safe to delete"}
              </p>
            )}
          </div>
        )}
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
              title={bn ? "কোথায় ব্যবহার হচ্ছে" : "Where is it used"}
              onClick={() => setShowUsage((v) => !v)}
            >
              <Link2 className="size-3.5" />
            </Button>
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
              className={cn("h-7 px-2", used ? "text-warning-foreground" : "text-destructive")}
              title={used ? (bn ? "ব্যবহৃত ছবি — সতর্কতা" : "In use — warning") : bn ? "মুছুন" : "Delete"}
              onClick={confirmDelete}
            >
              {used ? <AlertTriangle className="size-3.5" /> : <Trash2 className="size-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
