"use client";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useRef, useState } from "react";
import type { ManualStatus, RepoMeta, Tag } from "@/types/db";

const STATUSES: ManualStatus[] = ["developing", "done", "paused", "archived", "idea"];

interface Props {
  repoId: string;
  userId: string;
  initialMeta: RepoMeta | null;
  initialTags: Tag[];
  allUserTags: Tag[];
}

export default function RepoEditor({ repoId, userId, initialMeta, initialTags, allUserTags }: Props) {
  const supabase = createClient();
  const [status, setStatus] = useState<ManualStatus | "">((initialMeta?.manual_status as ManualStatus) ?? "");
  const [category, setCategory] = useState(initialMeta?.category ?? "");
  const [notes, setNotes] = useState(initialMeta?.notes ?? "");
  const [tags, setTags] = useState<Tag[]>(initialTags);
  const [newTag, setNewTag] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await supabase.from("repo_meta").upsert(
        {
          repository_id: repoId,
          user_id: userId,
          manual_status: status || null,
          category: category || null,
          notes: notes || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "repository_id" },
      );
      setSavedAt(new Date().toLocaleTimeString());
    }, 500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, category, notes, repoId, userId, supabase]);

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    setNewTag("");
    let tag = allUserTags.find((t) => t.name === name) ?? tags.find((t) => t.name === name);
    if (!tag) {
      const { data } = await supabase
        .from("tags")
        .insert({ user_id: userId, name })
        .select()
        .single();
      if (!data) return;
      tag = data as Tag;
    }
    if (tags.some((t) => t.id === tag!.id)) return;
    await supabase.from("repo_tags").insert({ repository_id: repoId, tag_id: tag.id, user_id: userId });
    setTags([...tags, tag]);
  };

  const removeTag = async (id: string) => {
    await supabase.from("repo_tags").delete().eq("repository_id", repoId).eq("tag_id", id);
    setTags(tags.filter((t) => t.id !== id));
  };

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
            <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-xs">
              #{t.name}
              <button onClick={() => removeTag(t.id)} className="text-muted hover:text-red-600">×</button>
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
