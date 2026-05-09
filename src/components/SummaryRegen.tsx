"use client";
import { useState } from "react";
import { hash, setAi } from "@/lib/storage";
import type { AiSummary } from "@/types/db";

interface Props {
  githubId: number;
  excerpt: string | null;
  onUpdate: (a: AiSummary) => void;
}

export default function SummaryRegen({ githubId, excerpt, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (!excerpt) {
      alert("READMEがありません。");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ excerpt }),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        alert(`Failed: ${j.error ?? j.reason ?? res.statusText}`);
        return;
      }
      const ai: AiSummary = {
        summary: j.summary,
        generated_at: new Date().toISOString(),
        readme_hash: hash(excerpt),
      };
      setAi(githubId, ai);
      onUpdate(ai);
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
