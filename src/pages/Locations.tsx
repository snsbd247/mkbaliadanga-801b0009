import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Pencil, Loader2, Search } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";

type Level = "divisions" | "districts" | "upazilas" | "unions" | "wards" | "villages" | "mouzas";
type Row = any;

// Full ancestry chain for each level (parents that must be selected, in order)
const CHAIN: Record<Level, { table: Level; col: string; label: string }[]> = {
  divisions: [],
  districts: [{ table: "divisions", col: "division_id", label: "Division" }],
  upazilas: [
    { table: "divisions", col: "division_id", label: "Division" },
    { table: "districts", col: "district_id", label: "District" },
  ],
  unions: [
    { table: "divisions", col: "division_id", label: "Division" },
    { table: "districts", col: "district_id", label: "District" },
    { table: "upazilas", col: "upazila_id", label: "Upazila" },
  ],
  wards: [
    { table: "divisions", col: "division_id", label: "Division" },
    { table: "districts", col: "district_id", label: "District" },
    { table: "upazilas", col: "upazila_id", label: "Upazila" },
    { table: "unions", col: "union_id", label: "Union" },
  ],
  villages: [
    { table: "divisions", col: "division_id", label: "Division" },
    { table: "districts", col: "district_id", label: "District" },
    { table: "upazilas", col: "upazila_id", label: "Upazila" },
    { table: "unions", col: "union_id", label: "Union" },
    { table: "wards", col: "ward_id", label: "Ward" },
  ],
  mouzas: [
    { table: "divisions", col: "division_id", label: "Division" },
    { table: "districts", col: "district_id", label: "District" },
    { table: "upazilas", col: "upazila_id", label: "Upazila" },
    { table: "unions", col: "union_id", label: "Union" },
    { table: "wards", col: "ward_id", label: "Ward" },
    { table: "villages", col: "village_id", label: "Village" },
  ],
};

// Which columns actually exist on the leaf table (the chain has all ancestors,
// but we only persist the immediate parent FK that the table actually has).
const DIRECT_PARENT_COL: Partial<Record<Level, string>> = {
  districts: "division_id",
  upazilas: "district_id",
  unions: "upazila_id",
  wards: "union_id",
  villages: "union_id", // also has ward_id (optional)
  mouzas: "union_id",   // also has ward_id (optional)
};

// Optional secondary FK on the table (not part of strict chain validation)
const OPTIONAL_PARENT_COL: Partial<Record<Level, string>> = {
  villages: "ward_id",
  mouzas: "ward_id",
};

// Lookup endpoint to fetch children of a parent for cascading dropdowns.
const childrenOf = async (table: Level, parentCol?: string, parentId?: string) => {
  let q: any = (supabase.from as any)(table).select("id,name,name_bn").eq("is_active", true).order("name").limit(2000);
  if (parentCol && parentId) q = q.eq(parentCol, parentId);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Row[]) ?? [];
};

type Chain = Partial<Record<string, string>>; // { division_id, district_id, ... }

