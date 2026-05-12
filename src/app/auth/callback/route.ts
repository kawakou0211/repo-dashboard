import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                response.cookies.set(name, value, options);
              } catch (e) {
                console.error("cookie set failed:", name, String(e));
              }
            });
          },
        },
      },
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    console.log("exchange:", { error: error?.message, hasSession: !!data?.session, providerToken: !!data?.session?.provider_token });

    if (!error) {
      // Store the GitHub token in DB so API routes can use it
      if (data.session?.provider_token && data.session?.user) {
        await supabase.from("github_tokens").upsert(
          { user_id: data.session.user.id, token: data.session.provider_token },
          { onConflict: "user_id" },
        ).then(({ error: e }) => { if (e) console.error("token store failed:", e.message); });
      }
      return response;
    }
    console.error("exchange error:", error?.message);
  }

  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
