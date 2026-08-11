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
    // Only allow resetting the specific 'admin' or 'super_admin' username to prevent abuse
    if (data.username !== 'admin' && data.username !== 'super_admin') {
      throw new Error("Only Super Admin password can be reset via this flow.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Find the user by metadata/profile
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();

    if (profileErr || !profile) {
      throw new Error("Super Admin account not found in system.");
    }

    // Double check the user actually has super_admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", profile.id)
      .eq("role", "super_admin");

    if (!roles?.length) {
      // Emergency: If the account exists but has NO role (maybe due to some corruption), 
      // let's still check if it's the intended 'admin' username to allow regaining access
      // However, we strictly check for 'super_admin' value in APP_ROLES
      throw new Error("This account exists but does not have the Super Admin role.");
    }

    // Perform the reset
    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { 
      password: data.newPassword 
    });

    if (error) throw new Error(error.message);
    
    return { ok: true, message: "Super Admin password has been reset successfully." };
  });
