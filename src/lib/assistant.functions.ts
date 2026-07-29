import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AssistantTurn = { role: "user" | "assistant"; content: string };

type AskInput = { messages: AssistantTurn[]; lang?: "bn" | "en" };

function validate(input: unknown): AskInput {
  const raw = input as AskInput;
  if (!raw || !Array.isArray(raw.messages) || raw.messages.length === 0) {
    throw new Error("messages required");
  }
  const messages = raw.messages
    .slice(-12)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  return { messages, lang: raw.lang === "en" ? "en" : "bn" };
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("en-US")}`;
}

/** Ask the business assistant. Reads live shop data (as the signed-in user, RLS applies). */
export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const supabase = context.supabase;
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
    const dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();

    const [salesRes, lowStockRes, expenseRes, dueRes, topRes] = await Promise.all([
      supabase.from("sales").select("total,paid,created_at,status").gte("created_at", start).eq("status", "final"),
      supabase.from("products").select("name_en,name_bn,stock").lte("stock", 5).limit(15),
      supabase.from("expenses").select("amount,spent_on").gte("spent_on", start.slice(0, 10)),
      supabase
        .from("sales")
        .select("invoice_no,customer_name,total,paid")
        .eq("status", "final")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("sale_items").select("name_snapshot,quantity,line_total").limit(500),
    ]);

    const sales = salesRes.data ?? [];
    const monthTotal = sales.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const todayRows = sales.filter((r) => (r.created_at ?? "") >= dayStart);
    const todayTotal = todayRows.reduce((s, r) => s + Number(r.total ?? 0), 0);
    const expenseTotal = (expenseRes.data ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const dues = (dueRes.data ?? [])
      .map((r) => ({ ...r, due: Number(r.total ?? 0) - Number(r.paid ?? 0) }))
      .filter((r) => r.due > 0.5)
      .sort((a, b) => b.due - a.due)
      .slice(0, 10);
    const dueTotal = dues.reduce((s, r) => s + r.due, 0);

    const topMap = new Map<string, { qty: number; amount: number }>();
    for (const it of topRes.data ?? []) {
      const k = it.name_snapshot ?? "-";
      const cur = topMap.get(k) ?? { qty: 0, amount: 0 };
      cur.qty += Number(it.quantity ?? 0);
      cur.amount += Number(it.line_total ?? 0);
      topMap.set(k, cur);
    }
    const top = [...topMap.entries()].sort((a, b) => b[1].amount - a[1].amount).slice(0, 8);

    const snapshot = [
      `Today sales: ${money(todayTotal)} (${todayRows.length} invoices)`,
      `This month sales: ${money(monthTotal)} (${sales.length} invoices)`,
      `This month expenses: ${money(expenseTotal)}`,
      `Total outstanding due: ${money(dueTotal)}`,
      `Top due customers: ${dues.map((d) => `#${d.invoice_no} ${d.customer_name ?? "Walk-in"} = ${money(d.due)}`).join("; ") || "none"}`,
      `Best selling products: ${top.map(([n, v]) => `${n} (${v.qty} pcs, ${money(v.amount)})`).join("; ") || "none"}`,
      `Low stock products: ${(lowStockRes.data ?? []).map((p) => `${p.name_bn || p.name_en} = ${p.stock}`).join("; ") || "none"}`,
    ].join("\n");

    const system = [
      "You are the business assistant inside SokolerBazar, a point-of-sale and ERP app for shops in Bangladesh.",
      data.lang === "en"
        ? "Answer in clear English."
        : "উত্তর সবসময় সহজ বাংলায় দিন (সংখ্যা ইংরেজি অঙ্কে চলবে)।",
      "Currency is Bangladeshi Taka (৳). Be concise, practical and specific. Use short bullet lists.",
      "Base every number on the live shop snapshot below. If the snapshot lacks the data, say so instead of guessing.",
      "You may suggest actions such as collecting dues, restocking, or cutting expenses.",
      "",
      "LIVE SHOP SNAPSHOT:",
      snapshot,
    ].join("\n");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [{ role: "system", content: system }, ...data.messages],
      }),
    });

    if (res.status === 429) throw new Error("rate_limit");
    if (res.status === 402) throw new Error("no_credits");
    if (!res.ok) throw new Error(`AI request failed [${res.status}]: ${await res.text()}`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "" };
  });
