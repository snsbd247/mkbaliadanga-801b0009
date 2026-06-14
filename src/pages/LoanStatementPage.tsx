import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { LoanStatement } from "@/components/LoanStatement";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { downloadLoanStatementPdf } from "@/lib/loanStatementPdf";
import { toast } from "sonner";

export default function LoanStatementPage() {
  const { tx, lang } = useLang();
  const navigate = useNavigate();
  const { id } = useParams();
  const [name, setName] = useState("");

  useEffect(() => {
    document.title = `${tx("Loan Statement", "ঋণ স্টেটমেন্ট")} — MK Baliadanga`;
    (async () => {
      const { data } = await supabase.from("loans").select("farmers(name_en,name_bn)").eq("id", id).maybeSingle();
      const f: any = data?.farmers;
      if (f) setName(lang === "bn" ? (f.name_bn || f.name_en) : f.name_en);
    })();
  }, [id, lang]);

  if (!id) return null;

  return (
    <>
      <div className="print:hidden">
        <PageHeader
          title={`${tx("Loan Statement", "ঋণ স্টেটমেন্ট")}${name ? ` — ${name}` : ""}`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate("/loans")}><ArrowLeft className="h-4 w-4 mr-1" />{tx("Back", "ফিরে")}</Button>
              <Button size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}</Button>
            </div>
          }
        />
      </div>
      <LoanStatement loanId={id} />
    </>
  );
}
