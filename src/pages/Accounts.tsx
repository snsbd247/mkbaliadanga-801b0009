import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type Account = {
  id: string; code: string; name: string; name_bn: string | null;
  type: "asset" | "liability" | "income" | "expense" | "equity";
  is_active: boolean; is_system: boolean;
};

const TYPE_LABEL: Record<string, string> = {
  asset: "Assets", liability: "Liabilities", income: "Income", expense: "Expense", equity: "Equity",
};
const TYPE_ORDER = ["asset", "liability", "income", "expense", "equity"];

export default function Accounts() {
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("accounts").select("*").order("code");
      setRows((data as Account[]) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="container mx-auto p-4">
      <PageHeader title="Chart of Accounts" description="Hierarchical accounts used by the ledger" />
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid gap-4">
          {TYPE_ORDER.map((t) => {
            const list = rows.filter((r) => r.type === t);
            if (!list.length) return null;
            return (
              <Card key={t}>
                <CardHeader>
                  <CardTitle className="text-lg">{TYPE_LABEL[t]}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">Code</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>বাংলা</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono">{a.code}</TableCell>
                          <TableCell>{a.name}</TableCell>
                          <TableCell>{a.name_bn || "-"}</TableCell>
                          <TableCell>
                            {a.is_active ? <Badge variant="secondary">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
