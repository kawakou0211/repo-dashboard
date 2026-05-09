import { createClient } from "@/lib/supabase/server";
import { isAllowedGithubId } from "@/lib/auth";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const origin = url.origin;

  if (!code) return NextResponse.redirect(`${origin}/?error=missing_code`);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/?error=${encodeURIComponent(error.message)}`);

  const { data: { user } } = await supabase.auth.getUser();
  const ghId = user?.user_metadata?.provider_id ?? user?.user_metadata?.sub;
  if (!isAllowedGithubId(ghId)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/?error=unauthorized`);
  }

  return NextResponse.redirect(`${origin}/dashboard`);
}
