"use client";
import { useEffect, useRef, useState } from "react";
import { setMeta } from "@/lib/storage";
import type { ManualStatus, RepoMeta } from "@/types/db";

const STATUSES: ManualStatus[] = ["developing", "done", "paused", "archived", "idea"];

interface Props {
  githubId: number;
  initialMeta: RepoMeta | null;
  onChange?: (m: RepoMeta) => void;
}

export default function RepoEditor({ githubId, initialMeta, onChange }: Props) {
  const [status, setStatus] = useState<ManualStatus | "">((initialMeta?.manual_status as ManualStatus) ?? "");
  const [category, setCategory] = useState(initialMeta?.category ?? "");
  const [notes, setNotes] = useState(initialMeta?.notes ?? "");
  const [tags, setTags] = useState<string[]>(initialMeta?.tags ?? []);
  const [newTag, setNewTag] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipFirst = useRef(true);

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const next = await setMeta(githubId, {
        manual_status: (status || null) as ManualStatus | null,
        category: category || null,
        notes: notes || null,
        tags,
      });
      setSavedAt(new Date().toLocaleTimeString());
      onChange?.(next);
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, category, notes, tags, githubId, onChange]);

  const addTag = () => {
    const name = newTag.trim();
    if (!name || tags.includes(name)) return;
    setTags([...tags, name]);
    setNewTag("");
  };

  const removeTag = (name: string) => setTags(tags.filter((t) => t !== name));

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as ManualStatus | "")}
          className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
        >
          <option value="">(auto)</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Category</label>
        <input
          list="categories"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="web / cli / experiment / library …"
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm"
        />
        <datalist id="categories">
          <option value="web" />
          <option value="cli" />
          <option value="experiment" />
          <option value="library" />
        </datalist>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Tags</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs">
              #{t}
              <button onClick={() => removeTag(t)} className="text-muted hover:text-red-600">×</button>
            </span>
          ))}
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            placeholder="add tag…"
            className="text-xs px-2 py-1 rounded border border-gray-300 bg-white"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-mono"
        />
      </div>
      {savedAt && <div className="text-xs text-muted">Saved {savedAt}</div>}
    </div>
  );
}
