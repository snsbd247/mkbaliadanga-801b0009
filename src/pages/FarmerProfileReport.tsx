import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/lib/branding";
import { useLang } from "@/i18n/LanguageProvider";

function safeText(value: unknown) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function safeNumber(value: unknown, fallback = "0") {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? String(n) : fallback;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return String(value);
  return dt.toLocaleDateString("en-GB");
}

export default function FarmerProfileReport() {
  const { tx } = useLang();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const nav = useNavigate();
  const brand = useBranding();
  const [loading, setLoading] = useState(true);
  const [farmer, setFarmer] = useState<any>(null);
  const [savings, setSavings] = useState<any[]>([]);
  const [share, setShare] = useState<any>(null);
  const [loans, setLoans] = useState<any[]>([]);
  const [ownerRows, setOwnerRows] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    let ignore = false;

    async function load() {
      setLoading(true);
      const [f, s, sh, ln, ir, rel, inst] = await Promise.all([
        db.from("farmers").select("*").eq("id", id).maybeSingle(),
        db.from("savings_transactions").select("*").eq("farmer_id", id).is("deleted_at", null).order("txn_date", { ascending: true }),
        db.from("shares").select("balance").eq("farmer_id", id).maybeSingle(),
        db.from("loans").select("*, loan_payments(amount)").eq("farmer_id", id).is("deleted_at", null).order("issued_on", { ascending: false }),
        supabase
          .from("irrigation_invoices")
          .select("id, payable_amount, paid_amount, due_amount, irrigation_amount, canal_amount, maintenance_amount, other_charge, season_id, land_id, is_borga, calculation_snapshot, seasons(name,year,type), lands(id, mouza, dag_no, land_size, owner_type, field_type, land_type_id, patwari_id, patwaris(name,name_bn))")
          .eq("farmer_id", id)
          .is("deleted_at", null)
          .order("generated_at", { ascending: false }),
        supabase
          .from("land_relations")
          .select("land_id, valid_to, sc:farmers!land_relations_sharecropper_farmer_id_fkey(name_en, farmer_code)")
          .eq("owner_farmer_id", id)
          .is("deleted_at", null),
        supabase
          .from("loan_installments")
          .select("id, loan_id, installment_no, due_date, amount, paid_amount, status, paid_on, loans!inner(farmer_id)")
          .eq("loans.farmer_id", id)
          .order("due_date", { ascending: true }),
      ]);


      if (ignore) return;

      const activeRelationByLand = new Map<string, any>();
      (rel.data ?? []).forEach((row: any) => {
        if (!row.land_id) return;
        if (!row.valid_to && !activeRelationByLand.has(row.land_id)) {
          activeRelationByLand.set(row.land_id, row);
        }
      });

      // Catalogue land-type names take priority over the legacy enum so that
      // custom types (পুকুর, সবজি ইত্যাদি) show their real name instead of "Other".
      const { data: ltData } = await supabase
        .from("land_types" as any)
        .select("id,code,name,name_bn")
        .is("deleted_at", null);
      const ltRows = (ltData as any[]) ?? [];

      const fieldTypeLabel = (v: string, landTypeId?: string | null) => {
        const hit = landTypeId ? ltRows.find((r: any) => r.id === landTypeId) : undefined;
        if (hit) return hit.name_bn || hit.name || hit.code;
        switch (v) {
          case "high_land": return tx("High Land", "উঁচু জমি(High Land)");
          case "medium_land": return tx("Medium Land", "মাঝারি জমি(Medium Land)");
          case "low_land": return tx("Low Land", "নিচু জমি(Low Land)");
          case "other": return tx("Other", "বিবিধ");
          default: return safeText(v);
        }
      };

      const ownerInformation = (ir.data ?? []).map((row: any) => {
        const relation = activeRelationByLand.get(row.land_id);
        const sc = relation?.sc;
        const isBorga = !!row.is_borga || row.lands?.owner_type === "borgadar";
        const ownerTypeText = isBorga ? tx("Sharecropper", "বর্গাদার") : tx("Owner", "মালিক");
        const ownerNameFid = isBorga && sc?.name_en
          ? `${safeText(sc.name_en)} - ${safeText(sc.farmer_code)}`
          : "";

        const pw = row.lands?.patwaris;
        // Phase 4: prefer the billed (split) area over the full parcel size
        const snap = row.calculation_snapshot as any;
        const billedArea = Number(snap?.billed_area_shotok ?? snap?.land_size_shotok ?? row.lands?.land_size ?? 0);
        return {
          id: row.id,
          mouza: safeText(row.lands?.mouza),
          season: row.seasons?.name ? `${safeText(row.seasons.name)}, ${safeText(row.seasons.year)}` : "",
          dag_no: safeText(row.lands?.dag_no),
          owner_type: ownerTypeText,
          owner_name_fid: ownerNameFid,
          patwari: pw ? safeText(pw.name_bn || pw.name) : "",
          land_size: billedArea ? billedArea.toFixed(6) : "",
          field_type: fieldTypeLabel(row.lands?.field_type, row.lands?.land_type_id),
          charge_rate: String(Math.round(Number(row.irrigation_amount || 0))),
          canal_charge: String(Math.round(Number(row.canal_amount || 0))),
          maintenance_charge: String(Math.round(Number(row.maintenance_amount || 0))),
          other_charge: String(Math.round(Number(row.other_charge || 0))),
          charge: String(Math.round(Number(row.payable_amount || 0))),
          paid: String(Math.round(Number(row.paid_amount || 0))),
          due: String(Math.round(Number(row.due_amount || 0))),
          land_size_num: billedArea,
          canal_num: Number(row.canal_amount || 0),
          maintenance_num: Number(row.maintenance_amount || 0),
          other_num: Number(row.other_charge || 0),
          charge_num: Number(row.payable_amount || 0),
          paid_num: Number(row.paid_amount || 0),
          due_num: Number(row.due_amount || 0),
          irrigation_year: Number(row.seasons?.year) || new Date().getFullYear(),
        };
      });


      setFarmer(f.data ?? null);
      setSavings(s.data ?? []);
      setShare(sh.data ?? null);
      setLoans(ln.data ?? []);
      setOwnerRows(ownerInformation);
      setInstallments(inst.data ?? []);
      setLoading(false);
    }

    load();
    return () => {
      ignore = true;
    };
  }, [id]);

  const savingsSummary = (() => {
    const approved = savings.filter((row) => row.status === "approved");
    const deposits = approved
      .filter((row) => row.type === "deposit")
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      accountNo: safeText(farmer?.member_no || farmer?.farmer_code),
      activeStatus: farmer?.status === "active" ? "Active" : safeText(farmer?.status),
      totalAmount: deposits > 0 ? deposits.toFixed(0) : "0",
      shareAmount: Number(share?.balance ?? 0).toFixed(0),
    };
  })();

  const loanRows = loans.map((loan) => {
    const paid = (loan.loan_payments ?? []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
    return {
      id: loan.id,
      loan_account: safeText(loan.loan_no || loan.id).slice(0, 12).toUpperCase(),
      loan_amount: safeNumber(loan.principal),
      interest_rate: loan.interest_rate !== null && loan.interest_rate !== undefined ? `${loan.interest_rate}` : "0",
      total_loan_amount: safeNumber(loan.total_payable),
      issue_date: formatDate(loan.issued_on),
      next_due_date: formatDate(loan.next_due_on),
      due_amount: safeNumber(Number(loan.total_payable || 0) - paid),
      paid_amount: paid,
    };
  });

  // Savings transactions with running balance
  const savingsRows = (() => {
    let bal = 0;
    return savings
      .filter((r) => r.status === "approved")
      .map((r) => {
        const amt = Number(r.amount || 0);
        if (r.type === "deposit") bal += amt;
        else if (r.type === "withdraw" || r.type === "withdrawal") bal -= amt;
        return {
          id: r.id,
          date: formatDate(r.txn_date),
          type: r.type,
          receipt_no: safeText(r.receipt_no || r.field_receipt_no),
          deposit: r.type === "deposit" ? amt : 0,
          withdraw: (r.type === "withdraw" || r.type === "withdrawal") ? amt : 0,
          balance: bal,
          note: safeText(r.note),
        };
      });
  })();
  const savingsBalance = savingsRows.length ? savingsRows[savingsRows.length - 1].balance : 0;

  // Installments per loan
  const installmentsByLoan = (() => {
    const m = new Map<string, any[]>();
    installments.forEach((it) => {
      if (!m.has(it.loan_id)) m.set(it.loan_id, []);
      m.get(it.loan_id)!.push(it);
    });
    return m;
  })();

  // Irrigation overall totals
  const irrigationTotals = ownerRows.reduce(
    (a, r) => ({
      total: a.total + r.charge_num,
      paid: a.paid + r.paid_num,
      due: a.due + r.due_num,
    }),
    { total: 0, paid: 0, due: 0 },
  );


  const ownerByYear = (() => {
    const map = new Map<number, any[]>();
    ownerRows.forEach((r) => {
      const y = r.irrigation_year || new Date().getFullYear();
      if (!map.has(y)) map.set(y, []);
      map.get(y)!.push(r);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  })();

  useEffect(() => {
    if (!farmer) return;
    document.title = `${safeText(farmer.farmer_code)} report`;
  }, [farmer]);

  useEffect(() => {
    if (!loading && searchParams.get("print") === "1") {
      const timer = window.setTimeout(() => window.print(), 250);
      return () => window.clearTimeout(timer);
    }
  }, [loading, searchParams]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">{tx("Loading report...", "রিপোর্ট লোড হচ্ছে...")}</div>;
  }

  if (!farmer) {
    return <div className="p-6 text-sm text-muted-foreground">{tx("Farmer not found.", "কৃষক পাওয়া যায়নি।")}</div>;
  }

  const irrigationYear = ownerRows.find((row) => row.irrigation_year)?.irrigation_year || new Date().getFullYear();
  const logoSrc = brand.logo_url || "";

  return (
    <>
      <style>{`
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }

        .farmer-report-page {
          background: white;
          color: #1f1f1f;
          min-height: 100vh;
          font-family: "Times New Roman", Times, serif;
        }

        .farmer-report-toolbar {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          padding: 12px 16px 0;
        }

        .farmer-report-sheet {
          width: 100%;
          max-width: 1060px;
          margin: 0 auto;
          padding: 20px 24px 40px;
        }

        .farmer-report-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 6px;
        }

        .farmer-report-logo {
          max-height: 52px;
          width: auto;
          object-fit: contain;
          margin-bottom: 2px;
        }

        .farmer-report-org {
          font-size: 14px;
          line-height: 1.1;
          font-weight: 700;
          text-align: center;
        }

        .farmer-report-subtitle {
          font-size: 13px;
          line-height: 1.05;
          font-weight: 700;
          text-align: center;
          margin-top: 2px;
          margin-bottom: 4px;
        }

        .farmer-report-rule {
          border: 1px solid #9e9e9e;
          height: 30px;
          margin-bottom: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .farmer-section-title {
          font-size: 11px;
          font-weight: 400;
          line-height: 1.1;
          margin: 0 0 3px 0;
        }

        .farmer-year-row {
          font-size: 10px;
          text-align: center;
          border: 1px solid #9e9e9e;
          border-bottom: 0;
          padding: 2px 0;
          margin-top: -1px;
        }

        .farmer-table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          margin-bottom: 22px;
        }

        .farmer-table th,
        .farmer-table td {
          border: 1px solid #9e9e9e;
          padding: 2px 4px;
          font-size: 10px;
          line-height: 1.05;
          vertical-align: middle;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .farmer-table th {
          background: #aeb9c9;
          color: #1a1a1a;
          text-align: center;
          font-weight: 700;
        }

        .farmer-table tr.totals-row td {
          background: #aeb9c9;
          font-weight: 700;
        }

        .irrigation-year-block { margin-bottom: 6px; }
        .irrigation-year-block .farmer-table { margin-bottom: 8px; }

        .farmer-table td {
          text-align: center;
        }

        .farmer-table td.text-left,
        .farmer-table th.text-left {
          text-align: left;
        }

        .farmer-table.compact-gap {
          margin-bottom: 18px;
        }

        .field-type-cell {
          white-space: nowrap;
        }

        @media screen {
          .farmer-report-page {
            background: hsl(var(--muted));
          }

          .farmer-report-sheet {
            background: white;
            box-shadow: 0 10px 30px rgba(0,0,0,0.08);
            min-height: calc(100vh - 24px);
          }
        }

        @media print {
          body {
            background: white !important;
          }

          .farmer-report-toolbar {
            display: none !important;
          }

          .farmer-report-sheet {
            box-shadow: none !important;
            max-width: none;
            padding: 0;
          }

          .farmer-table,
          .farmer-table thead,
          .farmer-table tbody,
          .farmer-table tr,
          .farmer-table td,
          .farmer-table th {
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="farmer-report-page">
        <div className="farmer-report-toolbar print:hidden">
          <Button variant="outline" size="sm" onClick={() => nav(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />Back
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1 h-4 w-4" />Print
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Download className="mr-1 h-4 w-4" />PDF
          </Button>
        </div>

        <div className="farmer-report-sheet">
          <div className="farmer-report-header">
            {logoSrc ? (
              <img src={logoSrc} alt={brand.company_name} className="farmer-report-logo" />
            ) : null}
            <div className="farmer-report-org">{brand.company_name_bn || brand.company_name}</div>
          </div>

          <div className="farmer-report-rule">{tx("Farmer Information at a Glance", "এক নজরে কৃষকের তথ্য")}</div>

          <div className="farmer-section-title">Farmer Information</div>
          <table className="farmer-table compact-gap">
            <colgroup>
              <col style={{ width: "4%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "19.5%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "4%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "5.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>FID</th>
                <th>Name(EN)</th>
                <th>Name(BN)</th>
                <th>Father Name</th>
                <th>Mother Name</th>
                <th>NID</th>
                <th>Mobile No</th>
                <th>Village</th>
                <th>Post</th>
                <th>Upazila</th>
                <th>Address</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{safeText(farmer.farmer_code)}</td>
                <td>{safeText(farmer.name_en)}</td>
                <td>{safeText(farmer.name_bn)}</td>
                <td>{safeText(farmer.father_name)}</td>
                <td>{safeText(farmer.mother_name)}</td>
                <td>{safeText(farmer.nid)}</td>
                <td>{safeText(farmer.mobile)}</td>
                <td>{safeText(farmer.village)}</td>
                <td>{safeText(farmer.post_office || farmer.upazila)}</td>
                <td>{safeText(farmer.upazila)}</td>
                <td>{safeText(farmer.address || farmer.village)}</td>
              </tr>
            </tbody>
          </table>

          <div className="farmer-section-title">Savings Deposit Information</div>
          <table className="farmer-table compact-gap">
            <colgroup>
              <col style={{ width: "22%" }} />
              <col style={{ width: "24%" }} />
              <col style={{ width: "26%" }} />
              <col style={{ width: "28%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Account No</th>
                <th>Active Status</th>
                <th>Total Amount</th>
                <th>Share Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{savingsSummary.accountNo}</td>
                <td>{savingsSummary.activeStatus}</td>
                <td>{savingsSummary.totalAmount}</td>
                <td>{savingsSummary.shareAmount}</td>
              </tr>
            </tbody>
          </table>

          {savingsRows.length > 0 && (
            <>
              <div className="farmer-section-title">Savings Transactions</div>
              <table className="farmer-table compact-gap">
                <colgroup>
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "18%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Receipt No</th>
                    <th>Deposit</th>
                    <th>Withdraw</th>
                    <th>Balance</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {savingsRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{r.type}</td>
                      <td>{r.receipt_no}</td>
                      <td>{r.deposit || ""}</td>
                      <td>{r.withdraw || ""}</td>
                      <td>{Math.round(r.balance)}</td>
                      <td>{r.note}</td>
                    </tr>
                  ))}
                  <tr className="totals-row">
                    <td colSpan={5} style={{ textAlign: "right" }}>{tx("Current Balance", "বর্তমান ব্যালেন্স")}</td>
                    <td>{Math.round(savingsBalance)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </>
          )}

          <div className="farmer-section-title">Irrigation Charge Information</div>
          {(ownerByYear.length ? ownerByYear : [[irrigationYear, []]]).map(([year, rows]) => {
            const totals = rows.reduce(
              (acc: any, r: any) => {
                acc.land_size += r.land_size_num;
                acc.canal += r.canal_num;
                acc.maintenance += r.maintenance_num;
                acc.other += r.other_num;
                acc.charge += r.charge_num;
                acc.paid += r.paid_num;
                acc.due += r.due_num;
                return acc;
              },
              { land_size: 0, canal: 0, maintenance: 0, other: 0, charge: 0, paid: 0, due: 0 }
            );
            return (
              <div key={year} className="irrigation-year-block">
                <div className="farmer-year-row">{tx("Irrigation Year:", "সেচ বর্ষ:")} {year}</div>
                <table className="farmer-table compact-gap">
                  <thead>
                    <tr>
                      <th>Mouza</th>
                      <th>Season</th>
                      <th>Dag No</th>
                      <th>Patwari</th>
                      <th>Owner Type</th>
                      <th>Owner Name - FID</th>
                      <th>Land Size</th>
                      <th>Field Type</th>
                      <th>Charge Rate</th>
                      <th>Canal</th>
                      <th>Maint.</th>
                      <th>Other</th>
                      <th>Charge</th>
                      <th>Paid</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rows.length ? rows : [{ id: `empty-${year}` }]).map((row: any) => (
                      <tr key={row.id}>
                        <td>{row.mouza}</td>
                        <td>{row.season}</td>
                        <td>{row.dag_no}</td>
                        <td>{row.patwari}</td>
                        <td>{row.owner_type}</td>
                        <td>{row.owner_name_fid}</td>
                        <td>{row.land_size}</td>
                        <td className="field-type-cell">{row.field_type}</td>
                        <td>{row.charge_rate}</td>
                        <td>{row.canal_charge}</td>
                        <td>{row.maintenance_charge}</td>
                        <td>{row.other_charge}</td>
                        <td>{row.charge}</td>
                        <td>{row.paid}</td>
                        <td>{row.due}</td>
                      </tr>
                    ))}
                    {rows.length > 0 && (
                      <tr className="totals-row">
                        <td colSpan={6} style={{ textAlign: "right" }}>{tx("Total", "মোট")}</td>
                        <td>{totals.land_size.toFixed(4).replace(/\.?0+$/, "")}</td>
                        <td colSpan={2}></td>
                        <td>{totals.canal || 0}</td>
                        <td>{totals.maintenance || 0}</td>
                        <td>{totals.other || 0}</td>
                        <td>{Math.round(totals.charge)}</td>
                        <td>{Math.round(totals.paid)}</td>
                        <td>{Math.round(totals.due)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          {ownerRows.length > 0 && (
            <table className="farmer-table compact-gap">
              <thead>
                <tr>
                  <th colSpan={3}>{tx("Irrigation Summary (All Years)", "সেচ সারাংশ (সর্বমোট)")}</th>
                </tr>
                <tr>
                  <th>Total Charge</th>
                  <th>Total Paid</th>
                  <th>Total Due</th>
                </tr>
              </thead>
              <tbody>
                <tr className="totals-row">
                  <td>{Math.round(irrigationTotals.total)}</td>
                  <td>{Math.round(irrigationTotals.paid)}</td>
                  <td>{Math.round(irrigationTotals.due)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <div className="farmer-section-title">Loan Information</div>
          <table className="farmer-table">
            <thead>
              <tr>
                <th>Loan Account</th>
                <th>Loan Amount</th>
                <th>Interest %</th>
                <th>Total Payable</th>
                <th>Issue Date</th>
                <th>Next Due</th>
                <th>Paid</th>
                <th>Due</th>
              </tr>
            </thead>
            <tbody>
              {(loanRows.length ? loanRows : [{
                id: "empty-loan-row",
                loan_account: "",
                loan_amount: "",
                interest_rate: "",
                total_loan_amount: "",
                issue_date: "",
                next_due_date: "",
                paid_amount: "",
                due_amount: "",
              }]).map((row: any) => (
                <tr key={row.id}>
                  <td>{row.loan_account}</td>
                  <td>{row.loan_amount}</td>
                  <td>{row.interest_rate}</td>
                  <td>{row.total_loan_amount}</td>
                  <td>{row.issue_date}</td>
                  <td>{row.next_due_date}</td>
                  <td>{row.paid_amount !== "" ? Math.round(Number(row.paid_amount)) : ""}</td>
                  <td>{row.due_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {loanRows.map((loan: any) => {
            const items = installmentsByLoan.get(loan.id) || [];
            if (!items.length) return null;
            return (
              <div key={`inst-${loan.id}`} className="irrigation-year-block">
                <div className="farmer-year-row">{tx("Installments for Loan", "লোনের কিস্তি")}: {loan.loan_account}</div>
                <table className="farmer-table compact-gap">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Due Date</th>
                      <th>Amount</th>
                      <th>Paid</th>
                      <th>Remaining</th>
                      <th>Status</th>
                      <th>Paid On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it: any) => {
                      const amt = Number(it.amount || 0);
                      const paid = Number(it.paid_amount || 0);
                      return (
                        <tr key={it.id}>
                          <td>{it.installment_no}</td>
                          <td>{formatDate(it.due_date)}</td>
                          <td>{Math.round(amt)}</td>
                          <td>{Math.round(paid)}</td>
                          <td>{Math.round(amt - paid)}</td>
                          <td>{safeText(it.status)}</td>
                          <td>{formatDate(it.paid_on)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
