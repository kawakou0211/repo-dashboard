"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SummaryRegen({ repoId }: { repoId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  const onClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repository_id: repoId }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(`Failed: ${j.error ?? res.statusText}`);
        return;
      }
      startTransition(() => router.refresh());
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="text-xs rounded border border-gray-300 px-2 py-1 hover:bg-gray-50 disabled:opacity-60"
    >
      {loading ? "Regenerating…" : "Regenerate"}
    </button>
  );
}
