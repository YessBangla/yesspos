import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delivers queued order-status notifications (SMS) automatically.
 * Staff-triggered: runs after every status change and on a background poll.
 */
export const dispatchNotifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { dispatchPending } = await import("@/lib/notify-dispatch.server");
    return dispatchPending();
  });
