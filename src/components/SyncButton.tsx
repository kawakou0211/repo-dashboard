"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Sync failed: ${j.error ?? res.statusText}`);
        return;
      }
      // fire-and-forget summarize
      fetch("/api/summarize", { method: "POST", body: JSON.stringify({}) }).catch(() => {});
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
      {loading ? "Syncing…" : "Sync now"}
    </button>
  );
}
