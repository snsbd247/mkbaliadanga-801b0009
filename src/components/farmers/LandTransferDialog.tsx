import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
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
import { normalizeLandSize, formatLand } from "@/lib/landMath";

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

    // ── Reclaim borga: close the active land_relations row. The owner's land row
    // was never shrunk during borga, so nothing else changes. The reclaim is
    // recorded as a borga_return transfer for history.
    if (isReclaim) {
      setSaving(true);
      try {
        const relId = (sourceLand as any)._relation_id;
        const landId = (sourceLand as any)._land_id ?? sourceLand.id;
        const today = new Date().toISOString().slice(0, 10);
        if (relId) {
          const { error: relErr } = await db.from("land_relations")
            .update({ deleted_at: new Date().toISOString(), valid_to: today } as any)
            .eq("id", relId);
          if (relErr) throw relErr;
        }
        const { error: trErr } = await db.from("land_transfers").insert({
          source_land_id: landId,
          source_farmer_id: (sourceLand as any)._sharecropper_id ?? sourceFarmerId,
          transfer_type: "borga_return",
          remark: remark.trim() || null,
          transferred_at: transferredOn,
          office_id: sourceLand.office_id ?? officeId ?? null,
          created_by: user?.id ?? null,
          source_dag_no: sourceLand.dag_no ?? null,
          source_mouza: sourceLand.mouza ?? null,
          source_land_size: Number(sourceLand.land_size) || null,
        } as any);
        if (trErr) throw trErr;
        toast.success(tx("Land reclaimed", "জমি ফেরত নেওয়া হয়েছে"));
        onOpenChange(false);
        onDone();
      } catch (e: any) {
        toast.error(e.message || String(e));
      } finally {
        setSaving(false);
      }
      return;
    }

    if (recipients.length === 0) return toast.error(tx("Add at least one recipient", "অন্তত একজন প্রাপক যোগ করুন"));
    if (recipients.some(r => !r.farmer_id)) return toast.error(tx("Select farmer for each recipient", "প্রতিটি প্রাপকের জন্য কৃষক নির্বাচন করুন"));
    if (new Set(recipients.map(r => r.farmer_id)).size !== recipients.length) return toast.error(tx("Recipients must be unique", "প্রাপকগণ অনন্য হতে হবে"));
    if (!equalSplit && effectiveSum - totalLand > 0.005) return toast.error(tx("Allocated area exceeds source land", "বরাদ্দকৃত পরিমাণ মূল জমির চেয়ে বেশি"));
    if (effectiveAreas.some(a => !(a > 0))) return toast.error(tx("Each recipient area must be > 0", "প্রতিটি প্রাপকের পরিমাণ ০ এর বেশি হতে হবে"));

    setSaving(true);
    try {
      // Transfer-back restriction: a recipient cannot be a prior owner who already
      // transferred this same dag/mouza to the current owner (no reversing transfers).
      const { data: priorTr } = await db
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
      const reversing = !isBorgaGive && recipients.find(r => blocked.has(r.farmer_id));
      if (reversing) {
        setSaving(false);
        return toast.error(tx("Cannot transfer back to a previous owner of this land.", "এই জমি আগের মালিক/বর্গাদারে ফেরত transfer করা যাবে না।"));
      }

      // Snapshot source owner details so history survives later land changes
      const { data: srcFarmer } = await db.from("farmers")
        .select("name_en,name_bn,farmer_code,member_no").eq("id", sourceFarmerId).maybeSingle();

      const { data: tr, error: trErr } = await db.from("land_transfers").insert({
        source_land_id: sourceLand.id,
        source_farmer_id: sourceFarmerId,
        transfer_type: transferType,
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

      for (let i = 0; i < recipients.length; i++) {
        const r = recipients[i];
        const area = normalizeLandSize(effectiveAreas[i]);

        if (isBorgaGive) {
          // Borga: the OWNER keeps the full parcel intact. Record the given-out
          // area as a land_relations row on the owner's land — this is the single
          // source of truth for both display (shown in BOTH profiles) and
          // irrigation splitting (owner pays remainder, sharecropper pays borga).
          const { error: relErr } = await db.from("land_relations").insert({
            land_id: sourceLand.id,
            owner_farmer_id: sourceFarmerId,
            sharecropper_farmer_id: r.farmer_id,
            area_decimal: area,
            share_percentage: totalLand > 0 ? +(((area / totalLand) * 100).toFixed(4)) : 0,
            valid_from: transferredOn,
            office_id: sourceLand.office_id ?? officeId ?? null,
            created_by: user?.id ?? null,
            note: remark.trim() || null,
          } as any);
          if (relErr) throw relErr;

          const { error: rcErr } = await db.from("land_transfer_recipients").insert({
            transfer_id: transferId,
            recipient_farmer_id: r.farmer_id,
            new_land_id: null,
            area_decimal: area,
          } as any);
          if (rcErr) throw rcErr;
          continue;
        }

        // Non-borga transfer (sale / inheritance / split / other): create new land
        // rows for each recipient (clone fields) + transfer recipient records.
        const newLandPayload: any = {
          farmer_id: r.farmer_id,
          mouza: sourceLand.mouza ?? null,
          dag_no: sourceLand.dag_no ?? null,
          land_size: area,
          owner_type: sourceLand.owner_type,
          field_type: sourceLand.field_type,
          owner_farmer_id: sourceLand.owner_type === "borgadar" ? sourceLand.owner_farmer_id : null,
          office_id: sourceLand.office_id ?? officeId ?? null,
          division_id: sourceLand.division_id ?? null,
          district_id: sourceLand.district_id ?? null,
          upazila_id: sourceLand.upazila_id ?? null,
          mouza_id: sourceLand.mouza_id ?? null,
          land_type_id: sourceLand.land_type_id ?? null,
          patwari_id: sourceLand.patwari_id ?? null,
        };
        const dagNo = (sourceLand.dag_no ?? "").trim();
        let landId: string;
        if (dagNo) {
          const { data: existing } = await db.from("lands")
            .select("id, land_size, deleted_at")
            .eq("farmer_id", r.farmer_id)
            .eq("dag_no", dagNo)
            .order("deleted_at", { ascending: true, nullsFirst: true })
            .limit(1)
            .maybeSingle();
          if (existing) {
            const wasDeleted = !!(existing as any).deleted_at;
            const nextSize = wasDeleted ? area : normalizeLandSize(Number(existing.land_size || 0) + area);
            const upd: any = { land_size: nextSize };
            if (wasDeleted) {
              upd.deleted_at = null;
              upd.owner_type = newLandPayload.owner_type;
              upd.owner_farmer_id = newLandPayload.owner_farmer_id;
            }
            const { error: upErr } = await db.from("lands").update(upd).eq("id", existing.id);
            if (upErr) throw upErr;
            landId = existing.id;
          } else {
            const { data: nl, error: nlErr } = await db.from("lands").insert(newLandPayload).select("id").single();
            if (nlErr) throw nlErr;
            landId = nl!.id;
          }
        } else {
          const { data: nl, error: nlErr } = await db.from("lands").insert(newLandPayload).select("id").single();
          if (nlErr) throw nlErr;
          landId = nl!.id;
        }

        const { error: rcErr } = await db.from("land_transfer_recipients").insert({
          transfer_id: transferId,
          recipient_farmer_id: r.farmer_id,
          new_land_id: landId,
          area_decimal: area,
        } as any);
        if (rcErr) throw rcErr;
      }

      // Borga keeps the owner's land row intact. Non-borga transfers move the
      // whole parcel out, so the source land row is archived (history preserved).
      if (!isBorgaGive) {
        const { error: delErr } = await db.from("lands").update({ deleted_at: new Date().toISOString() } as any).eq("id", sourceLand.id);
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
              {tx("Source", "মূল")}: <b>{sourceLand.dag_no}</b> — {sourceLand.mouza ?? "—"} — <b>{formatLand(totalLand)}</b> {tx("decimal", "শতক")}
              <div className="text-muted-foreground mt-1">{isBorgaGive ? tx("Borga: the owner keeps this parcel — only the given-out area moves to the sharecropper. The remaining area stays with the owner.", "বর্গা: মালিক এই জমির মালিকানা রাখবেন — শুধু বর্গা দেওয়া অংশ বর্গাদারের কাছে যাবে। অবশিষ্ট অংশ মালিকের কাছেই থাকবে।") : tx("The original land row will be archived. New land rows will be created for each recipient. History is preserved.", "মূল জমির রেকর্ড আর্কাইভ হবে। প্রতিটি প্রাপকের জন্য নতুন জমির রেকর্ড তৈরি হবে। ইতিহাস অপরিবর্তিত থাকবে।")}</div>
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
                {effectiveSum < totalLand && <span className="ml-2">{isBorgaGive ? tx("Remaining stays with the owner.", "অবশিষ্ট অংশ মালিকের কাছে থাকবে।") : tx("Remaining will be lost.", "অবশিষ্ট হারিয়ে যাবে।")}</span>}
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
