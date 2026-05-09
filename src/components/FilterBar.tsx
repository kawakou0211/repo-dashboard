"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const STATUSES = ["all", "developing", "done", "paused", "archived", "idea", "active", "dormant", "stale"] as const;
const SORTS = [
  { value: "pushed_desc", label: "Updated desc" },
  { value: "score_desc", label: "Restart score desc" },
  { value: "name_asc", label: "Name asc" },
  { value: "created_desc", label: "Created desc" },
];

export default function FilterBar({ tags }: { tags: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const set = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      router.replace(`/dashboard?${next.toString()}`);
    },
    [params, router],
  );

  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "all";
  const sort = params.get("sort") ?? "pushed_desc";
  const tag = params.get("tag") ?? "";

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <input
        type="search"
        defaultValue={q}
        placeholder="Search name / description / summary / notes…"
        onChange={(e) => set("q", e.target.value || null)}
        className="flex-1 min-w-[200px] rounded-md border border-gray-300 bg-white px-3 py-1.5"
      />
      <select
        value={status}
        onChange={(e) => set("status", e.target.value === "all" ? null : e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1.5"
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <select
        value={sort}
        onChange={(e) => set("sort", e.target.value)}
        className="rounded-md border border-gray-300 bg-white px-2 py-1.5"
      >
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
      {tags.length > 0 && (
        <select
          value={tag}
          onChange={(e) => set("tag", e.target.value || null)}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t} value={t}>#{t}</option>
          ))}
        </select>
      )}
    </div>
  );
}
