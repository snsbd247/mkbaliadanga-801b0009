import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { Search, ShieldAlert, History as HistoryIcon, Pencil } from "lucide-react";
import { EditButton } from "@/components/ui/action-icon-button";

type Row = {
  id: string;
  name_en: string;
  name_bn: string | null;
  member_no: string | null;
  account_number: string | null;
  voter_number: string | null;
  is_voter: boolean;
  office_id: string | null;
};

type AuditEntry = {
  id: string;
  created_at: string;
  user_id: string | null;
  action: string;
  old_values: any;
  new_values: any;
};

export default function IdReview() {
  const { isSuper } = useAuth();
  const { t } = useLang();
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Partial<Row>>({});
  const [saving, setSaving] = useState(false);
  const [historyFor, setHistoryFor] = useState<Row | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);

  useEffect(() => {
    document.title = t("idReviewTitle");
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("farmers")
      .select("id,name_en,name_bn,member_no,account_number,voter_number,is_voter,office_id")
      .is("deleted_at", null)
      .order("member_no", { ascending: true })
      .limit(2000);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setRows((data as any[]) ?? []);
  }

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      [r.name_en, r.name_bn, r.member_no, r.account_number, r.voter_number]
        .filter(Boolean).some(v => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  function openEdit(r: Row) {
    setEditing(r);
    setDraft({
      member_no: r.member_no ?? "",
      account_number: r.account_number ?? "",
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    const patch: any = {};
    const old: any = {};
    (["member_no", "account_number"] as const).forEach(k => {
      const newV = (draft[k] ?? "") as string;
      const oldV = (editing[k] ?? "") as string;
      if (newV !== oldV) { patch[k] = newV || null; old[k] = oldV || null; }
    });
    if (Object.keys(patch).length === 0) {
      setSaving(false);
      setEditing(null);
      return;
    }
    const { error } = await supabase.from("farmers").update(patch).eq("id", editing.id);
    if (error) { setSaving(false); toast.error(error.message); return; }

    // audit trail
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action: "id_override",
      entity: "farmers",
      entity_id: editing.id,
      office_id: editing.office_id,
      user_id: auth?.user?.id ?? null,
      old_values: old,
      new_values: patch,
      meta: { source: "id-review", actor: "super_admin" },
    } as any);

    toast.success(t("saved"));
    setSaving(false);
    setEditing(null);
    load();
  }

  async function openHistory(r: Row) {
    setHistoryFor(r);
    setHistory([]);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,created_at,user_id,action,old_values,new_values")
      .eq("entity", "farmers")
      .eq("entity_id", r.id)
      .in("action", ["id_override", "update", "voter_number_change"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); return; }
    setHistory((data as any[]) ?? []);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("idReviewTitle")}
        description={t("idReviewDesc")}
      />

      <Card className="p-3 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("idReviewSearchPh")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "…" : t("refresh")}
        </Button>
      </Card>

      {!isSuper && (
        <Card className="p-3 flex items-center gap-2 border-amber-300 bg-amber-50 text-amber-900">
          <ShieldAlert className="h-4 w-4" />
          <span className="text-sm">{t("superOnlyEdit")}</span>
        </Card>
      )}

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("farmerIdLabel")}</TableHead>
              <TableHead>{t("savingsAcNo")}</TableHead>
              <TableHead>{t("voterQ")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(r => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link to={`/farmers/${r.id}`} className="font-medium hover:underline">
                    {r.name_bn || r.name_en}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.member_no || "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.account_number || "—"}</TableCell>
                <TableCell>
                  {r.is_voter
                    ? <Badge variant="default">{t("yes")}</Badge>
                    : <Badge variant="secondary">{t("no")}</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button size="sm" variant="ghost" onClick={() => openHistory(r)} title={t("history")}>
                    <HistoryIcon className="h-4 w-4" />
                  </Button>
                  <EditButton disabled={!isSuper} onClick={() => openEdit(r)} title={t("edit")} />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  {t("noRecordsFound")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("superOverride")}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {editing.name_bn || editing.name_en}
              </div>
              <div>
                <Label>{t("farmerIdLabel")} <span className="text-xs text-muted-foreground">(5 digits)</span></Label>
                <Input
                  value={(draft.member_no ?? "") as string}
                  onChange={(e) => setDraft(d => ({ ...d, member_no: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                  maxLength={5}
                  inputMode="numeric"
                  placeholder="00001"
                />
              </div>
              <div>
                <Label>{t("savingsAcNo")} <span className="text-xs text-muted-foreground">(5 digits)</span></Label>
                <Input
                  value={(draft.account_number ?? "") as string}
                  onChange={(e) => setDraft(d => ({ ...d, account_number: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                  maxLength={5}
                  inputMode="numeric"
                  placeholder="00001"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {t("auditOnSave")}<br />
                Voter No = Savings A/C No (auto-synced; one and the same value).
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "…" : t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyFor} onOpenChange={(o) => !o && setHistoryFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {t("changeHistory")} — {historyFor?.name_bn || historyFor?.name_en}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("whenCol")}</TableHead>
                  <TableHead>{t("actionCol")}</TableHead>
                  <TableHead>{t("oldVal")}</TableHead>
                  <TableHead>{t("newVal")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map(h => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                    <TableCell><Badge variant="outline">{h.action}</Badge></TableCell>
                    <TableCell className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(h.old_values, null, 0)}</TableCell>
                    <TableCell className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(h.new_values, null, 0)}</TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      {t("noChanges")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
