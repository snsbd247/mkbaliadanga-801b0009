import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FarmerSearchSelect } from "@/components/farmers/FarmerSearchSelect";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";
import { normalizeLandSize } from "@/lib/landMath";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sourceLand: any | null;
  sourceFarmerId: string;
  onDone: () => void;
  /** When set, pre-fills a single recipient (the real owner) and reclaims the
   *  borgadar land back to that owner (resulting land becomes owner-type). */
  reclaimOwnerId?: string | null;
};

type Recipient = { farmer_id: string; area: number };

export default function LandTransferDialog({ open, onOpenChange, sourceLand, sourceFarmerId, onDone, reclaimOwnerId }: Props) {
  const { tx } = useLang();
  const { user, officeId } = useAuth();
  const [transferType, setTransferType] = useState<"inheritance" | "sale" | "borga_transfer" | "other">("inheritance");
  const [equalSplit, setEqualSplit] = useState(true);
  const [remark, setRemark] = useState("");
  const [transferredOn, setTransferredOn] = useState(new Date().toISOString().slice(0, 10));
  const [recipients, setRecipients] = useState<Recipient[]>([{ farmer_id: "", area: 0 }]);
  const [saving, setSaving] = useState(false);

  const isReclaim = !!reclaimOwnerId;
  const isBorgaGive = !isReclaim && transferType === "borga_transfer";

  useEffect(() => {
    if (open) {
      setTransferType(isReclaim ? "borga_transfer" : "inheritance");
      setEqualSplit(true);
      setRemark("");
      setTransferredOn(new Date().toISOString().slice(0, 10));
      setRecipients(isReclaim ? [{ farmer_id: reclaimOwnerId!, area: 0 }] : [{ farmer_id: "", area: 0 }]);
    }
  }, [open, isReclaim, reclaimOwnerId]);

  const totalLand = Number(sourceLand?.land_size || 0);
  const equalArea = useMemo(() => (recipients.length > 0 ? +(totalLand / recipients.length).toFixed(3) : 0), [totalLand, recipients.length]);
  const allocatedSum = useMemo(() => recipients.reduce((s, r) => s + Number(r.area || 0), 0), [recipients]);
  const effectiveAreas = equalSplit ? recipients.map(() => equalArea) : recipients.map(r => Number(r.area || 0));
  const effectiveSum = effectiveAreas.reduce((s, n) => s + n, 0);

  function updateRecipient(i: number, patch: Partial<Recipient>) {
    setRecipients(rs => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRecipient() { setRecipients(rs => [...rs, { farmer_id: "", area: 0 }]); }
  function removeRecipient(i: number) { setRecipients(rs => rs.filter((_, idx) => idx !== i)); }

  async function submit() {
    if (!sourceLand) return;
    if (recipients.length === 0) return toast.error(tx("Add at least one recipient", "অন্তত একজন প্রাপক যোগ করুন"));
    if (recipients.some(r => !r.farmer_id)) return toast.error(tx("Select farmer for each recipient", "প্রতিটি প্রাপকের জন্য কৃষক নির্বাচন করুন"));
    if (new Set(recipients.map(r => r.farmer_id)).size !== recipients.length) return toast.error(tx("Recipients must be unique", "প্রাপকগণ অনন্য হতে হবে"));
    if (!equalSplit && effectiveSum - totalLand > 0.005) return toast.error(tx("Allocated area exceeds source land", "বরাদ্দকৃত পরিমাণ মূল জমির চেয়ে বেশি"));
    if (effectiveAreas.some(a => !(a > 0))) return toast.error(tx("Each recipient area must be > 0", "প্রতিটি প্রাপকের পরিমাণ ০ এর বেশি হতে হবে"));

    setSaving(true);
    try {
      // Transfer-back restriction: a recipient cannot be a prior owner who already
      // transferred this same dag/mouza to the current owner (no reversing transfers).
      const { data: priorTr } = await supabase
        .from("land_transfers")
        .select("source_farmer_id, land_transfer_recipients(recipient_farmer_id)")
        .eq("source_dag_no", sourceLand.dag_no ?? "")
        .eq("source_mouza", sourceLand.mouza ?? "");
      const blocked = new Set<string>();
      for (const tr of (priorTr as any[]) ?? []) {
        const recs = tr.land_transfer_recipients ?? [];
        if (recs.some((rc: any) => rc.recipient_farmer_id === sourceFarmerId)) {
          if (tr.source_farmer_id) blocked.add(tr.source_farmer_id);
        }
      }
      const reversing = !isReclaim && recipients.find(r => blocked.has(r.farmer_id));
      if (reversing) {
        setSaving(false);
        return toast.error(tx("Cannot transfer back to a previous owner of this land.", "এই জমি আগের মালিক/বর্গাদারে ফেরত transfer করা যাবে না।"));
      }

      // Snapshot source owner details so history survives later land changes
      const { data: srcFarmer } = await supabase.from("farmers")
        .select("name_en,name_bn,farmer_code,member_no").eq("id", sourceFarmerId).maybeSingle();

      const { data: tr, error: trErr } = await supabase.from("land_transfers").insert({
        source_land_id: sourceLand.id,
        source_farmer_id: sourceFarmerId,
        transfer_type: isReclaim ? "borga_return" : transferType,
        remark: remark.trim() || null,
        transferred_at: transferredOn,
        office_id: sourceLand.office_id ?? officeId ?? null,
        created_by: user?.id ?? null,
        source_dag_no: sourceLand.dag_no ?? null,
        source_mouza: sourceLand.mouza ?? null,
        source_land_size: totalLand || null,
        source_owner_name: srcFarmer?.name_bn || srcFarmer?.name_en || null,
        source_owner_code: (srcFarmer as any)?.member_no ?? srcFarmer?.farmer_code ?? null,
      } as any).select("id").single();
      if (trErr) throw trErr;

      const transferId = tr!.id;

      // Create new land rows for each recipient (clone fields) + transfer recipient records
      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const area = normalizeLandSize(effectiveAreas[i]);
        const newLandPayload: any = {
          farmer_id: r.farmer_id,
          mouza: sourceLand.mouza ?? null,
          dag_no: sourceLand.dag_no ?? null,
          land_size: area,
          owner_type: isReclaim ? "owner" : (isBorgaGive ? "borgadar" : sourceLand.owner_type),
          field_type: sourceLand.field_type,
          owner_farmer_id: isReclaim ? null : (isBorgaGive ? sourceFarmerId : (sourceLand.owner_type === "borgadar" ? sourceLand.owner_farmer_id : null)),
          office_id: sourceLand.office_id ?? officeId ?? null,
          division_id: sourceLand.division_id ?? null,
          district_id: sourceLand.district_id ?? null,
          upazila_id: sourceLand.upazila_id ?? null,
          mouza_id: sourceLand.mouza_id ?? null,
          land_type_id: sourceLand.land_type_id ?? null,
          patwari_id: sourceLand.patwari_id ?? null,
        };
        // If this recipient already has an active land row with the same dag_no,
        // merging into it avoids the (farmer_id, dag_no) unique-constraint clash
        // (e.g. reclaiming borga land back to its real owner who already owns it).
        const dagNo = (sourceLand.dag_no ?? "").trim();
        let landId: string;
        if (dagNo) {
          const { data: existing } = await supabase.from("lands")
            .select("id, land_size")
            .eq("farmer_id", r.farmer_id)
            .eq("dag_no", dagNo)
            .is("deleted_at", null)
            .maybeSingle();
          if (existing) {
            const { error: upErr } = await supabase.from("lands")
              .update({ land_size: normalizeLandSize(Number(existing.land_size || 0) + area) } as any)
              .eq("id", existing.id);
            if (upErr) throw upErr;
            landId = existing.id;
          } else {
            const { data: nl, error: nlErr } = await supabase.from("lands").insert(newLandPayload).select("id").single();
            if (nlErr) throw nlErr;
            landId = nl!.id;
          }
        } else {
          const { data: nl, error: nlErr } = await supabase.from("lands").insert(newLandPayload).select("id").single();
          if (nlErr) throw nlErr;
          landId = nl!.id;
        }

        const { error: rcErr } = await supabase.from("land_transfer_recipients").insert({
          transfer_id: transferId,
          recipient_farmer_id: r.farmer_id,
          new_land_id: landId,
          area_decimal: area,
        } as any);
        if (rcErr) throw rcErr;
      }

      // Giving borga: the OWNER keeps the parcel — only reduce its size by the area
      // given out. Archive only if nothing remains. Sale/inheritance archive fully.
      if (isBorgaGive) {
        const remaining = normalizeLandSize(totalLand - effectiveSum);
        if (remaining > 0.0001) {
          const { error: upErr } = await supabase.from("lands")
            .update({ land_size: remaining } as any).eq("id", sourceLand.id);
          if (upErr) throw upErr;
        } else {
          const { error: delErr } = await supabase.from("lands")
            .update({ deleted_at: new Date().toISOString() } as any).eq("id", sourceLand.id);
          if (delErr) throw delErr;
        }
      } else {
        // Archive source land (history preserved via land_transfers; row not modified except deleted_at)
        const { error: delErr } = await supabase.from("lands").update({ deleted_at: new Date().toISOString() } as any).eq("id", sourceLand.id);
        if (delErr) throw delErr;
      }

      toast.success(tx("Land transferred", "জমি হস্তান্তরিত"));
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{isReclaim ? tx("Reclaim Land to Owner", "জমি মালিকে ফেরত") : tx("Transfer / Distribute Land", "জমি হস্তান্তর / বণ্টন")}</DialogTitle></DialogHeader>
        {sourceLand && (
          <div className="space-y-3 text-sm">
            <div className="rounded-md bg-muted p-2 text-xs">
              {tx("Source", "মূল")}: <b>{sourceLand.dag_no}</b> — {sourceLand.mouza ?? "—"} — <b>{totalLand.toFixed(2)}</b> {tx("decimal", "শতক")}
              <div className="text-muted-foreground mt-1">{tx("The original land row will be archived. New land rows will be created for each recipient. History is preserved.", "মূল জমির রেকর্ড আর্কাইভ হবে। প্রতিটি প্রাপকের জন্য নতুন জমির রেকর্ড তৈরি হবে। ইতিহাস অপরিবর্তিত থাকবে।")}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{tx("Transfer Type", "হস্তান্তরের ধরন")}</Label>
                <Select value={transferType} onValueChange={v => setTransferType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inheritance">{tx("Inheritance", "উত্তরাধিকার")}</SelectItem>
                    <SelectItem value="sale">{tx("Sale", "বিক্রয়")}</SelectItem>
                    <SelectItem value="borga_transfer">{tx("Borga Transfer", "বর্গা পরিবর্তন")}</SelectItem>
                    <SelectItem value="other">{tx("Other", "অন্যান্য")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{tx("Transfer Date", "হস্তান্তর তারিখ")}</Label>
                <Input type="date" value={transferredOn} onChange={e => setTransferredOn(e.target.value)} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border p-3">
              <Label>{tx("Equal Split", "সমান বণ্টন")}</Label>
              <Switch checked={equalSplit} onCheckedChange={setEqualSplit} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>{tx("Recipients", "প্রাপকগণ")} ({recipients.length})</Label>
                <Button size="sm" variant="outline" onClick={addRecipient}><Plus className="h-4 w-4 mr-1" />{tx("Add", "যোগ")}</Button>
              </div>
              <div className="space-y-2">
                {recipients.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr,140px,40px] gap-2 items-end">
                    <div>
                      <Label className="text-xs">{tx("Farmer", "কৃষক")}</Label>
                      <FarmerSearchSelect value={r.farmer_id || null} onChange={id => updateRecipient(i, { farmer_id: id ?? "" })} />
                    </div>
                    <div>
                      <Label className="text-xs">{tx("Area (decimal)", "পরিমাণ (শতক)")}</Label>
                      <Input type="number" step="0.01" disabled={equalSplit} value={equalSplit ? equalArea : r.area}
                        onChange={e => updateRecipient(i, { area: +e.target.value })} />
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeRecipient(i)} disabled={recipients.length <= 1}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                {tx("Allocated", "বরাদ্দ")}: <b>{effectiveSum.toFixed(2)}</b> / {totalLand.toFixed(2)} {tx("decimal", "শতক")}
                {!equalSplit && effectiveSum > totalLand && <span className="text-destructive ml-2">{tx("(over-allocated)", "(অতিরিক্ত)")}</span>}
                {effectiveSum < totalLand && <span className="ml-2">{tx("Remaining will be lost.", "অবশিষ্ট হারিয়ে যাবে।")}</span>}
              </div>
            </div>

            <div>
              <Label>{tx("Remark", "মন্তব্য")}</Label>
              <Input value={remark} onChange={e => setRemark(e.target.value)} placeholder={tx("e.g. owner deceased, divided among 4 sons", "যেমন: মালিক মারা গেছেন, ৪ ছেলের মাঝে বণ্টন")} />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>{tx("Cancel", "বাতিল")}</Button>
          <Button onClick={submit} disabled={saving}>{saving ? tx("Saving…", "সংরক্ষণ হচ্ছে…") : tx("Transfer", "হস্তান্তর করুন")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
