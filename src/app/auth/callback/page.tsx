"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        if (session.provider_token) {
          await supabase.from("github_tokens").upsert(
            { user_id: session.user.id, token: session.provider_token },
            { onConflict: "user_id" },
          );
        }
        router.replace("/dashboard");
      } else if (event === "INITIAL_SESSION" && !session) {
        router.replace("/login?error=auth_error");
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-500">Signing in…</p>
    </main>
  );
}
