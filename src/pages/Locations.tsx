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
import { toast } from "sonner";
import { Plus, Trash2, MapPin } from "lucide-react";

type Level = "divisions" | "districts" | "upazilas" | "unions" | "wards" | "mouzas";
type Row = any;

const PARENT: Record<Level, { table?: Level; col?: string; label?: string }> = {
  divisions: {},
  districts: { table: "divisions", col: "division_id", label: "Division" },
  upazilas: { table: "districts", col: "district_id", label: "District" },
  unions:   { table: "upazilas",  col: "upazila_id",  label: "Upazila" },
  wards:    { table: "unions",    col: "union_id",    label: "Union" },
  mouzas:   { table: "unions",    col: "union_id",    label: "Union" },
};

function LevelTab({ level }: { level: Level }) {
  const parent = PARENT[level];
  const [parents, setParents] = useState<Row[]>([]);
  const [parentFilter, setParentFilter] = useState<string>("__all__");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [parentId, setParentId] = useState<string>("");

  useEffect(() => {
    if (parent.table) {
      supabase.from(parent.table).select("id,name").order("name")
        .then(({ data }) => setParents((data as any) ?? []));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentFilter]);

  async function load() {
    setLoading(true);
    let q = supabase.from(level).select("*").order("name").limit(500);
    if (parent.col && parentFilter !== "__all__") q = q.eq(parent.col, parentFilter);
    const { data, error } = await q;
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) ?? []);
  }

  async function add() {
    if (!name.trim()) return toast.error("Name required");
    if (parent.col && !parentId) return toast.error(`Pick a ${parent.label}`);
    const payload: any = { name: name.trim(), name_bn: nameBn.trim() || null };
    if (parent.col) payload[parent.col] = parentId;
    const { error } = await supabase.from(level).insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Added");
    setName(""); setNameBn("");
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete this entry? Existing farmers/lands referencing it will keep their address text but lose the link.")) return;
    const { error } = await supabase.from(level).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); load();
  }

  const parentName = useMemo(() => {
    const m = new Map(parents.map((p) => [p.id, p.name]));
    return (id?: string) => (id ? m.get(id) ?? "—" : "—");
  }, [parents]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Add new {level.slice(0, -1)}</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-4 sm:items-end">
          {parent.col && (
            <div>
              <Label className="text-xs">{parent.label} *</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
          <Button onClick={add} className="sm:w-auto"><Plus className="h-4 w-4 mr-1"/>Add</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base capitalize">{level} ({rows.length})</CardTitle>
          {parent.col && (
            <div className="w-48">
              <Select value={parentFilter} onValueChange={setParentFilter}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All {parent.label}s</SelectItem>
                  {parents.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="table-responsive">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Bangla</TableHead>
                  {parent.col && <TableHead>{parent.label}</TableHead>}
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">No entries</TableCell></TableRow>
                ) : rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.name_bn ?? "—"}</TableCell>
                    {parent.col && <TableCell className="text-muted-foreground">{parentName(r[parent.col!])}</TableCell>}
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => remove(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Locations() {
  const { isSuper } = useAuth();
  useEffect(() => { document.title = "Locations"; }, []);
  if (!isSuper) return <Navigate to="/" replace />;

  return (
    <>
      <PageHeader
        title="Location Management"
        description="Manage divisions, districts, upazilas, unions, wards, and mouzas. Optional and additive — old records continue to work."
      />
      <div className="rounded-md border bg-muted/30 p-3 mb-4 text-xs text-muted-foreground flex gap-2">
        <MapPin className="h-4 w-4 mt-0.5 shrink-0"/>
        <span>Locations are optional. Existing farmers and lands keep their original address text. New farmers can be linked through the cascading picker on the create form.</span>
      </div>
      <Tabs defaultValue="divisions">
        <TabsList className="flex-wrap">
          <TabsTrigger value="divisions">Divisions</TabsTrigger>
          <TabsTrigger value="districts">Districts</TabsTrigger>
          <TabsTrigger value="upazilas">Upazilas</TabsTrigger>
          <TabsTrigger value="unions">Unions</TabsTrigger>
          <TabsTrigger value="wards">Wards</TabsTrigger>
          <TabsTrigger value="mouzas">Mouzas</TabsTrigger>
        </TabsList>
        <TabsContent value="divisions" className="mt-4"><LevelTab level="divisions"/></TabsContent>
        <TabsContent value="districts" className="mt-4"><LevelTab level="districts"/></TabsContent>
        <TabsContent value="upazilas"  className="mt-4"><LevelTab level="upazilas"/></TabsContent>
        <TabsContent value="unions"    className="mt-4"><LevelTab level="unions"/></TabsContent>
        <TabsContent value="wards"     className="mt-4"><LevelTab level="wards"/></TabsContent>
        <TabsContent value="mouzas"    className="mt-4"><LevelTab level="mouzas"/></TabsContent>
      </Tabs>
    </>
  );
}
