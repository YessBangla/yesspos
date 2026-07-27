import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, KeyRound, Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { downloadCsv, logAudit } from "@/lib/audit";
import { APP_ROLES, createAppUser, deleteAppUser, setUserPassword, type AppRole } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({
    meta: [
      { title: "Users & roles — SheraPOS" },
      { name: "description", content: "Create shop staff accounts and assign Super Admin, Admin, Manager, Cashier or Staff roles." },
      { property: "og:title", content: "Users & roles — SheraPOS" },
      { property: "og:description", content: "Manage staff accounts and their permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: UsersPage,
});

const roleKey: Record<AppRole, "roleSuperAdmin" | "roleAdmin" | "roleManager" | "roleCashier" | "roleStaff"> = {
  super_admin: "roleSuperAdmin",
  admin: "roleAdmin",
  manager: "roleManager",
  cashier: "roleCashier",
  staff: "roleStaff",
};

const emptyForm = { username: "", password: "", fullName: "", role: "cashier" as AppRole };

function UsersPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [pwFor, setPwFor] = useState<string | null>(null);
  const [newPw, setNewPw] = useState("");

  const createFn = useServerFn(createAppUser);
  const passwordFn = useServerFn(setUserPassword);
  const deleteFn = useServerFn(deleteAppUser);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
  });

  const roles = useQuery({
    queryKey: ["user_roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data as { user_id: string; role: AppRole }[];
    },
  });

  const isAdmin = useMemo(() => {
    const mine = (roles.data ?? []).filter((r) => r.user_id === me.data?.id).map((r) => r.role);
    return mine.includes("admin") || mine.includes("super_admin");
  }, [roles.data, me.data]);

  const profiles = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, username, created_at");
      if (error) throw error;
      return data as { id: string; full_name: string | null; username: string | null; created_at: string }[];
    },
  });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (profiles.data ?? [])
      .map((p) => ({
        ...p,
        role:
          (roles.data ?? [])
            .filter((r) => r.user_id === p.id)
            .sort((a, b) => APP_ROLES.indexOf(a.role) - APP_ROLES.indexOf(b.role))[0]?.role ??
          ("cashier" as AppRole),
      }))
      .filter(
        (p) =>
          !q ||
          (p.username ?? "").toLowerCase().includes(q) ||
          (p.full_name ?? "").toLowerCase().includes(q),
      )
      .sort((a, b) => (a.username ?? "").localeCompare(b.username ?? ""));
  }, [profiles.data, roles.data, query]);

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["profiles"] });
    queryClient.invalidateQueries({ queryKey: ["user_roles"] });
  }

  const create = useMutation({
    mutationFn: async () => createFn({ data: form }),
    onSuccess: () => {
      toast.success(t("userCreated"));
      void logAudit("user_create", { entity: "user", details: `${form.username} (${form.role})` });
      setOpen(false);
      setForm({ ...emptyForm });
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      void logAudit("role_update", { entity: "user", entityId: userId, details: role });
      const del = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (del.error) throw del.error;
      const ins = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (ins.error) throw ins.error;
    },
    onSuccess: () => {
      toast.success(t("roleUpdated"));
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const resetPw = useMutation({
    mutationFn: async () => passwordFn({ data: { userId: pwFor!, password: newPw } }),
    onSuccess: () => {
      toast.success(t("passwordUpdated"));
      void logAudit("password_reset", { entity: "user", entityId: pwFor ?? undefined });
      setPwFor(null);
      setNewPw("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeUser = useMutation({
    mutationFn: async (userId: string) => {
      const r = await deleteFn({ data: { userId } });
      void logAudit("user_delete", { entity: "user", entityId: userId });
      return r;
    },
    onSuccess: () => {
      toast.success(t("userDeleted"));
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (roles.isLoading || me.isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">…</div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-6">
        <div className="surface-panel mx-auto max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto size-8 text-muted-foreground" />
          <h1 className="mt-3 text-lg font-semibold">{t("usersRoles")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("adminOnly")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t("usersRoles")}</h1>
          <p className="text-sm text-muted-foreground">{t("usersRolesHint")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv(
                `users-roles-${new Date().toISOString().slice(0, 10)}.csv`,
                ["Username", "Full name", "Role", "Created at"],
                rows.map((u) => [
                  u.username ?? "",
                  u.full_name ?? "",
                  u.role,
                  new Date(u.created_at).toLocaleString(),
                ]),
              )
            }
          >
            <Download className="mr-2 size-4" /> {t("exportCsv")}
          </Button>
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-2 size-4" /> {t("addUser")}
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("searchUser")} />
      </div>

      <div className="surface-panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-b border-border text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("username")}</th>
              <th className="px-4 py-3 font-medium">{t("fullName")}</th>
              <th className="px-4 py-3 font-medium">{t("role")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3 font-medium">{u.username ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.full_name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Select
                    value={u.role}
                    onValueChange={(role) => changeRole.mutate({ userId: u.id, role: role as AppRole })}
                  >
                    <SelectTrigger className="w-44">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {APP_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {t(roleKey[r])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setPwFor(u.id)} title={t("resetPassword")}>
                      <KeyRound className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={u.id === me.data?.id}
                      onClick={() => removeUser.mutate(u.id)}
                      title={t("delete")}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  —
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("addUser")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="u-name">{t("username")}</Label>
              <Input
                id="u-name"
                value={form.username}
                maxLength={24}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-full">{t("fullName")}</Label>
              <Input id="u-full" value={form.fullName} maxLength={80} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u-pw">{t("password")}</Label>
              <Input id="u-pw" value={form.password} minLength={6} maxLength={72} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("role")}</Label>
              <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as AppRole })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {APP_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {t(roleKey[r])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={create.isPending} onClick={() => create.mutate()}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={pwFor !== null} onOpenChange={(v) => !v && setPwFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("resetPassword")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={newPw} minLength={6} maxLength={72} onChange={(e) => setNewPw(e.target.value)} placeholder={t("password")} />
            <Button className="w-full" disabled={resetPw.isPending} onClick={() => resetPw.mutate()}>
              {t("save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
