import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  clearDiagnostics,
  lastSerialPath,
  subscribeDiagnostics,
  type DiagnosticEntry,
} from "@/lib/diagnostics";
import { BUILD_ID } from "@/lib/buildInfo";
import { BACKEND_LABEL, BACKEND_API_BASE, isLaravelBackend } from "@/lib/backend";

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

const pathLabel: Record<string, string> = {
  fn: "Edge Function (/api/fn)",
  rpc: "RPC (/api/rpc)",
  db: "Direct DB (/api/db)",
};

// Shows which backend endpoint was called, the response status, response time,
// and whether a fallback path was used. Helpful when debugging 501 / stale-bundle issues.
export default function DiagnosticsPanel() {
  const [entries, setEntries] = useState<DiagnosticEntry[]>([]);

  useEffect(() => subscribeDiagnostics(setEntries), []);

  const serialPath = lastSerialPath();

  return (
    <div className="rounded-lg border bg-card p-4 text-sm">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">ডায়াগনস্টিকস</h3>
        <Button variant="outline" size="sm" onClick={clearDiagnostics}>
          পরিষ্কার করুন
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">বিল্ড v{BUILD_ID}</Badge>
        <Badge variant={isLaravelBackend ? "default" : "outline"}>
          {isLaravelBackend ? "VPS / সেল্ফ-হোস্টেড" : "Lovable Cloud"}
        </Badge>
        <Badge variant="outline">
          সিরিয়াল পথ: {serialPath ? pathLabel[serialPath] : "এখনো ব্যবহার হয়নি"}
        </Badge>
      </div>
      <p className="mb-3 break-all text-xs text-muted-foreground">
        {BACKEND_LABEL} • API বেস: {BACKEND_API_BASE}
      </p>

      {entries.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          এখনো কোনো endpoint কল রেকর্ড হয়নি। সেভ করলে শেষ ৫০টি কল এখানে দেখা যাবে।
        </p>
      ) : (
        <ul className="space-y-1">
          {entries.map((e) => (
            <li key={e.id} className="flex items-start gap-2 border-b py-1 text-xs last:border-0">
              <span className="w-16 shrink-0 text-muted-foreground">
                {new Date(e.ts).toLocaleTimeString()}
              </span>
              <span className={`w-14 shrink-0 font-semibold ${statusColor[e.status]}`}>
                {statusLabel[e.status]}
              </span>
              <span className="w-14 shrink-0 text-right text-muted-foreground">
                {e.durationMs != null ? `${e.durationMs}ms` : "—"}
              </span>
              <span className="flex-1">
                <span className="font-mono">{e.endpoint}</span>
                {e.usedFallback && <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">fallback</span>}
                {e.detail && <span className="block text-muted-foreground">{e.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
