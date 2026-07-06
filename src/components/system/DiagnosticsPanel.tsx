import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  clearDiagnostics,
  subscribeDiagnostics,
  type DiagnosticEntry,
} from "@/lib/diagnostics";
import { BUILD_ID } from "@/lib/buildInfo";
import { BACKEND_LABEL, BACKEND_API_BASE } from "@/lib/backend";

const statusColor: Record<DiagnosticEntry["status"], string> = {
  ok: "text-green-600",
  error: "text-destructive",
  fallback: "text-amber-600",
  info: "text-muted-foreground",
};

const statusLabel: Record<DiagnosticEntry["status"], string> = {
  ok: "সফল",
  error: "ত্রুটি",
  fallback: "ফলব্যাক",
  info: "তথ্য",
};

// Shows which backend endpoint was called, the response status, and whether a
// fallback path was used. Helpful when debugging 501 / stale-bundle issues.
export default function DiagnosticsPanel() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);

  useEffect(() => subscribeDiagnostics(setEntries), []);

  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">ডায়াগনস্টিকস</h3>
        <Button variant="outline" size="sm" onClick={clearDiagnostics}>
          পরিষ্কার করুন
        </Button>
      </div>

      <div className="mb-3 grid gap-1 text-xs text-muted-foreground">
        <div>বিল্ড সংস্করণ: <span className="font-mono">v{BUILD_ID}</span></div>
        <div>ব্যাকএন্ড: {BACKEND_LABEL}</div>
        <div className="break-all">API বেস: {BACKEND_API_BASE}</div>
      </div>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          এখনো কোনো endpoint কল রেকর্ড হয়নি। সেভ করলে এখানে দেখা যাবে।
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 border-b py-1 text-xs last:border-0">
              <span className="w-14 shrink-0 text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <span className={`w-16 shrink-0 font-semibold ${statusColor[e.status]}`}>
                {statusLabel[e.status]}
              </span>
              <span className="flex-1">
                <span className="font-mono">{e.endpoint}</span>
                {e.detail && <span className="block text-muted-foreground">{e.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
