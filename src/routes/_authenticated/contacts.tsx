import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { money, useI18n } from "@/lib/i18n";
import { registerMember } from "@/lib/loyalty";

export const Route = createFileRoute("/_authenticated/contacts")({
  head: () => ({
    meta: [
      { title: "Customers & suppliers — Sokoler Bazar" },
      { name: "description", content: "Keep customer and supplier records with balances in one place." },
      { property: "og:title", content: "Customers & suppliers — Sokoler Bazar" },
      { property: "og:description", content: "Customer and supplier records with balances." },
    ],
  }),
  component: ContactsPage,
});

type Contact = {
  id: string;
  type: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  is_member?: boolean | null;
  loyalty_points?: number | null;
};

const emptyForm = { type: "customer", name: "", phone: "", email: "", address: "", opening_balance: "0" };

const schema = z.object({
  type: z.enum(["customer", "supplier"]),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(20),
  email: z.string().trim().max(120),
  address: z.string().trim().max(200),
  opening_balance: z.number().min(-10_000_000).max(10_000_000),
});

function ContactsPage() {
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"customer" | "supplier">("customer");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").order("name");
      if (error) throw error;
      return data as unknown as Contact[];
    },
  });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (contacts.data ?? []).filter(
      (c) => c.type === tab && (!q || c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)),
    );
  }, [contacts.data, query, tab]);

  const save = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ ...form, opening_balance: Number(form.opening_balance) });
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const payload = {
        ...parsed.data,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        address: parsed.data.address || null,
      };
      if (editing) {
        const { error } = await supabase.from("contacts").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setOpen(false);
      setEditing(null);
      setForm({ ...emptyForm, type: tab });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("save"));
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const makeMember = useMutation({
    mutationFn: async (c: Contact) => {
      if (!c.phone) throw new Error(lang === "bn" ? "ফোন নম্বর প্রয়োজন" : "Phone number required");
      await registerMember(c.phone, c.name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(lang === "bn" ? "সদস্য হয়ে গেছে" : "Member added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contacts"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">{t("contacts")}</h1>
        <div className="flex flex-wrap gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("name")}
              maxLength={60}
              className="w-48 pl-9"
            />
          </div>
          <Button
            onClick={() => {
              setEditing(null);
              setForm({ ...emptyForm, type: tab });
              setOpen(true);
            }}
          >
            <Plus className="mr-1 size-4" /> {t("addContact")}
          </Button>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        {(["customer", "supplier"] as const).map((k) => (
          <Button key={k} size="sm" variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)}>
            {k === "customer" ? t("customers") : t("suppliers")}
          </Button>
        ))}
      </div>

      <div className="surface-panel mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">{t("name")}</th>
              <th className="px-4 py-3">{t("phone")}</th>
              <th className="px-4 py-3">{t("address")}</th>
              {tab === "customer" && (
                <th className="px-4 py-3">{lang === "bn" ? "সদস্যপদ" : "Membership"}</th>
              )}
              <th className="px-4 py-3 text-right">{t("openingBalance")}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.isLoading && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  {t("loading")}
                </td>
              </tr>
            )}
            {visible.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.phone || "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{c.address || "—"}</td>
                {tab === "customer" && (
                  <td className="px-4 py-3">
                    {c.is_member ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {lang === "bn" ? "সদস্য" : "Member"} · {Number(c.loyalty_points ?? 0)}{" "}
                        {lang === "bn" ? "পয়েন্ট" : "pts"}
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={!c.phone || makeMember.isPending}
                        onClick={() => makeMember.mutate(c)}
                      >
                        {lang === "bn" ? "সদস্য করুন" : "Make member"}
                      </Button>
                    )}
                  </td>
                )}
                <td className="px-4 py-3 text-right">{money(Number(c.opening_balance), lang)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => {
                        setEditing(c);
                        setForm({
                          type: c.type,
                          name: c.name,
                          phone: c.phone ?? "",
                          email: c.email ?? "",
                          address: c.address ?? "",
                          opening_balance: String(c.opening_balance),
                        });
                        setOpen(true);
                      }}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive"
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!contacts.isLoading && visible.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={6}>
                  {t("noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("editContact") : t("addContact")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t("type")}</Label>
              <div className="flex gap-2">
                {(["customer", "supplier"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant={form.type === k ? "default" : "outline"}
                    onClick={() => setForm({ ...form, type: k })}
                  >
                    {k === "customer" ? t("customers") : t("suppliers")}
                  </Button>
                ))}
              </div>
            </div>
            <F label={t("name")} value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <F label={t("phone")} value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <F label={t("email")} value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <F
              label={t("openingBalance")}
              value={form.opening_balance}
              onChange={(v) => setForm({ ...form, opening_balance: v })}
            />
            <div className="sm:col-span-2">
              <F label={t("address")} value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function F({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input value={value} maxLength={200} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
