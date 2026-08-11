import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const resetSuperAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => 
    z.object({ 
      username: z.string().min(3),
      newPassword: z.string().min(6) 
    }).parse(input)
  )
  .handler(async ({ data }) => {
    if (data.username !== 'admin' && data.username !== 'super_admin') {
      throw new Error("Only Super Admin password can be reset via this flow.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Super Admin account not found in system.");
    }

    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", "super_admin");

    if (!roles?.length) {
      throw new Error("This account exists but does not have the Super Admin role.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { 
      password: data.newPassword 
    });

    if (error) throw new Error(error.message);
    
    // Log the event
    await supabaseAdmin.from("audit_logs").insert({
      action: "password_reset",
      username: data.username,
      details: "Super Admin password reset via emergency recovery flow",
      entity: "user",
      entity_id: profile.id
    });

    return { ok: true, message: "Super Admin password has been reset successfully." };
  });

export const logAuthAudit = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => 
    z.object({ 
      action: z.string(),
      username: z.string(),
      reason: z.string().optional()
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      action: data.action,
      username: data.username,
      details: data.reason || "Client-side auth event"
    });
    return { ok: true };
  });