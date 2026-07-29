import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";

export type SiteContentRow = {
  id: string;
  key: string;
  group_name: string;
  label: string;
  kind: string;
  value_bn: string;
  value_en: string;
  sort_order: number;
};

export const SITE_CONTENT_KEY = ["site-content"] as const;

async function fetchSiteContent(): Promise<SiteContentRow[]> {
  const { data, error } = await supabase
    .from("site_content")
    .select("id,key,group_name,label,kind,value_bn,value_en,sort_order")
    .order("group_name")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as SiteContentRow[];
}

/** All editable site texts, live-updated when an admin saves. */
export function useSiteContent() {
  const { lang } = useI18n();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SITE_CONTENT_KEY,
    queryFn: fetchSiteContent,
    staleTime: 60_000,
  });

  useEffect(() => {
    const channel = supabase
      .channel("site-content-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "site_content" }, () => {
        queryClient.invalidateQueries({ queryKey: SITE_CONTENT_KEY });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const rows = query.data ?? [];

  /** Text for a key in the active language, falling back to the given default. */
  const text = (key: string, fallback = "") => {
    const row = rows.find((r) => r.key === key);
    if (!row) return fallback;
    const value = (lang === "bn" ? row.value_bn : row.value_en)?.trim();
    const other = (lang === "bn" ? row.value_en : row.value_bn)?.trim();
    return value || other || fallback;
  };

  return { rows, text, isLoading: query.isLoading };
}
