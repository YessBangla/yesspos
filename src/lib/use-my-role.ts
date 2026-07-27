import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_ROLES, type AppRole } from "@/lib/users.functions";

/** Current user id + highest-priority role, cached across the app. */
export function useMyRole() {
  return useQuery({
    queryKey: ["my-role"],
    staleTime: 60_000,
    queryFn: async (): Promise<{ userId: string | null; username: string | null; role: AppRole | null }> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return { userId: null, username: null, role: null };

      const [{ data: roleRows }, { data: profile }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id),
        supabase.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      ]);

      const role =
        ((roleRows ?? []) as { role: AppRole }[])
          .map((r) => r.role)
          .sort((a, b) => APP_ROLES.indexOf(a) - APP_ROLES.indexOf(b))[0] ?? ("cashier" as AppRole);

      return { userId: user.id, username: profile?.username ?? user.email?.split("@")[0] ?? null, role };
    },
  });
}
