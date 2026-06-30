import { useState } from "react";
import { db } from "@/lib/db";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";


type BlockingItem = { table: string; label: string; count: number };
type Precheck = {
  ok: boolean;
  can_delete?: boolean;
  items?: BlockingItem[];
  total?: number;
  message?: string;
};

export function PermanentDeleteDialog({
  farmerId,
  onDeleted,
  triggerLabel,
}: {
  farmerId: string;
  onDeleted: () => void;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [check, setCheck] = useState<Precheck | null>(null);
  const [cascade, setCascade] = useState(false);
  const { isDeveloper } = useAuth();

  async function runPrecheck() {
    setLoading(true);
    setCheck(null);
    const { data, error } = await db.rpc("farmer_delete_precheck", { _farmer_id: farmerId });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setCheck((data as any)?.result ?? data);
  }

  async function confirmDelete() {
    setDeleting(true);
    const { data, error } = await db.rpc("farmer_permanent_delete", {
      _farmer_id: farmerId,
      _cascade: cascade,
    });
    setDeleting(false);
    if (error) return toast.error(error.message);
    const res = (data as any)?.result ?? data;
    if (!res?.ok) {
      // Refresh precheck so the UI reflects the blocking records.
      setCheck({ ok: true, can_delete: false, items: undefined, message: res?.message });
      runPrecheck();
      return toast.error(res?.message || "এই ফার্মার পারমানেন্ট ডিলিট করা যাবে না।");
    }
    toast.success(res.message || "ফার্মার পারমানেন্টভাবে ডিলিট করা হয়েছে।");
    setOpen(false);
    onDeleted();
  }

  // Developer may force-delete (cascade) even when blocking records exist.
  const canDelete = check?.can_delete === true || (isDeveloper && cascade);


  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) runPrecheck();
        else setCheck(null);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">{triggerLabel}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>ফার্মার পারমানেন্ট ডিলিট?</AlertDialogTitle>
          <AlertDialogDescription>
            এটি ফার্মারকে ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলবে। শুধুমাত্র কোনো লেনদেন না থাকলে সম্ভব। এটি ফিরিয়ে আনা যাবে না।
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="rounded-md border p-3 text-sm">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> ট্রানজেকশন চেক করা হচ্ছে…
            </div>
          ) : canDelete ? (
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-4 w-4" /> কোনো ট্রানজেকশন নেই — ডিলিট করা যাবে।
            </div>
          ) : check ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-destructive font-medium">
                <AlertTriangle className="h-4 w-4" /> ব্লকিং রেকর্ড পাওয়া গেছে
              </div>
              {check.items && check.items.length > 0 ? (
                <ul className="list-disc pl-5 text-muted-foreground">
                  {check.items.map((it) => (
                    <li key={it.table}>
                      {it.label}: <span className="font-semibold">{it.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted-foreground">{check.message}</p>
              )}
            </div>
          ) : null}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>বাতিল</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              confirmDelete();
            }}
            disabled={!canDelete || deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : triggerLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
