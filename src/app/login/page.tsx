"use client";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const login = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${location.origin}/auth/callback`,
        scopes: "repo read:user",
      },
    });
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-2xl font-bold">Repo Dashboard</h1>
        <p className="text-sm text-gray-500">GitHubリポジトリを管理するダッシュボード</p>
        <button
          onClick={login}
          className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Sign in with GitHub
        </button>
      </div>
    </main>
  );
}
