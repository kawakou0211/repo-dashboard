import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import SignInButton from "@/components/SignInButton";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  const { error } = await searchParams;

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div>
          <h1 className="text-3xl font-bold">repo-dashboard</h1>
          <p className="text-muted mt-2 text-sm">自分のGitHubプロジェクトを一元管理</p>
        </div>
        {error && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            {error === "unauthorized" ? "このアカウントではアクセスできません。" : "ログインに失敗しました。"}
          </div>
        )}
        <SignInButton />
      </div>
    </main>
  );
}
