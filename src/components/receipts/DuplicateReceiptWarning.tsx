import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";
import { useDuplicateReceiptAudit } from "@/lib/duplicateReceiptAudit";

export function DuplicateReceiptWarning() {
  const { roles } = useAuth();
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const { rows } = useDuplicateReceiptAudit(isAdmin);
  if (!isAdmin || rows.length === 0) return null;
  const top = rows.slice(0, 5);
  return (
    <Alert variant="destructive" className="mb-3">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Duplicate receipt numbers detected ({rows.length})</AlertTitle>
      <AlertDescription>
        <ul className="text-xs mt-1 space-y-0.5">
          {top.map((r) => (
            <li key={`${r.kind}-${r.date}-${r.receipt_no}`} className="font-mono">
              {r.kind} • {r.date} • {r.receipt_no} ×{r.count}
            </li>
          ))}
          {rows.length > top.length && <li className="opacity-70">…and {rows.length - top.length} more</li>}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
