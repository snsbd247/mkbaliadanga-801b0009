import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLang } from "@/i18n/LanguageProvider";
import { fmtDate } from "@/lib/format";

export default function AuditLogs() {
  const { t } = useLang();
  const [list, setList] = useState<any[]>([]);
  useEffect(() => { document.title = `${t("auditLogs")} — ${t("appName")}`; supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(200).then(r => setList(r.data ?? [])); }, []);
  return (
    <>
      <PageHeader title={t("auditLogs")} />
      <Card><Table>
        <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>User</TableHead></TableRow></TableHeader>
        <TableBody>
          {list.map(l => <TableRow key={l.id}><TableCell>{fmtDate(l.created_at)}</TableCell><TableCell>{l.action}</TableCell><TableCell>{l.entity}</TableCell><TableCell className="font-mono text-xs">{l.user_id}</TableCell></TableRow>)}
          {list.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">{t("noData")}</TableCell></TableRow>}
        </TableBody>
      </Table></Card>
    </>
  );
}
