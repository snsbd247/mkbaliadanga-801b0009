// i18n-ignore-file — admin-only page (English UI)
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Upload, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type ExistingAccount = {
  id: string; code: string; name: string;
  type: AccountType; parent_id: string | null;
};

type Action = "create" | "update" | "skip" | "error";

type ParsedRow = {
  rowNum: number;     // line in source file (header = 1)
  raw: any;
  code: string;
  name: string;
  name_bn: string | null;
  type: AccountType | "";
  parent_code: string;
  is_active: boolean;
  action: Action;
  reason?: string;
  // resolved during preview:
  parent_id?: string | null;
  willAutoCreateParent?: boolean;
};

const VALID_TYPES: AccountType[] = ["asset", "liability", "equity", "income", "expense"];
const BATCH_SIZE = 25;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  existing: ExistingAccount[];
  onImported: () => void | Promise<void>;
}

export function CoaImportDialog({ open, onOpenChange, existing, onImported }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [autoCreateParents, setAutoCreateParents] = useState(true);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ created: number; updated: number; skipped: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null); setRows([]); setProgress(0); setDone(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = (o: boolean) => {
    if (!importing) {
      if (!o) reset();
      onOpenChange(o);
    }
  };

  // Build code maps from existing
  const existingByCode = useMemo(() => {
    const m = new Map<string, ExistingAccount>();
    existing.forEach((e) => m.set(e.code, e));
    return m;
  }, [existing]);

  const validateAndPreview = (parsed: any[]): ParsedRow[] => {
    const seenCodes = new Set<string>();
    const fileCodes = new Set<string>(parsed.map((r) => String(r.code ?? "").trim()).filter(Boolean));

    const out: ParsedRow[] = parsed.map((raw, idx) => {
      const rowNum = idx + 2;
      const code = String(raw.code ?? "").trim();
      const name = String(raw.name ?? "").trim();
      const type = String(raw.type ?? "").trim().toLowerCase() as AccountType;
      const name_bn = String(raw.name_bn ?? "").trim() || null;
      const parent_code = String(raw.parent_code ?? "").trim();
      const is_active = !["no", "false", "0"].includes(String(raw.is_active ?? "yes").toLowerCase());

      const base: ParsedRow = {
        rowNum, raw, code, name, name_bn, type, parent_code, is_active, action: "skip",
      };

      if (!code || !name) return { ...base, action: "error", reason: "Missing code or name" };
      if (!VALID_TYPES.includes(type)) return { ...base, action: "error", reason: `Invalid type "${raw.type}"` };
      if (seenCodes.has(code)) return { ...base, action: "error", reason: `Duplicate code in file` };
      seenCodes.add(code);
      if (parent_code && parent_code === code) {
        return { ...base, action: "error", reason: "parent_code equals own code" };
      }

      // Resolve parent
      let parent_id: string | null = null;
      let willAutoCreateParent = false;
      if (parent_code) {
        const inDb = existingByCode.get(parent_code);
        if (inDb) parent_id = inDb.id;
        else if (fileCodes.has(parent_code)) willAutoCreateParent = false; // will exist after sibling import
        else if (autoCreateParents) willAutoCreateParent = true;
        else return { ...base, action: "error", reason: `parent_code "${parent_code}" not found` };
      }

      const exists = existingByCode.get(code);
      const action: Action = exists ? "update" : "create";
      return { ...base, action, parent_id, willAutoCreateParent };
    });

    return out;
  };

  const handleFile = async (f: File) => {
    setFile(f);
    setDone(null);
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!data.length) {
        toast.error("File is empty");
        setRows([]);
        return;
      }
      setRows(validateAndPreview(data));
    } catch (e: any) {
      toast.error(e.message || "Failed to read file");
    }
  };

  // Re-evaluate when autoCreateParents toggles
  const handleAutoToggle = (v: boolean) => {
    setAutoCreateParents(v);
    if (rows.length) {
      const raws = rows.map((r) => r.raw);
      // recompute with new flag
      const seenCodes = new Set<string>();
      const fileCodes = new Set<string>(raws.map((r) => String(r.code ?? "").trim()).filter(Boolean));
      const out: ParsedRow[] = raws.map((raw, idx) => {
        const rowNum = idx + 2;
        const code = String(raw.code ?? "").trim();
        const name = String(raw.name ?? "").trim();
        const type = String(raw.type ?? "").trim().toLowerCase() as AccountType;
        const name_bn = String(raw.name_bn ?? "").trim() || null;
        const parent_code = String(raw.parent_code ?? "").trim();
        const is_active = !["no", "false", "0"].includes(String(raw.is_active ?? "yes").toLowerCase());
        const base: ParsedRow = { rowNum, raw, code, name, name_bn, type, parent_code, is_active, action: "skip" };
        if (!code || !name) return { ...base, action: "error", reason: "Missing code or name" };
        if (!VALID_TYPES.includes(type)) return { ...base, action: "error", reason: `Invalid type "${raw.type}"` };
        if (seenCodes.has(code)) return { ...base, action: "error", reason: "Duplicate code in file" };
        seenCodes.add(code);
        if (parent_code && parent_code === code) return { ...base, action: "error", reason: "parent_code equals own code" };
        let parent_id: string | null = null;
        let willAutoCreateParent = false;
        if (parent_code) {
          const inDb = existingByCode.get(parent_code);
          if (inDb) parent_id = inDb.id;
          else if (fileCodes.has(parent_code)) willAutoCreateParent = false;
          else if (v) willAutoCreateParent = true;
          else return { ...base, action: "error", reason: `parent_code "${parent_code}" not found` };
        }
        const exists = existingByCode.get(code);
        return { ...base, action: exists ? "update" : "create", parent_id, willAutoCreateParent };
      });
      setRows(out);
    }
  };

  const counts = useMemo(() => {
    const c = { create: 0, update: 0, skip: 0, error: 0, autoParent: 0 };
    rows.forEach((r) => {
      c[r.action]++;
      if (r.willAutoCreateParent) c.autoParent++;
    });
    return c;
  }, [rows]);

  const downloadErrorReport = (issues: { rowNum: number; code: string; reason: string }[]) => {
    const headers = ["row", "code", "issue"];
    const csv = [
      headers.join(","),
      ...issues.map((i) => {
        const reason = String(i.reason).replace(/"/g, '""');
        return [i.rowNum, i.code, /[,"\n]/.test(reason) ? `"${reason}"` : reason].join(",");
      }),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `coa-import-errors_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    setImporting(true); setProgress(0);
    const codeMap = new Map<string, string>();
    existing.forEach((e) => codeMap.set(e.code, e.id));

    const errors: { rowNum: number; code: string; reason: string }[] = [];
    let created = 0, updated = 0, skipped = 0;

    // 1) Pre-create missing parents (auto)
    const autoParents = new Set<string>();
    rows.forEach((r) => {
      if (r.willAutoCreateParent && r.parent_code && !codeMap.has(r.parent_code)) {
        autoParents.add(r.parent_code);
      }
    });
    if (autoParents.size > 0) {
      const parents = Array.from(autoParents).map((code) => {
        const child = rows.find((r) => r.parent_code === code);
        return { code, name: code, type: (child?.type as AccountType) || "asset", parent_id: null, is_active: true };
      });
      for (let i = 0; i < parents.length; i += BATCH_SIZE) {
        const slice = parents.slice(i, i + BATCH_SIZE);
        const { data, error } = await supabase.from("accounts").insert(slice).select("id,code");
        if (error) {
          slice.forEach((p) => errors.push({ rowNum: 0, code: p.code, reason: `Auto-parent: ${error.message}` }));
        } else {
          (data || []).forEach((d: any) => codeMap.set(d.code, d.id));
        }
      }
    }

    // 2) Process rows in 2 passes (so siblings declared in same file resolve as parents)
    const todo = rows.filter((r) => r.action === "create" || r.action === "update");
    let processed = 0;

    for (let pass = 0; pass < 2; pass++) {
      const remaining = todo.filter((r) => !codeMap.has(r.code) || existingByCode.has(r.code));
      // We always loop full todo set in pass 0; in pass 1, retry only those that got skipped due to missing parent
      const list = pass === 0 ? todo : todo.filter((r) => r.parent_code && !codeMap.get(r.parent_code) === false ? false : !!r.parent_code && !codeMap.get(r.parent_code));
      void remaining;

      for (let i = 0; i < list.length; i += BATCH_SIZE) {
        const batch = list.slice(i, i + BATCH_SIZE);
        for (const row of batch) {
          let parent_id: string | null = null;
          if (row.parent_code) {
            parent_id = codeMap.get(row.parent_code) || null;
            if (!parent_id) {
              if (pass === 1) {
                errors.push({ rowNum: row.rowNum, code: row.code, reason: `parent_code "${row.parent_code}" not found` });
              }
              continue;
            }
          }
          const payload = {
            code: row.code, name: row.name, name_bn: row.name_bn,
            type: row.type as AccountType, parent_id, is_active: row.is_active,
          };
          const existingId = codeMap.get(row.code);
          if (existingId && existingByCode.has(row.code)) {
            const { error } = await supabase.from("accounts").update(payload).eq("id", existingId);
            if (error) errors.push({ rowNum: row.rowNum, code: row.code, reason: error.message });
            else if (pass === 0) updated++;
          } else if (!existingId) {
            const { data: ins, error } = await supabase.from("accounts").insert(payload).select("id").single();
            if (error) {
              if (pass === 1) errors.push({ rowNum: row.rowNum, code: row.code, reason: error.message });
            } else {
              created++;
              codeMap.set(row.code, ins!.id);
            }
          }
          processed++;
          // approximate progress: pass0 is bulk of work
          setProgress(Math.min(99, Math.round((processed / Math.max(1, todo.length * 2)) * 100)));
          // tiny yield so UI repaints
          if (processed % 10 === 0) await new Promise((r) => setTimeout(r, 0));
        }
      }
    }

    skipped = rows.filter((r) => r.action === "skip").length;
    rows.filter((r) => r.action === "error").forEach((r) => errors.push({ rowNum: r.rowNum, code: r.code, reason: r.reason || "Validation error" }));

    setProgress(100);
    setDone({ created, updated, skipped, errors: errors.length });
    setImporting(false);

    if (errors.length) {
      toast.warning(`${created} created · ${updated} updated · ${errors.length} error(s)`);
      downloadErrorReport(errors);
    } else {
      toast.success(`Imported: ${created} created · ${updated} updated`);
    }
    await onImported();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Chart of Accounts</DialogTitle>
          <DialogDescription>
            Upload CSV/Excel. Preview will show what gets created, updated, or skipped before you confirm.
          </DialogDescription>
        </DialogHeader>

        {/* File picker */}
        {!file && (
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-2">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Choose a .csv, .xlsx or .xls file</p>
            <input
              ref={fileInputRef}
              type="file" accept=".csv,.xlsx,.xls" className="hidden" id="coa-import-input"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button asChild variant="outline" size="sm">
              <label htmlFor="coa-import-input" className="cursor-pointer">Select file</label>
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Required columns: <code>code, name, type</code> · Optional: <code>name_bn, parent_code, is_active</code>
            </p>
          </div>
        )}

        {/* Preview */}
        {file && rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="font-medium">{file.name}</span>
              <Badge variant="secondary">Create: {counts.create}</Badge>
              <Badge variant="secondary">Update: {counts.update}</Badge>
              {counts.error > 0 && <Badge variant="destructive">Error: {counts.error}</Badge>}
              {counts.autoParent > 0 && (
                <Badge variant="outline" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> {counts.autoParent} parent(s) will be auto-created
                </Badge>
              )}
              <Button size="sm" variant="ghost" className="ml-auto" onClick={reset} disabled={importing}>
                Choose different file
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="auto-parents"
                checked={autoCreateParents}
                onCheckedChange={(v) => handleAutoToggle(!!v)}
                disabled={importing}
              />
              <Label htmlFor="auto-parents" className="text-sm cursor-pointer">
                Auto-create missing parent accounts
              </Label>
            </div>

            {importing && (
              <div className="space-y-1">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Importing… {progress}%</p>
              </div>
            )}

            {done && (
              <div className="rounded-md border p-3 bg-muted/30 text-sm">
                <div className="font-medium mb-1">Import complete</div>
                <div className="text-muted-foreground">
                  {done.created} created · {done.updated} updated · {done.skipped} skipped
                  {done.errors > 0 && <span className="text-destructive"> · {done.errors} error(s) (CSV downloaded)</span>}
                </div>
              </div>
            )}

            <div className="overflow-auto flex-1 border rounded-md">
              <Table>
                <TableHeader className="sticky top-0 bg-background">
                  <TableRow>
                    <TableHead className="w-12">Row</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Parent</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 500).map((r) => (
                    <TableRow key={r.rowNum} className={r.action === "error" ? "bg-destructive/5" : ""}>
                      <TableCell className="text-xs text-muted-foreground">{r.rowNum}</TableCell>
                      <TableCell>
                        <Badge
                          variant={r.action === "create" ? "default" : r.action === "update" ? "secondary" : r.action === "error" ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          {r.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.code}</TableCell>
                      <TableCell className="text-sm">{r.name}</TableCell>
                      <TableCell className="capitalize text-xs">{r.type || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {r.parent_code || "—"}
                        {r.willAutoCreateParent && <Badge variant="outline" className="ml-1 text-[10px]">auto</Badge>}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.reason || ""}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 500 && (
                <div className="p-2 text-center text-xs text-muted-foreground bg-muted/30">
                  Showing 500 of {rows.length} rows. All rows will be processed.
                </div>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          {done && done.errors > 0 && (
            <Button variant="outline" onClick={() => {/* already auto-downloaded */ toast.info("Error report was downloaded automatically.")}}>
              <Download className="mr-1 h-4 w-4" /> Re-download error report
            </Button>
          )}
          <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>
            {done ? "Close" : "Cancel"}
          </Button>
          {file && rows.length > 0 && !done && (
            <Button
              onClick={runImport}
              disabled={importing || counts.create + counts.update === 0}
            >
              {importing ? "Importing…" : `Confirm import (${counts.create + counts.update})`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
