"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function signUpAction(formData: FormData): Promise<{
  error?: string;
  emailConfirmRequired?: boolean;
}> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const full_name = formData.get("full_name") as string;
  const phone = formData.get("phone") as string;
  const state = formData.get("state") as string;

  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Something went wrong. Please try again." };

  // Create profile using admin client (bypasses RLS for initial creation)
  const admin = createAdminClient();
  await admin.from("profiles").insert({
    id: data.user.id,
    full_name,
    phone,
    state,
  });

  // No session means email confirmation is required
  if (!data.session) return { emailConfirmRequired: true };

  return {};
}