/** Cascading filter bar — strictly enforces parent-before-child selection. */
function CascadeFilters({
  level,
  value,
  onChange,
  showLeafFilter = false,
}: {
  level: Level;
  value: Chain;
  onChange: (v: Chain) => void;
  showLeafFilter?: boolean;
}) {
  const { t } = useLang();
  const chain = CHAIN[level];
  const [opts, setOpts] = useState<Record<string, Row[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Load each level's options when its parent changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < chain.length; i++) {
        const step = chain[i];
        const parentStep = i === 0 ? null : chain[i - 1];
        const parentId = parentStep ? value[parentStep.col] : undefined;
        if (parentStep && !parentId) {
          if (!cancelled) setOpts((o) => ({ ...o, [step.col]: [] }));
          continue;
        }
        setLoading((l) => ({ ...l, [step.col]: true }));
        try {
          const rows = await childrenOf(step.table, parentStep?.col, parentId);
          if (!cancelled) setOpts((o) => ({ ...o, [step.col]: rows }));
        } catch (e: any) {
          toast.error(e.message);
        } finally {
          if (!cancelled) setLoading((l) => ({ ...l, [step.col]: false }));
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, ...chain.map((c, i) => (i === 0 ? "" : value[chain[i - 1].col] ?? ""))]);

  const setAt = (idx: number, id: string | undefined) => {
    const next: Chain = { ...value };
    // Set this level
    next[chain[idx].col] = id;
    // Reset all descendants
    for (let j = idx + 1; j < chain.length; j++) delete next[chain[j].col];
    onChange(next);
  };

  if (chain.length === 0 && !showLeafFilter) return null;

  return (
    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {chain.map((step, i) => {
        const parentStep = i === 0 ? null : chain[i - 1];
        const parentSelected = !parentStep || !!value[parentStep.col];
        const list = opts[step.col] ?? [];
        const isLoading = !!loading[step.col];
        return (
          <div key={step.col}>
            <Label className="text-xs">{step.label}</Label>
            <Select
              disabled={!parentSelected || isLoading}
              value={value[step.col] ?? ""}
              onValueChange={(v) => setAt(i, v || undefined)}
            >
              <SelectTrigger>
                {isLoading ? (
                  <span className="flex items-center text-muted-foreground text-sm"><Loader2 className="h-3 w-3 mr-1 animate-spin"/>Loading…</span>
                ) : (
                  <SelectValue placeholder={parentSelected ? "Select…" : `Select ${parentStep?.label} first`} />
                )}
              </SelectTrigger>
              <SelectContent>
                {list.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}{p.name_bn ? ` (${p.name_bn})` : ""}
                  </SelectItem>
                ))}
                {list.length === 0 && parentSelected && !isLoading && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">{t("noEntries")}</div>
                )}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}

function LevelTab({ level }: { level: Level }) {
  const { t } = useLang();
  const chain = CHAIN[level];
  const directCol = DIRECT_PARENT_COL[level];
  const optionalCol = OPTIONAL_PARENT_COL[level];

  // Filter state — cascading
  const [filter, setFilter] = useState<Chain>({});
  // Add form state — cascading (independent of filter so user can add anywhere)
  const [addChain, setAddChain] = useState<Chain>({});
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  // For villages/mouzas — optional ward
  const [optionalWardId, setOptionalWardId] = useState<string>("");
  const [wardsForOptional, setWardsForOptional] = useState<Row[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Edit dialog
  const [editing, setEditing] = useState<Row | null>(null);
  const [editChain, setEditChain] = useState<Chain>({});
  const [editName, setEditName] = useState("");
  const [editNameBn, setEditNameBn] = useState("");
  const [editOptionalWardId, setEditOptionalWardId] = useState<string>("");
  const [editWardsForOptional, setEditWardsForOptional] = useState<Row[]>([]);
  const [saving, setSaving] = useState(false);

  // Load list whenever filter changes (uses deepest filter, falls back to direct parent)
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level, JSON.stringify(filter)]);

  async function load() {
    setLoading(true);
    let q: any = (supabase.from as any)(level).select("*").order("name").limit(1000);
    if (directCol) {
      // Use the deepest filter that targets this table's direct parent column
      const filterId = filter[directCol];
      if (filterId) q = q.eq(directCol, filterId);
      else if (chain.length > 0) {
        // If a higher-level filter is set but direct parent isn't, scope through parent table
        // (e.g. filtering upazilas by selected division -> need district_id IN (...))
        // Find deepest selected filter
        for (let i = chain.length - 1; i >= 0; i--) {
          const sel = filter[chain[i].col];
          if (sel) {
            // Walk down to direct parent table to fetch matching IDs
            const ids = await idsUnder(chain, i, sel, directCol);
            if (ids === null) break; // direct parent matched at this level — already handled above
            if (ids.length === 0) { setRows([]); setLoading(false); return; }
            q = q.in(directCol, ids);
            break;
          }
        }
      }
    }
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as Row[]) ?? []);
  }

  // Returns IDs of rows in `directCol` parent table that descend from `selectedId` at `chain[idx]`.
  async function idsUnder(c: typeof chain, idx: number, selectedId: string, targetCol: string): Promise<string[] | null> {
    if (c[idx].col === targetCol) return null;
    let currentIds: string[] = [selectedId];
    for (let j = idx + 1; j < c.length; j++) {
      const step = c[j];
      const parentCol = c[j - 1].col;
      const { data, error } = await (supabase.from as any)(step.table).select("id").in(parentCol, currentIds).limit(5000);
      if (error) { toast.error(error.message); return []; }
      currentIds = ((data as Row[]) ?? []).map((r) => r.id);
      if (step.col === targetCol) return currentIds;
      if (currentIds.length === 0) return [];
    }
    return currentIds;
  }

  // Wards for optional ward selector (villages/mouzas) — depends on Add union_id
  useEffect(() => {
    if (!optionalCol) return;
    const unionId = addChain.union_id;
    if (!unionId) { setWardsForOptional([]); setOptionalWardId(""); return; }
    childrenOf("wards", "union_id", unionId).then(setWardsForOptional).catch((e) => toast.error(e.message));
  }, [addChain.union_id, optionalCol]);

  useEffect(() => {
    if (!optionalCol || !editing) return;
    const unionId = editChain.union_id;
    if (!unionId) { setEditWardsForOptional([]); return; }
    childrenOf("wards", "union_id", unionId).then(setEditWardsForOptional).catch((e) => toast.error(e.message));
  }, [editChain.union_id, optionalCol, editing]);

  async function add() {
    if (!name.trim()) return toast.error(t("nameRequired"));
    // Validate full chain selected
    for (const step of chain) {
      if (!addChain[step.col]) return toast.error(`Please select ${step.label} first`);
    }
    const payload: any = { name: name.trim(), name_bn: nameBn.trim() || null };
    if (directCol) payload[directCol] = addChain[directCol];
    if (optionalCol && optionalWardId) payload[optionalCol] = optionalWardId;

    const { error } = await (supabase.from as any)(level).insert(payload);
    if (error) return toast.error(error.message);
    toast.success(t("addedToast"));
    setName(""); setNameBn(""); setOptionalWardId("");
    load();
  }

  async function remove(id: string) {
    if (!confirm(t("confirmDeleteEntry"))) return;
    const { error } = await (supabase.from as any)(level).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("deletedToast")); load();
  }

  // ----- EDIT -----
  async function openEdit(row: Row) {
    setEditing(row);
    setEditName(row.name ?? "");
    setEditNameBn(row.name_bn ?? "");
    // Resolve full ancestor chain for this row's direct parent
    const c: Chain = {};
    if (directCol && row[directCol]) {
      c[directCol] = row[directCol];
      // Walk up the chain to fill ancestor IDs
      const idx = chain.findIndex((s) => s.col === directCol);
      let currentTable = chain[idx].table;
      let currentId = row[directCol];
      for (let j = idx - 1; j >= 0; j--) {
        const parentStep = chain[j];
        const { data } = await (supabase.from as any)(currentTable).select(`${parentStep.col}`).eq("id", currentId).maybeSingle();
        if (!data) break;
        c[parentStep.col] = (data as any)[parentStep.col];
        currentId = (data as any)[parentStep.col];
        currentTable = parentStep.table;
      }
    }
    setEditChain(c);
    if (optionalCol) setEditOptionalWardId(row[optionalCol] ?? "");
    else setEditOptionalWardId("");
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editName.trim()) return toast.error(t("nameRequired"));
    for (const step of chain) {
      if (!editChain[step.col]) return toast.error(`Please select ${step.label}`);
    }
    setSaving(true);
    const payload: any = { name: editName.trim(), name_bn: editNameBn.trim() || null };
    if (directCol) payload[directCol] = editChain[directCol];
    if (optionalCol) payload[optionalCol] = editOptionalWardId || null;

    const { error } = await (supabase.from as any)(level).update(payload).eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("updatedToast"));
    setEditing(null);
    load();
  }

  // Filtered rows by search
  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.name ?? "").toLowerCase().includes(q) || (r.name_bn ?? "").toLowerCase().includes(q));
  }, [rows, search]);

  // Parent label cache for table display
  const [parentNames, setParentNames] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!directCol || rows.length === 0) return;
    const ids = Array.from(new Set(rows.map((r) => r[directCol]).filter(Boolean)));
    if (ids.length === 0) { setParentNames({}); return; }
    const parentTable = chain[chain.length - 1].table;
    (supabase.from as any)(parentTable).select("id,name").in("id", ids).then(({ data }: any) => {
      const map: Record<string, string> = {};
      ((data as Row[]) ?? []).forEach((p) => { map[p.id] = p.name; });
      setParentNames(map);
    });
  }, [rows, directCol]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      {chain.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">{t("filter")}</CardTitle></CardHeader>
          <CardContent>
            <CascadeFilters level={level} value={filter} onChange={setFilter} />
            {Object.keys(filter).length > 0 && (
              <Button size="sm" variant="ghost" className="mt-2" onClick={() => setFilter({})}>{t("clearFilters")}</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add form */}
      <Card>
        <CardHeader><CardTitle className="text-base">Add new {level.slice(0, -1)}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {chain.length > 0 && (
            <CascadeFilters level={level} value={addChain} onChange={setAddChain} />
          )}
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
            {optionalCol && (
              <div>
                <Label className="text-xs">Ward (optional)</Label>
                <Select value={optionalWardId || "__none__"} onValueChange={(v) => setOptionalWardId(v === "__none__" ? "" : v)} disabled={!addChain.union_id}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {wardsForOptional.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Name (English) *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Name (Bangla)</Label>
              <Input value={nameBn} onChange={(e) => setNameBn(e.target.value)} />
            </div>
          </div>
          <Button onClick={add}><Plus className="h-4 w-4 mr-1"/>Add</Button>
        </CardContent>
      </Card>

      {/* Listing */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base capitalize">{level} ({visibleRows.length})</CardTitle>
          <div className="relative w-56">
            <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground"/>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="pl-8 h-9"/>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("bnName")}</TableHead>
                  {directCol && <TableHead>{chain[chain.length - 1].label}</TableHead>}
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6"><Loader2 className="h-4 w-4 animate-spin inline mr-2"/>Loading…</TableCell></TableRow>
                ) : visibleRows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{t("noEntries")}</TableCell></TableRow>
                ) : visibleRows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.name_bn ?? "—"}</TableCell>
                    {directCol && <TableCell className="text-muted-foreground">{parentNames[r[directCol]] ?? (r[directCol] ? "…" : "—")}</TableCell>}
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label="Edit"><Pencil className="h-4 w-4"/></Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)} aria-label="Delete"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit {level.slice(0, -1)}</DialogTitle>
            <DialogDescription>Update name and parent hierarchy. Existing references stay intact.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {chain.length > 0 && (
              <CascadeFilters level={level} value={editChain} onChange={setEditChain} />
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              {optionalCol && (
                <div className="sm:col-span-2">
                  <Label className="text-xs">Ward (optional)</Label>
                  <Select value={editOptionalWardId || "__none__"} onValueChange={(v) => setEditOptionalWardId(v === "__none__" ? "" : v)} disabled={!editChain.union_id}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {editWardsForOptional.map((w) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label className="text-xs">Name (English) *</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Name (Bangla)</Label>
                <Input value={editNameBn} onChange={(e) => setEditNameBn(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>{t("cancel")}</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin"/>}{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Locations() {
  const { isSuper, rolesLoaded } = useAuth();
  const { t } = useLang();
  useEffect(() => { document.title = t("locations"); }, [t]);
  if (!rolesLoaded) return <div className="p-6 text-muted-foreground">{t("loading" as any) || "Loading…"}</div>;
  if (!isSuper) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title={t("locations")}
        description={t("locationsManagementDesc" as any) || "Manage divisions, districts, upazilas, unions, wards, villages, and mouzas with strict cascading hierarchy."}
      />
      <div className="rounded-md border bg-muted/30 p-3 mb-4 text-xs text-muted-foreground flex gap-2">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0"/>
        <span>{t("locationsHierarchyNote" as any) || "Edits preserve existing parent-child relationships. Cascading filters require selecting parents in order. Existing farmers and lands keep their original references."}</span>
      </div>
      <Tabs defaultValue="divisions">
        <TabsList className="flex-wrap">
          <TabsTrigger value="divisions">{t("divisions")}</TabsTrigger>
          <TabsTrigger value="districts">{t("districts")}</TabsTrigger>
          <TabsTrigger value="upazilas">{t("upazilas")}</TabsTrigger>
          <TabsTrigger value="unions">{t("unions")}</TabsTrigger>
          <TabsTrigger value="wards">{t("wards")}</TabsTrigger>
          <TabsTrigger value="villages">{t("villages")}</TabsTrigger>
          <TabsTrigger value="mouzas">{t("mouzas")}</TabsTrigger>
        </TabsList>
        <TabsContent value="divisions" className="mt-4"><LevelTab level="divisions"/></TabsContent>
        <TabsContent value="districts" className="mt-4"><LevelTab level="districts"/></TabsContent>
        <TabsContent value="upazilas"  className="mt-4"><LevelTab level="upazilas"/></TabsContent>
        <TabsContent value="unions"    className="mt-4"><LevelTab level="unions"/></TabsContent>
        <TabsContent value="wards"     className="mt-4"><LevelTab level="wards"/></TabsContent>
        <TabsContent value="villages"  className="mt-4"><LevelTab level="villages"/></TabsContent>
        <TabsContent value="mouzas"    className="mt-4"><LevelTab level="mouzas"/></TabsContent>
      </Tabs>
    </>
  );
}
