import { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useLang } from "@/i18n/LanguageProvider";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveMouzaName } from "@/lib/mouzaQuery";
import { toast } from "sonner";

type Stats = { total: number; missing: number; orphan: number };

export default function MouzaDataHealth() {
  const { t, tx } = useLang();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats>({ total: 0, missing: 0, orphan: 0 });
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => { document.title = `${tx("Mouza Data Health", "মৌজা ডাটা হেলথ")} — ${t("appName")}`; }, [t, tx]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await db
      .from("lands")
      .select("id, dag_no, mouza, mouza_id, mouzas(name_bn,name), farmers(name_bn,name_en,farmer_code)")
      .is("deleted_at", null)
      .limit(2000);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = data ?? [];
    const missingList = list.filter((r: any) => !r.mouza_id);
    const orphanList = list.filter((r: any) => r.mouza_id && !r.mouzas);
    setStats({ total: list.length, missing: missingList.length, orphan: orphanList.length });
    setRows([...missingList, ...orphanList]);
    setLoading(false);
  }

  return (
    <>
      <PageHeader
        title={tx("Mouza Data Health", "মৌজা ডাটা হেলথ")}
        description={tx("Lands with missing or broken mouza links", "মৌজা লিংক নেই বা ভাঙা এমন জমি")}
        actions={<Button variant="outline" size="sm" onClick={load}>{tx("Refresh", "রিফ্রেশ")}</Button>}
      />
      <div className="p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4"><div className="text-xs text-muted-foreground">{tx("Total lands", "মোট জমি")}</div><div className="text-2xl font-bold">{stats.total}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">{tx("Missing mouza_id", "মৌজা আইডি নেই")}</div><div className="text-2xl font-bold text-destructive">{stats.missing}</div></Card>
          <Card className="p-4"><div className="text-xs text-muted-foreground">{tx("Orphan (broken link)", "অরফান (ভাঙা লিংক)")}</div><div className="text-2xl font-bold text-destructive">{stats.orphan}</div></Card>
        </div>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tx("Farmer", "কৃষক")}</TableHead>
                <TableHead>{tx("Dag", "দাগ")}</TableHead>
                <TableHead>{tx("Mouza (text)", "মৌজা (টেক্সট)")}</TableHead>
                <TableHead>{tx("Resolved name", "প্রকৃত নাম")}</TableHead>
                <TableHead>{tx("Issue", "সমস্যা")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}><TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell></TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("All lands have valid mouza links", "সব জমির মৌজা লিংক ঠিক আছে")}</TableCell></TableRow>
              ) : (
                rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.farmers?.name_bn || r.farmers?.name_en} <span className="text-xs text-muted-foreground">({r.farmers?.farmer_code})</span></TableCell>
                    <TableCell>{r.dag_no ?? "—"}</TableCell>
                    <TableCell>{r.mouza || "—"}</TableCell>
                    <TableCell>{resolveMouzaName(r) || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{!r.mouza_id ? tx("No mouza_id", "মৌজা আইডি নেই") : tx("Orphan link", "অরফান লিংক")}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
