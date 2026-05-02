import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, FileDown, Receipt } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";
import { toast } from "sonner";
import { exportFarmerReportPDF } from "@/lib/exports";
import { QRCodeSVG } from "qrcode.react";
import { useNavigate } from "react-router-dom";

export default function FarmerDetail() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useLang();
  const nav = useNavigate();
  const [farmer, setFarmer] = useState<any>(null);
  const [lands, setLands] = useState<any[]>([]);
  const [savings, setSavings] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [irr, setIrr] = useState<any[]>([]);
  const [share, setShare] = useState<any>(null);
  const [openLand, setOpenLand] = useState(false);
  const [land, setLand] = useState({ mouza: "", dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land" });

  useEffect(() => { if (id) loadAll(); }, [id]);
  useEffect(() => { document.title = `${farmer?.name_en ?? ""} — ${t("farmers")}`; }, [farmer, t]);

  async function loadAll() {
    const [f, l, s, ln, ir, sh] = await Promise.all([
      supabase.from("farmers").select("*, offices(name)").eq("id", id!).maybeSingle(),
      supabase.from("lands").select("*").eq("farmer_id", id!).order("created_at"),
      supabase.from("savings_transactions").select("*").eq("farmer_id", id!).order("txn_date", { ascending: false }),
      supabase.from("loans").select("*, loan_payments(amount,paid_on)").eq("farmer_id", id!).order("issued_on", { ascending: false }),
      supabase.from("irrigation_charges").select("*, seasons(name,year,type), lands(dag_no)").eq("farmer_id", id!).order("entry_date", { ascending: false }),
      supabase.from("shares").select("balance").eq("farmer_id", id!).maybeSingle(),
    ]);
    setFarmer(f.data); setLands(l.data ?? []); setSavings(s.data ?? []);
    setLoans(ln.data ?? []); setIrr(ir.data ?? []); setShare(sh.data);
  }

  async function addLand() {
    const { error } = await supabase.from("lands").insert({ farmer_id: id!, mouza: land.mouza, dag_no: land.dag_no, land_size: land.land_size, owner_type: land.owner_type as any, field_type: land.field_type as any });
    if (error) return toast.error(error.message);
    toast.success(t("saved")); setOpenLand(false);
    setLand({ mouza: "", dag_no: "", land_size: 0, owner_type: "owner", field_type: "medium_land" });
    loadAll();
  }

  if (!farmer) return <div className="text-muted-foreground">Loading…</div>;

  const totalDeposits = savings.filter(s => s.status === "approved" && s.type === "deposit").reduce((a, s) => a + Number(s.amount), 0);
  const totalWithdraws = savings.filter(s => s.status === "approved" && s.type === "withdraw").reduce((a, s) => a + Number(s.amount), 0);
  const savingsBal = totalDeposits - totalWithdraws;
  const loanDue = loans.filter(l => l.status === "approved").reduce((a, l) => {
    const paid = (l.loan_payments ?? []).reduce((x: number, p: any) => x + Number(p.amount), 0);
    return a + (Number(l.total_payable) - paid);
  }, 0);
  const irrDue = irr.reduce((a, i) => a + Number(i.due_amount), 0);

  return (
    <>
      <PageHeader title={lang === "bn" ? (farmer.name_bn || farmer.name_en) : farmer.name_en}
        description={`${farmer.farmer_code} • ${farmer.offices?.name ?? ""}`}
        actions={<>
          <Button variant="outline" onClick={() => nav(`/payments?farmer=${farmer.id}`)}><Receipt className="h-4 w-4 mr-1" />{t("payNow")}</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{t("print")}</Button>
          <Button onClick={() => exportFarmerReportPDF(farmer, { lands, savings, loans, irr, savingsBal, loanDue, irrDue, share: share?.balance ?? 0 })}>
            <FileDown className="h-4 w-4 mr-1" />{t("exportPdf")}
          </Button>
        </>}
      />

      <Card className="p-5 mb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <Avatar className="h-24 w-24">
            {farmer.photo_url && <AvatarImage src={farmer.photo_url} />}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">{farmer.name_en[0]}</AvatarFallback>
          </Avatar>
          <div className="grid flex-1 grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div><div className="text-xs text-muted-foreground">{t("nameEn")}</div><div className="font-medium">{farmer.name_en}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("nameBn")}</div><div className="font-medium">{farmer.name_bn ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("fatherName")}</div><div>{farmer.father_name ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("motherName")}</div><div>{farmer.mother_name ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("nid")}</div><div className="font-mono">{farmer.nid ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("mobile")}</div><div>{farmer.mobile ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("village")}</div><div>{farmer.village ?? "-"}</div></div>
            <div><div className="text-xs text-muted-foreground">{t("upazila")}</div><div>{farmer.upazila ?? "-"}</div></div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4 mb-4">
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalSavings")}</div><div className="text-xl font-bold mt-1">{money(savingsBal)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("shareBalance")}</div><div className="text-xl font-bold mt-1">{money(share?.balance ?? 0)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("totalLoan")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (loanDue > 0 ? "due-text" : "")}>{money(loanDue)}</div></div>
        <div className="stat-card"><div className="text-xs text-muted-foreground">{t("irrigation")} {t("dueAmount")}</div><div className={"text-xl font-bold mt-1 " + (irrDue > 0 ? "due-text" : "")}>{money(irrDue)}</div></div>
      </div>

      <Tabs defaultValue="lands">
        <TabsList>
          <TabsTrigger value="lands">{t("lands")}</TabsTrigger>
          <TabsTrigger value="savings">{t("savings")}</TabsTrigger>
          <TabsTrigger value="loans">{t("loans")}</TabsTrigger>
          <TabsTrigger value="irrigation">{t("irrigation")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lands">
          <Card>
            <div className="flex justify-end p-3 border-b">
              <Dialog open={openLand} onOpenChange={setOpenLand}>
                <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("addNew")}</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>{t("addNew")} — {t("lands")}</DialogTitle></DialogHeader>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>{t("mouza")}</Label><Input value={land.mouza} onChange={e => setLand({ ...land, mouza: e.target.value })} /></div>
                    <div><Label>{t("dagNo")}</Label><Input value={land.dag_no} onChange={e => setLand({ ...land, dag_no: e.target.value })} /></div>
                    <div><Label>{t("landSize")}</Label><Input type="number" step="0.01" value={land.land_size} onChange={e => setLand({ ...land, land_size: +e.target.value })} /></div>
                    <div><Label>{t("ownerType")}</Label>
                      <Select value={land.owner_type} onValueChange={v => setLand({ ...land, owner_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="owner">{t("owner")}</SelectItem><SelectItem value="borgadar">{t("borgadar")}</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2"><Label>{t("fieldType")}</Label>
                      <Select value={land.field_type} onValueChange={v => setLand({ ...land, field_type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high_land">{t("highLand")}</SelectItem>
                          <SelectItem value="medium_land">{t("mediumLand")}</SelectItem>
                          <SelectItem value="low_land">{t("lowLand")}</SelectItem>
                          <SelectItem value="other">{t("other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter><Button variant="outline" onClick={() => setOpenLand(false)}>{t("cancel")}</Button><Button onClick={addLand}>{t("save")}</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>{t("mouza")}</TableHead><TableHead>{t("dagNo")}</TableHead><TableHead>{t("landSize")}</TableHead><TableHead>{t("ownerType")}</TableHead><TableHead>{t("fieldType")}</TableHead></TableRow></TableHeader>
              <TableBody>
                {lands.map(l => <TableRow key={l.id}><TableCell>{l.mouza}</TableCell><TableCell>{l.dag_no}</TableCell><TableCell>{l.land_size}</TableCell><TableCell>{t(l.owner_type as any)}</TableCell><TableCell>{t(l.field_type as any)}</TableCell></TableRow>)}
                {lands.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="savings">
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("type")}</TableHead><TableHead>{t("amount")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{savings.map(s => <TableRow key={s.id}><TableCell>{fmtDate(s.txn_date)}</TableCell><TableCell>{t(s.type as any)}</TableCell><TableCell>{money(s.amount)}</TableCell><TableCell><Badge>{t(s.status as any)}</Badge></TableCell></TableRow>)}
            {savings.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="loans">
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("issuedOn")}</TableHead><TableHead>{t("principal")}</TableHead><TableHead>{t("interestRate")}</TableHead><TableHead>{t("totalPayable")}</TableHead><TableHead>{t("nextDue")}</TableHead><TableHead>{t("status")}</TableHead></TableRow></TableHeader>
            <TableBody>{loans.map(l => {
              const paid = (l.loan_payments ?? []).reduce((a: number, p: any) => a + Number(p.amount), 0);
              const due = Number(l.total_payable) - paid;
              return <TableRow key={l.id}><TableCell>{fmtDate(l.issued_on)}</TableCell><TableCell>{money(l.principal)}</TableCell><TableCell>{l.interest_rate}%</TableCell><TableCell>{money(l.total_payable)}</TableCell><TableCell className={due > 0 ? "due-text" : ""}>{fmtDate(l.next_due_on)}</TableCell><TableCell><Badge>{t(l.status as any)}</Badge></TableCell></TableRow>;
            })}
            {loans.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}</TableBody>
          </Table></Card>
        </TabsContent>

        <TabsContent value="irrigation">
          <Card><Table>
            <TableHeader><TableRow><TableHead>{t("date")}</TableHead><TableHead>{t("season")}</TableHead><TableHead>{t("dagNo")}</TableHead><TableHead>{t("total")}</TableHead><TableHead>{t("paidAmount")}</TableHead><TableHead>{t("dueAmount")}</TableHead></TableRow></TableHeader>
            <TableBody>{irr.map(i => <TableRow key={i.id}><TableCell>{fmtDate(i.entry_date)}</TableCell><TableCell>{i.seasons?.name}</TableCell><TableCell>{i.lands?.dag_no}</TableCell><TableCell>{money(i.total)}</TableCell><TableCell>{money(i.paid_amount)}</TableCell><TableCell className={i.due_amount > 0 ? "due-text" : ""}>{money(i.due_amount)}</TableCell></TableRow>)}
            {irr.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">{t("noData")}</TableCell></TableRow>}</TableBody>
          </Table></Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
