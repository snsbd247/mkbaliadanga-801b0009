import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/lib/branding";

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

  useEffect(() => {
    if (!id) return;
    let ignore = false;

    async function load() {
      setLoading(true);
      const [f, s, sh, ln, ir, rel] = await Promise.all([
        supabase.from("farmers").select("*").eq("id", id).maybeSingle(),
        supabase.from("savings_transactions").select("*").eq("farmer_id", id),
        supabase.from("shares").select("balance").eq("farmer_id", id).maybeSingle(),
        supabase.from("loans").select("*, loan_payments(amount)").eq("farmer_id", id).order("issued_on", { ascending: false }),
        supabase
          .from("irrigation_charges")
          .select("id, total, due_amount, season_id, land_id, seasons(name,year,type), lands(id, mouza, dag_no, land_size, owner_type, field_type)")
          .eq("farmer_id", id)
          .order("entry_date", { ascending: false }),
        supabase
          .from("land_relations")
          .select("land_id, valid_to, sc:farmers!land_relations_sharecropper_farmer_id_fkey(name_en, farmer_code)")
          .eq("owner_farmer_id", id),
      ]);

      if (ignore) return;

      const activeRelationByLand = new Map<string, any>();
      (rel.data ?? []).forEach((row: any) => {
        if (!row.land_id) return;
        if (!row.valid_to && !activeRelationByLand.has(row.land_id)) {
          activeRelationByLand.set(row.land_id, row);
        }
      });

      const fieldTypeLabel = (v: string) => {
        switch (v) {
          case "high_land": return "উঁচু জমি(High Land)";
          case "medium_land": return "মাঝারি জমি(Medium Land)";
          case "low_land": return "নিচু জমি(Low Land)";
          case "other": return "বিবিধ";
          default: return safeText(v);
        }
      };

      const ownerInformation = (ir.data ?? []).map((row: any) => {
        const relation = activeRelationByLand.get(row.land_id);
        const sc = relation?.sc;
        const isBorga = row.lands?.owner_type === "borgadar";
        const ownerTypeText = isBorga ? "বর্গাদার" : "মালিক";
        const ownerNameFid = isBorga && sc?.name_en
          ? `${safeText(sc.name_en)} - ${safeText(sc.farmer_code)}`
          : "";

        return {
          id: row.id,
          mouza: safeText(row.lands?.mouza),
          season: row.seasons?.name ? `${safeText(row.seasons.name)}, ${safeText(row.seasons.year)}` : "",
          dag_no: safeText(row.lands?.dag_no),
          owner_type: ownerTypeText,
          owner_name_fid: ownerNameFid,
          land_size: row.lands?.land_size !== null && row.lands?.land_size !== undefined ? Number(row.lands.land_size).toFixed(6) : "",
          field_type: fieldTypeLabel(row.lands?.field_type),
          charge_rate: Number(row.base_charge || 0).toFixed(2),
          canal_charge: Number(row.canal_charge || 0).toFixed(2),
          maintenance_charge: Number(row.maintenance_charge || 0).toFixed(2),
          other_charge: Number(row.other_charge || 0).toFixed(2),
          charge: Number(row.total || 0).toFixed(2),
          due: Number(row.due_amount || 0).toFixed(2),
          land_size_num: Number(row.lands?.land_size || 0),
          canal_num: Number(row.canal_charge || 0),
          maintenance_num: Number(row.maintenance_charge || 0),
          other_num: Number(row.other_charge || 0),
          charge_num: Number(row.total || 0),
          due_num: Number(row.due_amount || 0),
          irrigation_year: Number(row.seasons?.year) || new Date().getFullYear(),
        };
      });

      setFarmer(f.data ?? null);
      setSavings(s.data ?? []);
      setShare(sh.data ?? null);
      setLoans(ln.data ?? []);
      setOwnerRows(ownerInformation);
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
    return loans.map((loan) => {
      const paid = (loan.loan_payments ?? []).reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
      return {
        id: loan.id,
        loan_account: safeText(loan.id).slice(0, 8).toUpperCase(),
        loan_amount: safeNumber(loan.principal),
        interest_rate: loan.interest_rate !== null && loan.interest_rate !== undefined ? `${loan.interest_rate}` : "0",
        total_loan_amount: safeNumber(loan.total_payable),
        issue_date: formatDate(loan.issued_on),
        next_due_date: formatDate(loan.next_due_on),
        due_amount: safeNumber(Number(loan.total_payable || 0) - paid),
      };
    });
  });

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
    return <div className="p-6 text-sm text-muted-foreground">Loading report...</div>;
  }

  if (!farmer) {
    return <div className="p-6 text-sm text-muted-foreground">Farmer not found.</div>;
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

          <div className="farmer-report-rule">এক নজরে কৃষকের তথ্য</div>

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

          <div className="farmer-section-title">Irrigation Charge Information</div>
          {(ownerByYear.length ? ownerByYear : [[irrigationYear, []]]).map(([year, rows]) => {
            const totals = rows.reduce(
              (acc: any, r: any) => {
                acc.land_size += r.land_size_num;
                acc.canal += r.canal_num;
                acc.maintenance += r.maintenance_num;
                acc.other += r.other_num;
                acc.charge += r.charge_num;
                acc.due += r.due_num;
                return acc;
              },
              { land_size: 0, canal: 0, maintenance: 0, other: 0, charge: 0, due: 0 }
            );
            return (
              <div key={year} className="irrigation-year-block">
                <div className="farmer-year-row">সেচ বর্ষ: {year}</div>
                <table className="farmer-table compact-gap">
                  <colgroup>
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6.5%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "7%" }} />
                    <col style={{ width: "6%" }} />
                    <col style={{ width: "8%" }} />
                    <col style={{ width: "6.5%" }} />
                    <col style={{ width: "6.5%" }} />
                    <col style={{ width: "6.5%" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Mouza</th>
                      <th>Season</th>
                      <th>Dag No</th>
                      <th>Owner Type</th>
                      <th>Owner Name - FID</th>
                      <th>Land Size</th>
                      <th>Field Type</th>
                      <th>Charge Rate</th>
                      <th>Canal Charge</th>
                      <th>Maintenance Charge</th>
                      <th>Other Charges</th>
                      <th>Charge</th>
                      <th>Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(rows.length ? rows : [{ id: `empty-${year}` }]).map((row: any) => (
                      <tr key={row.id}>
                        <td>{row.mouza}</td>
                        <td>{row.season}</td>
                        <td>{row.dag_no}</td>
                        <td>{row.owner_type}</td>
                        <td>{row.owner_name_fid}</td>
                        <td>{row.land_size}</td>
                        <td className="field-type-cell">{row.field_type}</td>
                        <td>{row.charge_rate}</td>
                        <td>{row.canal_charge}</td>
                        <td>{row.maintenance_charge}</td>
                        <td>{row.other_charge}</td>
                        <td>{row.charge}</td>
                        <td>{row.due}</td>
                      </tr>
                    ))}
                    {rows.length > 0 && (
                      <tr className="totals-row">
                        <td></td><td></td><td></td><td></td><td></td>
                        <td>{totals.land_size.toFixed(4).replace(/\.?0+$/, "")}</td>
                        <td></td><td></td>
                        <td>{totals.canal || 0}</td>
                        <td>{totals.maintenance || 0}</td>
                        <td>{totals.other || 0}</td>
                        <td>{Math.round(totals.charge)}</td>
                        <td>{Math.round(totals.due)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            );
          })}

          <div className="farmer-section-title">Loan Information</div>
          <table className="farmer-table">
            <colgroup>
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "14.5%" }} />
              <col style={{ width: "17%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "11.5%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Loan Account</th>
                <th>Loan Amount</th>
                <th>Interest Rate</th>
                <th>Total Loan Amt</th>
                <th>Issue Date</th>
                <th>Next Due Date</th>
                <th>Due Amt</th>
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
                due_amount: "",
              }]).map((row) => (
                <tr key={row.id}>
                  <td>{row.loan_account}</td>
                  <td>{row.loan_amount}</td>
                  <td>{row.interest_rate}</td>
                  <td>{row.total_loan_amount}</td>
                  <td>{row.issue_date}</td>
                  <td>{row.next_due_date}</td>
                  <td>{row.due_amount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
