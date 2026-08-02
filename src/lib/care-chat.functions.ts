import { createServerFn } from "@tanstack/react-start";

export type CareTurn = { role: "user" | "assistant"; content: string };

type CareInput = { messages: CareTurn[]; lang?: "bn" | "en" };

function validate(input: unknown): CareInput {
  const raw = input as CareInput;
  if (!raw || !Array.isArray(raw.messages) || raw.messages.length === 0) {
    throw new Error("messages required");
  }
  const messages = raw.messages
    .slice(-12)
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!messages.length) throw new Error("messages required");
  return { messages, lang: raw.lang === "en" ? "en" : "bn" };
}

/** Public "Bazar Bari Care" support chat — answers from the shop's public information. */
export const askCare = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { buildCareKnowledge } = await import("@/lib/care-chat.server");
    const knowledge = await buildCareKnowledge();

    const system = [
      "You are 'Bazar Bari Care' (বাজার বাড়ি কেয়ার), the official customer care assistant of Bazar Bari (বাজার বাড়ি) — an online + in-shop grocery bazar in Bangladesh.",
      data.lang === "en"
        ? "Answer in clear, friendly English."
        : "উত্তর সহজ, ভদ্র বাংলায় দিন (সংখ্যা ইংরেজি অঙ্কে চলবে)।",
      "Help with: product availability and prices, delivery areas, fees and time, order placing, tracking, cancel/reschedule, coupons, loyalty points, payment methods, and general shop information.",
      "Use only the knowledge base below. If something is not there, say you don't have that information and suggest contacting the shop phone or using the relevant page link.",
      "Be concise: short answers with bullet points. Always show money as ৳. Never invent products, prices or offers.",
      "Never ask for passwords, card numbers or OTP.",
      "",
      "BAZAR BARI KNOWLEDGE BASE:",
      knowledge,
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
    if (!res.ok) throw new Error(`AI request failed [${res.status}]`);

    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return { reply: json.choices?.[0]?.message?.content ?? "" };
  });
