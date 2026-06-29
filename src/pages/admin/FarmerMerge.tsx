import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FarmerSearchSelect, FarmerLite } from "@/components/farmers/FarmerSearchSelect";
import { useLang } from "@/i18n/LanguageProvider";
import { AlertTriangle, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function FarmerMerge() {
  const { tx } = useLang();
  const [source, setSource] = useState<FarmerLite | null>(null);
  const [target, setTarget] = useState<FarmerLite | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const canMerge = !!source && !!target && source.id !== target.id;

  async function doMerge() {
    if (!source || !target) return;
    setBusy(true);
    const { error } = await db.rpc("merge_farmers" as any, {
      _source: source.id,
      _target: target.id,
    });
    setBusy(false);
    setConfirmOpen(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tx("Farmers merged successfully.", "কৃষক সফলভাবে একত্রিত হয়েছে।"));
    setSource(null);
    setTarget(null);
  }

  const label = (f: FarmerLite | null) =>
    f ? `${f.member_no ?? f.farmer_code} — ${f.name_bn || f.name_en}` : "—";

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx("Farmer Merge", "কৃষক একত্রীকরণ")}
        description={tx("Merge a duplicate farmer into the correct one (Admin only).", "ডুপ্লিকেট কৃষককে সঠিক কৃষকের সাথে একত্রিত করুন (শুধু অ্যাডমিন)।")}
      />

      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{tx("Important", "গুরুত্বপূর্ণ")}</AlertTitle>
        <AlertDescription>
          {tx(
            "All savings accounts, savings transactions, land records, irrigation dues and payment history of the duplicate (source) farmer will be moved to the kept (target) farmer. The source farmer becomes inactive and is marked as merged. This action is audit-logged and cannot be undone automatically.",
            "ডুপ্লিকেট (সোর্স) কৃষকের সমস্ত সেভিং অ্যাকাউন্ট, সেভিং লেনদেন, জমির রেকর্ড, সেচ বকেয়া ও পেমেন্ট হিস্ট্রি রাখা (টার্গেট) কৃষকের কাছে স্থানান্তরিত হবে। সোর্স কৃষক নিষ্ক্রিয় ও merged হিসেবে চিহ্নিত হবে। এই কাজটি অডিট-লগ করা হয় এবং স্বয়ংক্রিয়ভাবে ফেরানো যায় না।"
          )}
        </AlertDescription>
      </Alert>

      <Card className="p-5 grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{tx("Duplicate farmer (source — will be deactivated)", "ডুপ্লিকেট কৃষক (সোর্স — নিষ্ক্রিয় হবে)")}</Label>
          <FarmerSearchSelect
            value={source?.id ?? null}
            onChange={(_id, f) => setSource(f)}
            excludeIds={target ? [target.id] : []}
          />
        </div>
        <div className="space-y-2">
          <Label>{tx("Keep this farmer (target)", "এই কৃষককে রাখুন (টার্গেট)")}</Label>
          <FarmerSearchSelect
            value={target?.id ?? null}
            onChange={(_id, f) => setTarget(f)}
            excludeIds={source ? [source.id] : []}
          />
        </div>
      </Card>

      <Button disabled={!canMerge || busy} onClick={() => setConfirmOpen(true)}>
        <GitMerge className="h-4 w-4 mr-2" />
        {tx("Merge farmers", "একত্রিত করুন")}
      </Button>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tx("Confirm merge", "একত্রীকরণ নিশ্চিত করুন")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tx("Move all records from", "সমস্ত রেকর্ড সরানো হবে")}{" "}
              <strong>{label(source)}</strong>{" "}
              {tx("into", "→")}{" "}
              <strong>{label(target)}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tx("Cancel", "বাতিল")}</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); doMerge(); }} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tx("Confirm", "নিশ্চিত করুন")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
