"use server";

import { redirect } from "next/navigation";
import { appConfig, hasSupabaseAdminEnv, hasSupabaseEnv } from "@/lib/config";
import { ensureProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function readField(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function authUnavailableRedirect(path: "/login" | "/signup") {
  redirect(`${path}?error=${encodeURIComponent("Supabase env vars are required for auth.")}`);
}

export async function signupAction(formData: FormData) {
  if (!hasSupabaseEnv() || !hasSupabaseAdminEnv()) authUnavailableRedirect("/signup");

  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password");
  const fullName = readField(formData, "fullName");

  if (!email || !password || !fullName) {
    redirect(`/signup?error=${encodeURIComponent("Name, email, and password are required.")}`);
  }

  const authClient = createClient();
  const admin = createAdminClient();

  let user = null;
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (created.error) {
    const signedIn = await authClient.auth.signInWithPassword({ email, password });
    if (signedIn.error || !signedIn.data.user) {
      redirect(`/signup?error=${encodeURIComponent(created.error.message)}`);
    }
    user = signedIn.data.user;
  } else {
    user = created.data.user;
  }

  if (!user) redirect(`/signup?error=${encodeURIComponent("Could not create user.")}`);
  await ensureProfile(user, fullName);

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error) {
    redirect(`/login?error=${encodeURIComponent("Account created. Please log in.")}`);
  }

  redirect("/chat");
}

export async function loginAction(formData: FormData) {
  if (!hasSupabaseEnv()) authUnavailableRedirect("/login");

  const email = readField(formData, "email").toLowerCase();
  const password = readField(formData, "password");
  const authClient = createClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    redirect(`/login?error=${encodeURIComponent(error?.message || "Login failed.")}`);
  }

  if (hasSupabaseAdminEnv()) await ensureProfile(data.user);

  const isInvestor = email === appConfig.devangEmail;
  redirect(isInvestor ? "/dashboard" : "/chat");
}

export async function logoutAction() {
  if (hasSupabaseEnv()) {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  redirect("/login");
}
