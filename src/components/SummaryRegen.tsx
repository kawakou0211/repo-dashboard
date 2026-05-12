"use client";
import { useState } from "react";
import { contextHash, setAi, summaryContext } from "@/lib/storage";
import type { AiSummary, Repository } from "@/types/db";

interface Props {
  repo: Repository;
  onUpdate: (a: AiSummary) => void;
}

export default function SummaryRegen({ repo, onUpdate }: Props) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    setLoading(true);
    try {
      const ctx = summaryContext(repo);
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(ctx),
      });
      const j = await res.json();
      if (!res.ok || !j.ok) {
        alert(`Failed: ${j.error ?? j.reason ?? res.statusText}`);
        return;
      }
      const ai: AiSummary = {
        summary: j.summary,
        generated_at: new Date().toISOString(),
        readme_hash: contextHash(ctx),
      };
      await setAi(repo.github_id, ai);
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
