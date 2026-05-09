"use client";
import { createClient } from "@/lib/supabase/client";

export default function SignInButton() {
  const onClick = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        scopes: "repo read:user",
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center justify-center gap-2 rounded-md bg-black text-white px-4 py-2.5 text-sm font-medium hover:bg-gray-800 transition w-full"
    >
      Sign in with GitHub
    </button>
  );
}
