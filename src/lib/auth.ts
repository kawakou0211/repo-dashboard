import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");
  return { supabase, user };
}

export function isAllowedGithubId(githubId: string | number | undefined | null): boolean {
  const allowed = process.env.ALLOWED_GITHUB_USER_ID;
  if (!allowed) return false;
  return String(githubId) === String(allowed);
}
