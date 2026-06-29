import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Save } from "lucide-react";
import { DeleteButton } from "@/components/ui/action-icon-button";
import { money } from "@/lib/format";
import { useLang } from "@/i18n/LanguageProvider";

type Account = { id: string; code: string; name: string };
type Line = { account_id: string; debit: number; credit: number; description: string };

export default function JournalEntry() {
  const { t } = useLang();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", debit: 0, credit: 0, description: "" },
    { account_id: "", debit: 0, credit: 0, description: "" },
  ]);

  useEffect(() => {
    db.from("accounts").select("id,code,name").order("code")
      .then(({ data }) => setAccounts((data as Account[]) || []));
  }, []);

  const totalD = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalC = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.abs(totalD - totalC) < 0.01 && totalD > 0;

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const post = async () => {
    if (!balanced) return toast.error(t("debitMustEqualCredit"));
    if (lines.some((l) => !l.account_id)) return toast.error(t("selectAccountEveryLine"));

    const { data: header, error: e1 } = await db.from("journal_entries").insert({
      entry_date: date, reference, description, posted: false,
    }).select().single();
    if (e1 || !header) return toast.error(e1?.message || t("failedToCreateJournal"));

    const payload = lines.map((l, idx) => ({
      journal_id: header.id, account_id: l.account_id,
      debit: Number(l.debit) || 0, credit: Number(l.credit) || 0,
      description: l.description, position: idx,
    }));
    const { error: e2 } = await db.from("journal_entry_lines").insert(payload);
    if (e2) return toast.error(e2.message);

    const { error: e3 } = await db.from("journal_entries")
      .update({ posted: true }).eq("id", header.id);
    if (e3) return toast.error(e3.message);

    toast.success(t("journalPosted"));
    setReference(""); setDescription("");
    setLines([{ account_id: "", debit: 0, credit: 0, description: "" }, { account_id: "", debit: 0, credit: 0, description: "" }]);
  };

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader title={t("manualJournalEntry")} description={t("manualJournalEntryDesc")} />

      <Card>
        <CardHeader><CardTitle className="text-lg">{t("headerLabel")}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <div><Label>{t("date")}</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label>{t("referenceField")}</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="JV-001" /></div>
          <div><Label>{t("description")}</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg">{t("linesLabel")}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setLines([...lines, { account_id: "", debit: 0, credit: 0, description: "" }])}>
            <Plus className="mr-1 h-4 w-4" /> {t("addLine")}
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t("account")}</TableHead><TableHead>{t("description")}</TableHead>
              <TableHead className="text-right">{t("debit")}</TableHead>
              <TableHead className="text-right">{t("credit")}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={l.account_id} onValueChange={(v) => updateLine(i, { account_id: v })}>
                      <SelectTrigger><SelectValue placeholder={t("account")} /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={l.debit || ""} onChange={(e) => updateLine(i, { debit: Number(e.target.value), credit: 0 })} className="text-right" /></TableCell>
                  <TableCell><Input type="number" step="0.01" value={l.credit || ""} onChange={(e) => updateLine(i, { credit: Number(e.target.value), debit: 0 })} className="text-right" /></TableCell>
                  <TableCell>
                    <DeleteButton onClick={() => setLines(lines.filter((_, idx) => idx !== i))} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell colSpan={2}>{t("totals")}</TableCell>
                <TableCell className="text-right">{money(totalD)}</TableCell>
                <TableCell className="text-right">{money(totalC)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between">
            <span className={balanced ? "text-primary text-sm" : "text-destructive text-sm"}>
              {balanced ? `✅ ${t("balanced")}` : `⚠ ${t("difference")}: ${money(Math.abs(totalD - totalC))}`}
            </span>
            <Button onClick={post} disabled={!balanced}>
              <Save className="mr-1 h-4 w-4" /> {t("postJournal")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
