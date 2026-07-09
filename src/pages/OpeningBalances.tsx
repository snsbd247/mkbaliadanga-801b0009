import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { money } from "@/lib/format";
import { getFiscalStartMonth, listFiscalYears } from "@/lib/accounting";
import { useLang } from "@/i18n/LanguageProvider";
import { toast } from "@/hooks/use-toast";
import { Save, Wallet } from "lucide-react";

type Office = { id: string; name: string };
type OpeningRow = {
  id: string;
  office_id: string | null;
  fiscal_year: string;
  irrigation_cash: number;
  savings_cash: number;
  note: string | null;
};

export default function OpeningBalances() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [offices, setOffices] = useState<Office[]>([]);
  const [rows, setRows] = useState<OpeningRow[]>([]);
  const [fyStartMonth, setFyStartMonth] = useState(7);
  const [officeId, setOfficeId] = useState<string>("none");
  const [fy, setFy] = useState<string>("");
  const [irrigationCash, setIrrigationCash] = useState<string>("");
  const [savingsCash, setSavingsCash] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fyOptions = useMemo(() => listFiscalYears(fyStartMonth, 8), [fyStartMonth]);

  const load = async () => {
    const { data } = await db.from("opening_balances").select("*").order("fiscal_year", { ascending: false });
    setRows((data as OpeningRow[]) ?? []);
  };

  useEffect(() => {
    document.title = bn ? "প্রারম্ভিক ক্যাশ ব্যালেন্স" : "Opening Cash Balances";
    (async () => {
      const [{ data: offs }, m] = await Promise.all([
        db.from("offices").select("id,name").order("name"),
        getFiscalStartMonth(),
      ]);
      setOffices((offs as Office[]) ?? []);
      setFyStartMonth(m);
      const fys = listFiscalYears(m, 1);
      if (fys[0]) setFy(fys[0].label);
    })();
    load();
  }, [bn]);

  // When office+fy selected, prefill from an existing row.
  useEffect(() => {
    const existing = rows.find(
      (r) => (r.office_id ?? "none") === officeId && r.fiscal_year === fy,
    );
    setIrrigationCash(existing ? String(existing.irrigation_cash) : "");
    setSavingsCash(existing ? String(existing.savings_cash) : "");
    setNote(existing?.note ?? "");
  }, [officeId, fy, rows]);

  const save = async () => {
    if (!fy) {
      toast({ title: bn ? "অর্থবছর নির্বাচন করুন" : "Select a fiscal year", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      office_id: officeId === "none" ? null : officeId,
      fiscal_year: fy,
      irrigation_cash: Number(irrigationCash || 0),
      savings_cash: Number(savingsCash || 0),
      note: note || null,
    };
    const existing = rows.find(
      (r) => (r.office_id ?? "none") === officeId && r.fiscal_year === fy,
    );
    const res = existing
      ? await db.from("opening_balances").update(payload).eq("id", existing.id)
      : await db.from("opening_balances").insert(payload);
    setSaving(false);
    if (res.error) {
      toast({ title: bn ? "সংরক্ষণ ব্যর্থ" : "Save failed", description: res.error.message, variant: "destructive" });
      return;
    }
    toast({ title: bn ? "সংরক্ষিত হয়েছে" : "Saved" });
    load();
  };

  const officeName = (id: string | null) =>
    id ? offices.find((o) => o.id === id)?.name ?? id : bn ? "সব অফিস" : "All Offices";

  return (
    <div className="space-y-6">
      <PageHeader
        title={bn ? "প্রারম্ভিক ক্যাশ ব্যালেন্স" : "Opening Cash Balances"}
        description={
          bn
            ? "অর্থবছরের শুরুতে হাতে থাকা নগদ (সেচ ও সেভিংস) লিখুন — এতে আর্থিক সারসংক্ষেপে প্রকৃত ক্যাশ দেখাবে।"
            : "Enter cash on hand at the start of each fiscal year (irrigation & savings) so Financial Summary shows real funds."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" /> {bn ? "প্রারম্ভিক ব্যালেন্স যোগ / সম্পাদনা" : "Add / Edit Opening Balance"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1">
            <Label>{bn ? "অফিস" : "Office"}</Label>
            <Select value={officeId} onValueChange={setOfficeId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{bn ? "সব অফিস (সাধারণ)" : "All Offices (global)"}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{bn ? "অর্থবছর" : "Fiscal Year"}</Label>
            <Select value={fy} onValueChange={setFy}>
              <SelectTrigger><SelectValue placeholder={bn ? "নির্বাচন" : "Select"} /></SelectTrigger>
              <SelectContent>
                {fyOptions.map((f) => <SelectItem key={f.label} value={f.label}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{bn ? "সেচ প্রারম্ভিক নগদ" : "Irrigation Opening Cash"}</Label>
            <Input type="number" step="0.01" value={irrigationCash} onChange={(e) => setIrrigationCash(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1">
            <Label>{bn ? "সেভিংস প্রারম্ভিক নগদ" : "Savings Opening Cash"}</Label>
            <Input type="number" step="0.01" value={savingsCash} onChange={(e) => setSavingsCash(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>{bn ? "নোট (ঐচ্ছিক)" : "Note (optional)"}</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={1} />
          </div>
          <div className="flex items-end">
            <Button onClick={save} disabled={saving}>
              <Save className="mr-1 h-4 w-4" /> {saving ? (bn ? "সংরক্ষণ হচ্ছে…" : "Saving…") : bn ? "সংরক্ষণ" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{bn ? "নথিভুক্ত প্রারম্ভিক ব্যালেন্স" : "Recorded Opening Balances"}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{bn ? "অর্থবছর" : "Fiscal Year"}</TableHead>
                <TableHead>{bn ? "অফিস" : "Office"}</TableHead>
                <TableHead className="text-right">{bn ? "সেচ নগদ" : "Irrigation Cash"}</TableHead>
                <TableHead className="text-right">{bn ? "সেভিংস নগদ" : "Savings Cash"}</TableHead>
                <TableHead>{bn ? "নোট" : "Note"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{bn ? "কোনো তথ্য নেই" : "No records yet"}</TableCell></TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.fiscal_year}</TableCell>
                  <TableCell>{officeName(r.office_id)}</TableCell>
                  <TableCell className="text-right">{money(r.irrigation_cash)}</TableCell>
                  <TableCell className="text-right">{money(r.savings_cash)}</TableCell>
                  <TableCell className="text-muted-foreground">{r.note || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
