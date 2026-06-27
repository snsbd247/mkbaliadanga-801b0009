// ধাপ ২ — পুরাতন (Historical) রশিদ এন্ট্রি পেজ
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FarmerSearchSelect, type FarmerLite } from "@/components/farmers/FarmerSearchSelect";
import { MouzaSelect } from "@/components/locations/MouzaSelect";
import { LandTypeSelect, codeToFieldType, useLandTypes } from "@/components/locations/LandTypeSelect";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { computeHistoricalAmounts } from "@/lib/historicalReceipt";
import { History } from "lucide-react";

type SeasonRow = { id: string; name: string | null; year: number | null; type: string | null };

export default function HistoricalReceiptEntry() {
  const { tx } = useLang();
  const { rows: landTypes } = useLandTypes();

  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonId, setSeasonId] = useState("");

  const [farmer, setFarmer] = useState<FarmerLite | null>(null);
  const [owner, setOwner] = useState<FarmerLite | null>(null);
  const [sameAsFarmer, setSameAsFarmer] = useState(true);

  const [mouza, setMouza] = useState("");
  const [dagNo, setDagNo] = useState("");
  const [landSize, setLandSize] = useState("");
  const [landTypeId, setLandTypeId] = useState<string>("");
  const [fieldType, setFieldType] = useState<string>("other");

  const [rate, setRate] = useState("");
  const [totalCharge, setTotalCharge] = useState("");
  const [dueAmount, setDueAmount] = useState("");
  const [receiptNo, setReceiptNo] = useState("");
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [dupWarn, setDupWarn] = useState(false);
  const [dupChecking, setDupChecking] = useState(false);

  useEffect(() => {
    supabase.from("seasons").select("id,name,year,type").order("year", { ascending: false })
      .then(({ data }) => {
        const list = (data ?? []) as SeasonRow[];
        setSeasons(list);
        if (list[0]) setSeasonId(list[0].id);
      });
  }, []);

  // Live duplicate pre-check: same irrigation receipt number already entered.
  useEffect(() => {
    const rn = receiptNo.trim();
    if (!rn) { setDupWarn(false); return; }
    let cancelled = false;
    setDupChecking(true);
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("payments")
        .select("id")
        .eq("kind", "irrigation")
        .eq("receipt_no", rn)
        .is("deleted_at", null)
        .limit(1);
      if (cancelled) return;
      setDupWarn((data?.length ?? 0) > 0);
      setDupChecking(false);
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [receiptNo]);


  function reset() {
    setFarmer(null); setOwner(null); setSameAsFarmer(true);
    setMouza(""); setDagNo(""); setLandSize(""); setLandTypeId(""); setFieldType("other");
    setRate(""); setTotalCharge(""); setDueAmount(""); setReceiptNo(""); setNote("");
  }

  async function submit() {
    if (!seasonId) return toast.error(tx("Select a season", "সিজন নির্বাচন করুন"));
    if (!farmer) return toast.error(tx("Select a farmer", "কৃষক নির্বাচন করুন"));
    const ownerId = sameAsFarmer ? farmer.id : owner?.id;
    if (!ownerId) return toast.error(tx("Select the owner", "মালিক নির্বাচন করুন"));
    if (!receiptNo.trim()) return toast.error(tx("Receipt no is required", "রশিদ নং দিন"));
    if (!collectionDate) return toast.error(tx("Collection date is required", "আদায়ের তারিখ দিন"));

    setSubmitting(true);
    try {
      const ltName = landTypes.find((l) => l.id === landTypeId)?.name_bn ?? landTypes.find((l) => l.id === landTypeId)?.name ?? null;
      const { data, error } = await supabase.functions.invoke("historical-receipt-entry", {
        body: {
          office_id: null,
          season_id: seasonId,
          farmer_id: farmer.id,
          owner_farmer_id: ownerId,
          mouza,
          dag_no: dagNo,
          land_size: Number(landSize) || 0,
          land_type_id: landTypeId || null,
          land_type_name: ltName,
          field_type: fieldType,
          rate: Number(rate) || 0,
          total_charge: Number(totalCharge) || 0,
          due_amount: Number(dueAmount) || 0,
          receipt_no: receiptNo.trim(),
          collection_date: collectionDate,
          note: note || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(tx("Historical receipt saved", "পুরাতন রশিদ সংরক্ষিত হয়েছে"));
      reset();
    } catch (e: any) {
      toast.error(e?.message ?? tx("Failed to save", "সংরক্ষণ ব্যর্থ"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-semibold">{tx("Historical Receipt Entry", "পুরাতন রশিদ এন্ট্রি")}</h1>
      </div>
      <p className="text-sm text-muted-foreground">
        {tx("Enter old/legacy irrigation receipts. They appear in the farmer/owner profile, paid history, collection report and can be re-printed in the new format.",
          "পুরাতন সেচ রশিদ এন্ট্রি করুন। এগুলো কৃষক/মালিকের প্রোফাইল, পরিশোধ ইতিহাস ও কালেকশন রিপোর্টে দেখাবে এবং নতুন ফরম্যাটে পুনঃপ্রিন্ট করা যাবে।")}
      </p>

      <Card className="p-4 space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{tx("Season", "সিজন")} *</Label>
            <Select value={seasonId} onValueChange={setSeasonId}>
              <SelectTrigger><SelectValue placeholder={tx("Select season", "সিজন নির্বাচন")} /></SelectTrigger>
              <SelectContent>
                {seasons.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{`${s.name ?? s.type ?? ""} ${s.year ?? ""}`.trim()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{tx("Collection Date", "আদায়ের তারিখ")} *</Label>
            <Input type="date" value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{tx("Farmer (Bargadar/Cultivator)", "কৃষক (বর্গাদার/চাষি)")} *</Label>
            <FarmerSearchSelect value={farmer?.id} onChange={(_, f) => setFarmer(f)} />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              {tx("Owner", "মালিক")}
              <label className="text-xs font-normal flex items-center gap-1">
                <input type="checkbox" checked={sameAsFarmer} onChange={(e) => setSameAsFarmer(e.target.checked)} />
                {tx("Same as farmer (own land)", "কৃষক নিজেই মালিক")}
              </label>
            </Label>
            {sameAsFarmer ? (
              <Input value={farmer ? (farmer.name_bn || farmer.name_en) : ""} disabled placeholder={tx("Own land", "নিজস্ব জমি")} />
            ) : (
              <FarmerSearchSelect value={owner?.id} onChange={(_, f) => setOwner(f)} />
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>{tx("Mouza", "মৌজা")}</Label>
            <MouzaSelect value={mouza} onChange={setMouza} />
          </div>
          <div>
            <Label>{tx("Dag No (comma separated)", "দাগ নং (কমা দিয়ে একাধিক)")}</Label>
            <Input value={dagNo} onChange={(e) => setDagNo(e.target.value)} placeholder="123, 124" />
          </div>
          <div>
            <Label>{tx("Land Area", "জমির পরিমাণ")}</Label>
            <Input type="number" step="0.0001" value={landSize} onChange={(e) => setLandSize(e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <Label>{tx("Land Type", "জমির ধরন")}</Label>
            <LandTypeSelect
              landTypeId={landTypeId}
              fieldType={fieldType}
              onChange={(id, ft) => { setLandTypeId(id); setFieldType(ft || codeToFieldType(null)); }}
            />
          </div>
          <div>
            <Label>{tx("Rate (per acre)", "রেট (একর প্রতি)")}</Label>
            <Input type="number" step="0.01" value={rate} onChange={(e) => setRate(e.target.value)} />
          </div>
          <div>
            <Label>{tx("Total Charge", "মোট চার্জ")}</Label>
            <Input type="number" step="0.01" value={totalCharge} onChange={(e) => setTotalCharge(e.target.value)} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label>{tx("Due (if any)", "বকেয়া (যদি থাকে)")}</Label>
            <Input type="number" step="0.01" value={dueAmount} onChange={(e) => setDueAmount(e.target.value)} />
            <p className="text-xs text-muted-foreground mt-1">
              {tx("Collected = Total Charge − Due. Due carries to this season.",
                "আদায় = মোট চার্জ − বকেয়া। বকেয়া এই সিজনে যোগ হবে।")}
            </p>
            {(() => {
              const a = computeHistoricalAmounts(Number(totalCharge) || 0, Number(dueAmount) || 0);
              return (
                <p className="text-xs font-medium mt-1">
                  {tx("Collected", "আদায়")}: {a.paid} • {tx("Due", "বকেয়া")}:{" "}
                  <span className={a.due > 0 ? "text-destructive" : ""}>{a.due}</span>
                </p>
              );
            })()}
          </div>
          <div>
            <Label>{tx("Receipt No", "রশিদ নং")} *</Label>
            <Input value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} className={dupWarn ? "border-destructive" : ""} />
            {dupChecking && <p className="text-xs text-muted-foreground mt-1">{tx("Checking…", "যাচাই হচ্ছে…")}</p>}
            {dupWarn && (
              <p className="text-xs text-destructive mt-1">
                {tx("This receipt no already exists — cannot enter again.", "এই রশিদ নং ইতিমধ্যে আছে — আবার এন্ট্রি করা যাবে না।")}
              </p>
            )}
          </div>
        </div>

        <div>
          <Label>{tx("Note", "নোট")}</Label>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={reset} disabled={submitting}>{tx("Clear", "মুছুন")}</Button>
          <Button onClick={submit} disabled={submitting || dupWarn}>
            {submitting ? tx("Saving…", "সংরক্ষণ হচ্ছে…") : tx("Save Receipt", "রশিদ সংরক্ষণ")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
