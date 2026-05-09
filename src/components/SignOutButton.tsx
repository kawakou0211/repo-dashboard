"use client";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/");
        router.refresh();
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-gray-900"
      title="Sign out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  );
}
