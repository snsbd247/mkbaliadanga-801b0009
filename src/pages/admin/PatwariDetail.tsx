import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export default function PatwariDetail() {
  const { id } = useParams<{ id: string }>();
  const [patwari, setPatwari] = useState<any>(null);
  const [lands, setLands] = useState<any[]>([]);
  const [farmers, setFarmers] = useState<any[]>([]);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) load(); }, [id]);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase
      .from("patwaris")
      .select("*, mouzas(id,name,name_bn), offices(name)")
      .eq("id", id!)
      .maybeSingle();
    setPatwari(p);
    document.title = `পাটুয়ারী — ${p?.name_bn || p?.name || ""}`;

    if (p?.mouza_id) {
      // All lands in this mouza (default-assigned)
      const { data: ls } = await supabase
        .from("lands")
        .select("id,dag_no,land_size,farmer_id,farmers(name_en,name_bn,farmer_code,mobile)")
        .eq("mouza_id", p.mouza_id)
        .is("deleted_at", null);
      setLands(ls ?? []);

      // Unique farmers from those lands
      const farmerMap = new Map<string, any>();
      (ls ?? []).forEach((l: any) => {
        if (l.farmers && l.farmer_id) farmerMap.set(l.farmer_id, { id: l.farmer_id, ...l.farmers });
      });
      setFarmers(Array.from(farmerMap.values()));
    } else {
      setLands([]); setFarmers([]);
    }

    // Per-irrigation overrides where this patwari was specifically assigned
    const { data: ovs } = await supabase
      .from("irrigation_charges")
      .select("id,entry_date,land_id,farmer_id,total,paid_amount,lands(dag_no),farmers(name_en,name_bn)")
      .eq("patwari_id", id!)
      .is("deleted_at", null)
      .order("entry_date", { ascending: false })
      .limit(100);
    setOverrides(ovs ?? []);

    setLoading(false);
  }

  if (loading) return <div className="p-6 text-muted-foreground">লোড হচ্ছে…</div>;
  if (!patwari) return <div className="p-6 text-muted-foreground">পাটুয়ারী পাওয়া যায়নি।</div>;

  return (
    <>
      <PageHeader
        title={`পাটুয়ারী: ${patwari.name_bn || patwari.name}`}
        actions={
          <Link to="/admin/patwaris">
            <Button variant="outline" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />তালিকায় ফিরুন</Button>
          </Link>
        }
      />

      <Card className="p-4 mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div><div className="text-muted-foreground text-xs">নাম</div><div className="font-medium">{patwari.name_bn || patwari.name}</div></div>
          <div><div className="text-muted-foreground text-xs">মোবাইল</div><div className="font-medium">{patwari.mobile ?? "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">দায়িত্বরত মৌজা</div><div className="font-medium">{patwari.mouzas?.name_bn || patwari.mouzas?.name || "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">অফিস</div><div className="font-medium">{patwari.offices?.name ?? "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">NID</div><div className="font-medium">{patwari.nid ?? "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">ঠিকানা</div><div className="font-medium">{patwari.address ?? "—"}</div></div>
          <div><div className="text-muted-foreground text-xs">স্ট্যাটাস</div>
            {patwari.is_active ? <Badge>সক্রিয়</Badge> : <Badge variant="secondary">নিষ্ক্রিয়</Badge>}
          </div>
        </div>
        {patwari.note && <p className="text-xs text-muted-foreground mt-3">নোট: {patwari.note}</p>}
      </Card>

      <Tabs defaultValue="farmers">
        <TabsList>
          <TabsTrigger value="farmers">কৃষক ({farmers.length})</TabsTrigger>
          <TabsTrigger value="lands">জমি ({lands.length})</TabsTrigger>
          <TabsTrigger value="overrides">বিশেষ এন্ট্রি ({overrides.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="farmers">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>কোড</TableHead><TableHead>নাম</TableHead><TableHead>মোবাইল</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {farmers.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>{f.farmer_code}</TableCell>
                    <TableCell>{f.name_bn || f.name_en}</TableCell>
                    <TableCell>{f.mobile ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {farmers.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">এই মৌজায় কৃষক নেই</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="lands">
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>দাগ নং</TableHead><TableHead>আকার (শতক)</TableHead><TableHead>কৃষক</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {lands.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{l.dag_no ?? "—"}</TableCell>
                    <TableCell>{l.land_size}</TableCell>
                    <TableCell>{l.farmers?.name_bn || l.farmers?.name_en || "—"}</TableCell>
                  </TableRow>
                ))}
                {lands.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">এই মৌজায় জমি নেই</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="overrides">
          <p className="text-xs text-muted-foreground mb-2">যেসব সেচ এন্ট্রিতে এই পাটুয়ারীকে সরাসরি অ্যাসাইন করা হয়েছে।</p>
          <Card>
            <Table>
              <TableHeader><TableRow>
                <TableHead>তারিখ</TableHead><TableHead>কৃষক</TableHead><TableHead>দাগ</TableHead>
                <TableHead>মোট</TableHead><TableHead>পরিশোধ</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {overrides.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.entry_date}</TableCell>
                    <TableCell>{r.farmers?.name_bn || r.farmers?.name_en}</TableCell>
                    <TableCell>{r.lands?.dag_no ?? "—"}</TableCell>
                    <TableCell>{r.total}</TableCell>
                    <TableCell>{r.paid_amount}</TableCell>
                  </TableRow>
                ))}
                {overrides.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">কোন বিশেষ এন্ট্রি নেই</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
