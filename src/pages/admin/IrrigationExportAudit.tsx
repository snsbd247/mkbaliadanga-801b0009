import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/auth/AuthProvider";
import { useLang } from "@/i18n/LanguageProvider";
import { RefreshCw } from "lucide-react";

const sb = supabase as any;

type AuditRow = {
  id: string;
  user_id: string;
  office_id: string | null;
  date_from: string;
  date_to: string;
  format: string;
  created_at: string;
};

const FORMAT_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  XLSX: "default",
  CSV: "secondary",
  PDF: "outline",
};

export default function IrrigationExportAudit() {
  const { isAdmin, officeId: myOffice } = useAuth();
  const { tx } = useLang();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [offices, setOffices] = useState<{ id: string; name: string }[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [officeFilter, setOfficeFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    document.title = tx("Cash Book Export Audit", "ক্যাশ বহি এক্সপোর্ট অডিট");
    sb.from("offices").select("id,name").order("name").then(({ data }: any) => setOffices(data ?? []));
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      let q = sb.from("irrigation_cashbook_export_audit")
        .select("id,user_id,office_id,date_from,date_to,format,created_at")
        .order("created_at", { ascending: false })
        .limit(1000);
      // Office-scoped admins are locked to their office (defence-in-depth on top of RLS).
      const scope = myOffice || (isAdmin ? (officeFilter === "all" ? null : officeFilter) : null);
      if (scope) q = q.eq("office_id", scope);
      if (formatFilter !== "all") q = q.eq("format", formatFilter);
      if (from) q = q.gte("created_at", from);
      if (to) q = q.lte("created_at", `${to}T23:59:59`);
      const { data } = await q;
      const list: AuditRow[] = data ?? [];
      setRows(list);
      const ids = Array.from(new Set(list.map((r) => r.user_id)));
      if (ids.length) {
        const { data: profs } = await sb.from("profiles").select("id,full_name,email").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p: any) => { map[p.id] = p.full_name || p.email || p.id; });
        setUserNames(map);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [officeFilter, formatFilter, from, to, myOffice]);

  const officeName = (id: string | null) => (id ? offices.find((o) => o.id === id)?.name ?? id : tx("All offices", "সব অফিস"));

  const filtered = useMemo(() => {
    const t = userFilter.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter((r) => (userNames[r.user_id] || r.user_id).toLowerCase().includes(t));
  }, [rows, userFilter, userNames]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={tx("Cash Book Export Audit", "সেচ ক্যাশ বহি এক্সপোর্ট অডিট")}
        description={tx("Track who exported the irrigation cash book, when, for which office and period", "কে, কখন, কোন অফিস ও সময়ের জন্য সেচ ক্যাশ বহি এক্সপোর্ট করেছে তা দেখুন")}
      />

      <Card className="p-3 flex flex-wrap items-end gap-3">
        <div><Label>{tx("From", "শুরু")}</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>{tx("To", "শেষ")}</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div>
          <Label>{tx("User", "ব্যবহারকারী")}</Label>
          <Input value={userFilter} onChange={(e) => setUserFilter(e.target.value)} placeholder={tx("Search name/email", "নাম/ইমেইল খুঁজুন")} />
        </div>
        {!myOffice && isAdmin && (
          <div>
            <Label>{tx("Office", "অফিস")}</Label>
            <Select value={officeFilter} onValueChange={setOfficeFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tx("All offices", "সব অফিস")}</SelectItem>
                {offices.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label>{tx("Format", "ফরম্যাট")}</Label>
          <Select value={formatFilter} onValueChange={setFormatFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tx("All formats", "সব ফরম্যাট")}</SelectItem>
              <SelectItem value="XLSX">XLSX</SelectItem>
              <SelectItem value="CSV">CSV</SelectItem>
              <SelectItem value="PDF">PDF</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-1" /> {tx("Refresh", "রিফ্রেশ")}
        </Button>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tx("Date/Time", "তারিখ/সময়")}</TableHead>
              <TableHead>{tx("User", "ব্যবহারকারী")}</TableHead>
              <TableHead>{tx("Office", "অফিস")}</TableHead>
              <TableHead>{tx("Period", "সময়কাল")}</TableHead>
              <TableHead>{tx("Format", "ফরম্যাট")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</TableCell>
                <TableCell>{userNames[r.user_id] || r.user_id}</TableCell>
                <TableCell>{officeName(r.office_id)}</TableCell>
                <TableCell className="whitespace-nowrap">{r.date_from} → {r.date_to}</TableCell>
                <TableCell><Badge variant={FORMAT_VARIANT[r.format] ?? "outline"}>{r.format}</Badge></TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">{tx("No export records found", "কোনো এক্সপোর্ট রেকর্ড নেই")}</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
