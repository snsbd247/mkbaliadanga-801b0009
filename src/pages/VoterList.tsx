import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, FileSpreadsheet, FileDown, FileText } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useLang } from "@/i18n/LanguageProvider";
import { useAuth } from "@/auth/AuthProvider";

type Row = {
  id: string;
  name_en: string;
  name_bn: string | null;
  account_number: string | null;
  voter_number: string | null;
  mobile: string | null;
  village: string | null;
  villages?: { name: string | null; name_bn: string | null } | null;
  unions?: { name: string | null } | null;
  upazilas?: { name: string | null } | null;
  districts?: { name: string | null } | null;
  offices?: { name: string | null } | null;
};

function locationOf(r: Row): string {
  const v = r.villages?.name_bn || r.villages?.name || r.village || "";
  const parts = [v, r.unions?.name, r.upazilas?.name, r.districts?.name].filter(Boolean);
  return parts.join(", ") || "—";
}

export default function VoterList() {
  const { t } = useLang();
  const { officeId, isSuper } = useAuth();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { document.title = `Voter List — ${t("appName")}`; }, [t]);

  useEffect(() => {
    const handle = setTimeout(load, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function load() {
    setLoading(true);
    let qy = supabase
      .from("farmers")
      .select("id,name_en,name_bn,account_number,voter_number,mobile,village,offices(name),villages(name,name_bn),unions(name),upazilas(name),districts(name)")
      .eq("is_voter", true)
      .not("voter_number", "is", null)
      .neq("voter_number", "")
      .order("voter_number", { ascending: true })
      .limit(500);
    if (!isSuper && officeId) qy = qy.eq("office_id", officeId);
    const term = q.trim();
    if (term) {
      qy = qy.or(`voter_number.ilike.%${term}%,name_en.ilike.%${term}%,name_bn.ilike.%${term}%,mobile.ilike.%${term}%,account_number.ilike.%${term}%`);
    }
    const { data } = await qy;
    setRows((data as any) ?? []);
    setLoading(false);
  }

  const total = rows.length;

  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const head = ["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Village", "Office"];
    const data = [head, ...rows.map(r => [
      r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
      r.mobile ?? "", r.village ?? "", r.offices?.name ?? "",
    ])];
    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 24 }, { wch: 14 }, { wch: 18 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, "Voters");
    XLSX.writeFile(wb, `voter-list-${Date.now()}.xlsx`);
  }

  function exportCsv() {
    const head = ["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Village", "Office"];
    const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [head.map(escape).join(",")];
    for (const r of rows) {
      lines.push([
        r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
        r.mobile ?? "", r.village ?? "", r.offices?.name ?? "",
      ].map(escape).join(","));
    }
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `voter-list-${Date.now()}.csv`;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Voter List", 40, 36);
    doc.setFontSize(10);
    doc.text(`${total} voter${total === 1 ? "" : "s"}`, 40, 52);
    autoTable(doc, {
      startY: 64,
      head: [["Voter #", "Account No", "Name (EN)", "Name (BN)", "Mobile", "Village", "Office"]],
      body: rows.map(r => [
        r.voter_number ?? "", r.account_number ?? "", r.name_en, r.name_bn ?? "",
        r.mobile ?? "", r.village ?? "", r.offices?.name ?? "",
      ]),
      styles: { fontSize: 9 },
      headStyles: { fillColor: [16, 122, 87] },
    });
    doc.save(`voter-list-${Date.now()}.pdf`);
  }

  const headerInfo = useMemo(() => `${total} voter${total === 1 ? "" : "s"}`, [total]);

  return (
    <>
      <PageHeader title="Voter List" description={headerInfo} actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={total === 0}>
            <FileDown className="h-4 w-4 mr-1" />Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportExcel} disabled={total === 0}>
            <FileSpreadsheet className="h-4 w-4 mr-1" />Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={total === 0}>
            <FileText className="h-4 w-4 mr-1" />Export PDF
          </Button>
        </div>
      } />

      <Card className="p-4 mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by voter #, name, mobile, account…" value={q}
            onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
      </Card>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Voter #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Account No</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Office</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id} className="cursor-pointer" onClick={() => nav(`/farmers/${r.id}`)}>
                <TableCell className="font-mono">{r.voter_number}</TableCell>
                <TableCell>
                  <div className="font-medium">{r.name_en}</div>
                  {r.name_bn && <div className="text-xs text-muted-foreground">{r.name_bn}</div>}
                </TableCell>
                <TableCell className="font-mono text-xs">{r.account_number ?? "—"}</TableCell>
                <TableCell>{r.mobile ?? "—"}</TableCell>
                <TableCell className="text-xs">{locationOf(r)}</TableCell>
                <TableCell className="text-xs">{r.offices?.name ?? "—"}</TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                  {loading ? "Loading…" : "No voters found"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
