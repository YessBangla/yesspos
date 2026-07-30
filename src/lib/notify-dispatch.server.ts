/** Server-side helper that pushes pending order notifications to the SMS gateway. */

type SmsConfig = {
  base_url: string | null;
  api_key: string | null;
  sender_id: string | null;
  extra: Record<string, unknown> | null;
};

export type DispatchResult = { sent: number; failed: number; skipped: string | null };

/** Sends one SMS through the configured gateway (sms.net.bd compatible form POST). */
async function sendSms(cfg: SmsConfig, to: string, msg: string) {
  const url = (cfg.base_url ?? "").trim();
  if (!url) throw new Error("SMS gateway URL is not configured");
  if (!cfg.api_key) throw new Error("SMS gateway API key is missing");

  const body = new URLSearchParams({ api_key: cfg.api_key, msg, to });
  if (cfg.sender_id) body.set("sender_id", cfg.sender_id);
  const extra = cfg.extra ?? {};
  for (const [k, v] of Object.entries(extra)) {
    if (typeof v === "string" || typeof v === "number") body.set(k, String(v));
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${text.slice(0, 200)}`);
  // sms.net.bd style: { "error": 0, "msg": "..." } — anything non-zero is a failure.
  try {
    const json = JSON.parse(text) as { error?: number; msg?: string };
    if (typeof json.error === "number" && json.error !== 0) {
      throw new Error(json.msg ?? `Gateway error ${json.error}`);
    }
  } catch (e) {
    if (e instanceof Error && !(e instanceof SyntaxError)) throw e;
  }
  return text.slice(0, 200);
}

/**
 * Picks up unsent customer notifications and delivers them automatically.
 * Runs with the service role because it is called from trusted server code only.
 */
export async function dispatchPending(limit = 25): Promise<DispatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: gw } = await supabaseAdmin
    .from("api_settings")
    .select("base_url,api_key,sender_id,extra,enabled")
    .eq("provider", "sms")
    .maybeSingle();

  if (!gw || !gw.enabled) return { sent: 0, failed: 0, skipped: "sms_gateway_disabled" };

  const { data: rows, error } = await supabaseAdmin
    .from("customer_notifications")
    .select("id,body,customer_phone,send_attempts,send_status")
    .eq("is_sent", false)
    .neq("send_status", "sending")
    .lt("send_attempts", 3)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  let sent = 0;
  let failed = 0;

  for (const row of rows ?? []) {
    const now = new Date().toISOString();
    const attempts = (row.send_attempts ?? 0) + 1;
    try {
      const phone = (row.customer_phone ?? "").trim();
      if (!phone) throw new Error("No customer phone number");
      await sendSms(gw as SmsConfig, phone, row.body);
      sent += 1;
      const { error: upErr } = await supabaseAdmin
        .from("customer_notifications")
        .update({
          is_sent: true,
          sent_at: now,
          send_status: "sent",
          send_attempts: attempts,
          last_attempt_at: now,
          last_error: null,
        })
        .eq("id", row.id);
      if (upErr) console.error("[notify-dispatch] update failed", upErr.message);
    } catch (e) {
      failed += 1;
      const message = e instanceof Error ? e.message : "Send failed";
      const { error: upErr } = await supabaseAdmin
        .from("customer_notifications")
        .update({
          send_status: "failed",
          send_attempts: attempts,
          last_attempt_at: now,
          last_error: message.slice(0, 300),
        })
        .eq("id", row.id);
      if (upErr) console.error("[notify-dispatch] update failed", upErr.message);
    }
  }

  return { sent, failed, skipped: null };
}
