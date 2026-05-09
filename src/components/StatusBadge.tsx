import { statusColor } from "@/lib/status";
import type { EffectiveStatus } from "@/types/db";

export default function StatusBadge({ status }: { status: EffectiveStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${statusColor(status)}`}
    >
      {status}
    </span>
  );
}
