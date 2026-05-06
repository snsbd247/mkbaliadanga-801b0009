import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  ChevronRight, ChevronDown, BookOpen, Plus, Pencil, Trash2, RefreshCw,
  Download, Upload,
} from "lucide-react";
import * as XLSX from "xlsx";
import { CoaImportDialog } from "./accounts/CoaImportDialog";
import { useLang } from "@/i18n/LanguageProvider";

type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

type Account = {
  id: string;
  code: string;
  name: string;
  name_bn: string | null;
  type: AccountType;
  parent_id: string | null;
  is_active: boolean;
  is_system: boolean;
};

type AccountNode = Account & {
  children: AccountNode[];
  depth: number;
  totalDebit: number;
  totalCredit: number;
  closing: number;
};

type LedgerSum = { account_id: string; debit: number; credit: number };

const TYPE_META: Record<AccountType, { labelKey: "typeAsset" | "typeLiability" | "typeEquity" | "typeIncome" | "typeExpense"; badgeClass: string }> = {
  asset:     { labelKey: "typeAsset",     badgeClass: "bg-sky-100 text-sky-700 hover:bg-sky-100 border-transparent" },
  liability: { labelKey: "typeLiability", badgeClass: "bg-rose-100 text-rose-700 hover:bg-rose-100 border-transparent" },
  equity:    { labelKey: "typeEquity",    badgeClass: "bg-violet-100 text-violet-700 hover:bg-violet-100 border-transparent" },
  income:    { labelKey: "typeIncome",    badgeClass: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-transparent" },
  expense:   { labelKey: "typeExpense",   badgeClass: "bg-orange-100 text-orange-700 hover:bg-orange-100 border-transparent" },
};

const SUMMARY_ORDER: { key: AccountType; labelKey: "assetsSection" | "liabilitiesSection" | "equitiesSection" | "incomesSection" | "expensesSection" }[] = [
  { key: "asset", labelKey: "assetsSection" },
  { key: "liability", labelKey: "liabilitiesSection" },
  { key: "equity", labelKey: "equitiesSection" },
  { key: "income", labelKey: "incomesSection" },
  { key: "expense", labelKey: "expensesSection" },
];

const money = (n: number) =>
  `৳${(n || 0).toLocaleString("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function Accounts() {
  const navigate = useNavigate();
  const { t } = useLang();
  const [rows, setRows] = useState<Account[]>([]);
  const [sums, setSums] = useState<Record<string, { debit: number; credit: number }>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // dialogs
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Account> & { parent_id?: string | null }>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: accs }, { data: led }] = await Promise.all([
      supabase.from("accounts").select("*").order("code"),
      supabase.from("ledger_entries").select("account_id,debit,credit"),
    ]);
    setRows((accs as Account[]) || []);
    const map: Record<string, { debit: number; credit: number }> = {};
    ((led as LedgerSum[]) || []).forEach((l) => {
      const cur = map[l.account_id] || { debit: 0, credit: 0 };
      cur.debit += Number(l.debit) || 0;
      cur.credit += Number(l.credit) || 0;
      map[l.account_id] = cur;
    });
    setSums(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Build tree with rolled-up totals
  const { tree, summary, allParentIds } = useMemo(() => {
    const byId = new Map<string, AccountNode>();
    rows.forEach((r) =>
      byId.set(r.id, {
        ...r, children: [], depth: 0,
        totalDebit: sums[r.id]?.debit || 0,
        totalCredit: sums[r.id]?.credit || 0,
        closing: 0,
      })
    );
    const roots: AccountNode[] = [];
    byId.forEach((n) => {
      if (n.parent_id && byId.has(n.parent_id)) byId.get(n.parent_id)!.children.push(n);
      else roots.push(n);
    });
    const setDepth = (n: AccountNode, d: number) => {
      n.depth = d;
      n.children.sort((a, b) => a.code.localeCompare(b.code));
      n.children.forEach((c) => setDepth(c, d + 1));
    };
    roots.sort((a, b) => a.code.localeCompare(b.code));
    roots.forEach((r) => setDepth(r, 0));

    // roll up
    const rollup = (n: AccountNode): { d: number; c: number } => {
      let d = sums[n.id]?.debit || 0;
      let c = sums[n.id]?.credit || 0;
      for (const ch of n.children) {
        const sub = rollup(ch);
        d += sub.d; c += sub.c;
      }
      n.totalDebit = d;
      n.totalCredit = c;
      const sign = n.type === "asset" || n.type === "expense" ? 1 : -1;
      n.closing = sign * (d - c);
      return { d, c };
    };
    roots.forEach(rollup);

    const sum: Record<AccountType, number> = {
      asset: 0, liability: 0, equity: 0, income: 0, expense: 0,
    };
    roots.forEach((r) => { sum[r.type] += r.closing; });

    const parentIds: string[] = [];
    const collectParents = (n: AccountNode) => {
      if (n.children.length) { parentIds.push(n.id); n.children.forEach(collectParents); }
    };
    roots.forEach(collectParents);

    return { tree: roots, summary: sum, allParentIds: parentIds };
  }, [rows, sums]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(allParentIds));
  const collapseAll = () => setExpanded(new Set());

  const openCreate = (parent?: AccountNode) => {
    setEditing({
      id: undefined,
      code: "",
      name: "",
      name_bn: "",
      type: parent?.type || "asset",
      parent_id: parent?.id || null,
      is_active: true,
    });
    setEditOpen(true);
  };

  const openEdit = (a: AccountNode) => {
    setEditing({ ...a });
    setEditOpen(true);
  };

  const save = async () => {
    if (!editing.code || !editing.name || !editing.type) {
      toast.error(t("codeNameTypeRequired"));
      return;
    }
    const payload = {
      code: editing.code,
      name: editing.name,
      name_bn: editing.name_bn || null,
      type: editing.type as AccountType,
      parent_id: editing.parent_id || null,
      is_active: editing.is_active ?? true,
    };
    if (editing.id) {
      const { error } = await supabase.from("accounts").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success(t("accountUpdated"));
    } else {
      const { error } = await supabase.from("accounts").insert(payload);
      if (error) return toast.error(error.message);
      toast.success(t("accountCreated"));
    }
    setEditOpen(false);
    await load();
  };

  const doDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("accounts").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else toast.success(t("accountDeleted"));
    setDeleteId(null);
    await load();
  };

  const recalc = async () => {
    await load();
    toast.success(t("balancesRecalculated"));
  };

  // ---------- CSV / Excel Export ----------
  const exportRows = () =>
    rows.map((r) => {
      const parent = r.parent_id ? rows.find((x) => x.id === r.parent_id) : null;
      return {
        code: r.code,
        name: r.name,
        name_bn: r.name_bn || "",
        type: r.type,
        parent_code: parent?.code || "",
        is_active: r.is_active ? "yes" : "no",
      };
    });

  const downloadBlob = (data: BlobPart, filename: string, mime: string) => {
    const blob = new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    const data = exportRows();
    const headers = ["code", "name", "name_bn", "type", "parent_code", "is_active"];
    const csv = [
      headers.join(","),
      ...data.map((r) =>
        headers.map((h) => {
          const v = String((r as any)[h] ?? "").replace(/"/g, '""');
          return /[,"\n]/.test(v) ? `"${v}"` : v;
        }).join(",")
      ),
    ].join("\n");
    downloadBlob("\uFEFF" + csv, `chart-of-accounts_${new Date().toISOString().slice(0,10)}.csv`, "text/csv;charset=utf-8");
  };

  const exportXLSX = () => {
    const ws = XLSX.utils.json_to_sheet(exportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Accounts");
    XLSX.writeFile(wb, `chart-of-accounts_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const downloadTemplate = () => {
    const sample = [
      { code: "1000", name: "Assets", name_bn: "সম্পদ", type: "asset", parent_code: "", is_active: "yes" },
      { code: "1100", name: "Cash", name_bn: "নগদ", type: "asset", parent_code: "1000", is_active: "yes" },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "chart-of-accounts_template.xlsx");
  };

  // ---------- Import (dialog) ----------
  const [importOpen, setImportOpen] = useState(false);

  // flatten visible rows
  const visible: AccountNode[] = [];
  const walk = (n: AccountNode) => {
    visible.push(n);
    if (expanded.has(n.id)) n.children.forEach(walk);
  };
  tree.forEach(walk);

  return (
    <div className="container mx-auto p-4 space-y-4">
      <PageHeader
        title={t("chartOfAccounts")}
        description={t("chartOfAccountsDesc")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={expandAll}>{t("expandAll")}</Button>
            <Button variant="outline" size="sm" onClick={collapseAll}>{t("collapseAll")}</Button>
            <Button variant="outline" size="sm" onClick={recalc}>
              <RefreshCw className="w-4 h-4 mr-1" /> {t("recalculate")}
            </Button>
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <Download className="w-4 h-4 mr-1" /> {t("template")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-1" /> {t("csv")}
            </Button>
            <Button variant="outline" size="sm" onClick={exportXLSX}>
              <Download className="w-4 h-4 mr-1" /> {t("excel" as any) || "Excel"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4 mr-1" /> {t("import" as any) || "Import"}
            </Button>
            <Button size="sm" onClick={() => openCreate()}>
              <Plus className="w-4 h-4 mr-1" /> {t("addAccount")}
            </Button>
          </div>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {SUMMARY_ORDER.map((s) => (
          <Card key={s.key} className="border-l-4" style={{ borderLeftColor: "hsl(var(--primary))" }}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t(s.labelKey)}</div>
              <div className="text-xl font-semibold mt-1">{money(summary[s.key] || 0)}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tree table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b">
                  <th className="text-left font-medium px-4 py-3">{t("accountName")}</th>
                  <th className="text-center font-medium px-4 py-3 w-24">{t("code")}</th>
                  <th className="text-center font-medium px-4 py-3 w-28">{t("typeLabel")}</th>
                  <th className="text-right font-medium px-4 py-3 w-32">{t("totalDebit")}</th>
                  <th className="text-right font-medium px-4 py-3 w-32">{t("totalCredit")}</th>
                  <th className="text-right font-medium px-4 py-3 w-36">{t("closingBalanceCol")}</th>
                  <th className="text-right font-medium px-4 py-3 w-40">{t("actionsCol")}</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("loading")}</td></tr>
                ) : visible.length === 0 ? (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">{t("noAccounts")}</td></tr>
                ) : visible.map((n) => {
                  const hasChildren = n.children.length > 0;
                  const isOpen = expanded.has(n.id);
                  return (
                    <tr key={n.id} className="border-b hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <div className="flex items-center" style={{ paddingLeft: n.depth * 20 }}>
                          {hasChildren ? (
                            <button
                              onClick={() => toggle(n.id)}
                              className="mr-1 text-muted-foreground hover:text-foreground"
                              aria-label="toggle"
                            >
                              {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                          ) : (
                            <span className="inline-block w-5" />
                          )}
                          <span className="font-medium">{n.name}</span>
                          {n.name_bn ? <span className="ml-2 text-xs text-muted-foreground">({n.name_bn})</span> : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-xs">{n.code}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className={TYPE_META[n.type].badgeClass}>{t(TYPE_META[n.type].labelKey)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(n.totalDebit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{money(n.totalCredit)}</td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">{money(n.closing)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={t("ledger")}
                            onClick={() => navigate(`/ledger?account=${n.id}`)}
                          >
                            <BookOpen className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={t("addAccount")}
                            onClick={() => openCreate(n)}
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8"
                            title={t("edit")}
                            onClick={() => openEdit(n)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            title={t("delete")}
                            disabled={n.is_system}
                            onClick={() => setDeleteId(n.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit / Create dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing.id ? t("editAccount") : t("addAccount")}</DialogTitle>
            <DialogDescription>
              {editing.parent_id ? t("subAccountUnder") : t("topLevel")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("code")}</Label>
              <Input
                value={editing.code || ""}
                onChange={(e) => setEditing({ ...editing, code: e.target.value })}
              />
            </div>
            <div>
              <Label>{t("typeLabel")}</Label>
              <Select
                value={editing.type as string}
                onValueChange={(v) => setEditing({ ...editing, type: v as AccountType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_META) as AccountType[]).map((tk) => (
                    <SelectItem key={tk} value={tk}>{t(TYPE_META[tk].labelKey)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>{t("name")}</Label>
              <Input
                value={editing.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("bnName")}</Label>
              <Input
                value={editing.name_bn || ""}
                onChange={(e) => setEditing({ ...editing, name_bn: e.target.value })}
              />
            </div>
            <div className="col-span-2">
              <Label>{t("parentAccount")}</Label>
              <Select
                value={editing.parent_id || "none"}
                onValueChange={(v) => setEditing({ ...editing, parent_id: v === "none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("noneTopLevel")}</SelectItem>
                  {rows
                    .filter((r) => r.id !== editing.id)
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.code} — {r.name}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save}>{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAccountQ")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAccountConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>{t("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* COA Import dialog */}
      <CoaImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existing={rows.map((r) => ({ id: r.id, code: r.code, name: r.name, type: r.type, parent_id: r.parent_id }))}
        onImported={load}
      />
    </div>
  );
}
