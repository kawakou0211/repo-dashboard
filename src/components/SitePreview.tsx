"use client";
import { ExternalLink } from "lucide-react";
import { useState } from "react";

function isHttpUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export default function SitePreview({ url }: { url: string | null }) {
  const [errored, setErrored] = useState(false);
  if (!isHttpUrl(url)) return null;

  // Microlink hosted screenshot — free tier, no key, ~50 req/day per IP.
  const previewSrc = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false&embed=screenshot.url&viewport.width=1280&viewport.height=720`;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Preview</h2>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-gray-900 truncate max-w-[60%]"
        >
          <span className="truncate">{url}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      </div>
      <a href={url} target="_blank" rel="noreferrer" className="block">
        {errored ? (
          <div className="aspect-video w-full rounded border border-dashed border-gray-300 flex items-center justify-center text-xs text-muted">
            プレビュー取得に失敗しました(サイト側でブロックまたは無料枠超過の可能性)
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewSrc}
            alt={`Preview of ${url}`}
            loading="lazy"
            onError={() => setErrored(true)}
            className="w-full aspect-video object-cover rounded border border-gray-200 bg-gray-50"
          />
        )}
      </a>
    </section>
  );
}
