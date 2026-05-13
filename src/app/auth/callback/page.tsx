"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code) {
      router.replace("/login?error=auth_error");
      return;
    }

    const supabase = createClient();

    supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
      if (error || !data.session) {
        router.replace("/login?error=auth_error");
        return;
      }

      const session = data.session;
      if (session.provider_token) {
        await supabase.from("github_tokens").upsert(
          { user_id: session.user.id, token: session.provider_token },
          { onConflict: "user_id" },
        );
      }

      router.replace("/dashboard");
    });
  }, [router, searchParams]);

  return <p className="text-sm text-gray-500">Signing in…</p>;
}

export default function AuthCallbackPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <Suspense fallback={<p className="text-sm text-gray-500">Signing in…</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
