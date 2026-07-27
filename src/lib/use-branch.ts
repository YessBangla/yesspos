import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Branch = {
  id: string;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
};

/** All branches of the business. */
export function useBranches() {
  return useQuery({
    queryKey: ["branches"],
    staleTime: 60_000,
    queryFn: async (): Promise<Branch[]> => {
      const { data, error } = await supabase.from("branches").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Branch[];
    },
  });
}

/** The branch the signed-in user belongs to. */
export function useMyBranch() {
  return useQuery({
    queryKey: ["my-branch"],
    staleTime: 60_000,
    queryFn: async (): Promise<Branch | null> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("branch_id")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.branch_id) return null;
      const { data: branch } = await supabase
        .from("branches")
        .select("*")
        .eq("id", profile.branch_id)
        .maybeSingle();
      return (branch ?? null) as Branch | null;
    },
  });
}

/** product_id -> stock quantity for one branch. */
export function useBranchStock(branchId: string | null | undefined) {
  return useQuery({
    queryKey: ["branch-stock", branchId],
    enabled: !!branchId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_stock")
        .select("product_id,stock")
        .eq("branch_id", branchId as string);
      if (error) throw error;
      return new Map<string, number>((data ?? []).map((r) => [r.product_id, Number(r.stock ?? 0)]));
    },
  });
}
