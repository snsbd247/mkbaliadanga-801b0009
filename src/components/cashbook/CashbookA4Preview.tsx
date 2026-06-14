import { useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { useLang } from "@/i18n/LanguageProvider";
import { money, fmtDate } from "@/lib/format";

export type CashbookA4Row = {
  date: string;
  ref: string;
  head: string;
  desc: string;
  income: number;
  expense: number;
  balance: number;
};

type Props = {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  companyName?: string;
  address?: string;
  title: string;
  range?: { from?: string | null; to?: string | null };
  opening: number;
  rows: CashbookA4Row[];
  totalIncome: number;
  totalExpense: number;
  closing: number;
};

// Number of body rows per printed A4 page (tuned for portrait + header/footer).
const ROWS_PER_PAGE = 22;

export function CashbookA4Preview(props: Props) {
  const { open, onOpenChange, companyName, address, title, range, opening, rows, totalIncome, totalExpense, closing } = props;
  const { tx } = useLang();

  const pages = useMemo(() => {
    const chunks: CashbookA4Row[][] = [];
    for (let i = 0; i < rows.length; i += ROWS_PER_PAGE) chunks.push(rows.slice(i, i + ROWS_PER_PAGE));
    return chunks.length ? chunks : [[]];
  }, [rows]);

  function handlePrint() {
    window.print();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[860px] max-h-[90vh] overflow-auto cb-preview-dialog">
        <DialogHeader className="no-print">
          <DialogTitle>{tx("Print preview (A4)", "প্রিন্ট প্রিভিউ (A4)")}</DialogTitle>
        </DialogHeader>

        <div className="cb-print-area bg-muted/30 p-4 space-y-4 print:p-0 print:bg-transparent print:space-y-0">
          {pages.map((page, pi) => (
            <div key={pi} className="cb-a4-page bg-white text-black mx-auto shadow-md print:shadow-none">
              <div className="text-center mb-2">
                <div className="text-base font-bold">{companyName || tx("Cash Book", "ক্যাশ বুক")}</div>
                {address && <div className="text-[10px]">{address}</div>}
                <div className="text-sm font-semibold mt-1">{title}</div>
                {(range?.from || range?.to) && (
                  <div className="text-[10px]">
                    {tx("Period", "সময়কাল")}: {range?.from || "—"} {tx("to", "থেকে")} {range?.to || "—"}
                  </div>
                )}
              </div>
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-y border-black">
                    <th className="border-r border-black px-1 py-0.5 text-left w-[60px]">{tx("Date", "তারিখ")}</th>
                    <th className="border-r border-black px-1 py-0.5 text-left w-[70px]">{tx("Voucher/Receipt", "ভাউচার/রশিদ নং")}</th>
                    <th className="border-r border-black px-1 py-0.5 text-left">{tx("Description", "বিবরণ")}</th>
                    <th className="border-r border-black px-1 py-0.5 text-right w-[70px]">{tx("Income", "জমা/আয়")}</th>
                    <th className="border-r border-black px-1 py-0.5 text-right w-[70px]">{tx("Expense", "খরচ/ব্যয়")}</th>
                    <th className="px-1 py-0.5 text-right w-[70px]">{tx("Balance", "জের")}</th>
                  </tr>
                </thead>
                <tbody>
                  {pi === 0 && (
                    <tr className="border-b border-black/30">
                      <td className="border-r border-black/30 px-1 py-0.5" colSpan={2}></td>
                      <td className="border-r border-black/30 px-1 py-0.5 font-medium">{tx("Opening balance", "প্রারম্ভিক জের")}</td>
                      <td className="border-r border-black/30 px-1 py-0.5 text-right"></td>
                      <td className="border-r border-black/30 px-1 py-0.5 text-right"></td>
                      <td className="px-1 py-0.5 text-right">{money(opening)}</td>
                    </tr>
                  )}
                  {page.map((r, ri) => (
                    <tr key={ri} className="border-b border-black/20">
                      <td className="border-r border-black/30 px-1 py-0.5">{fmtDate(r.date)}</td>
                      <td className="border-r border-black/30 px-1 py-0.5">{r.ref}</td>
                      <td className="border-r border-black/30 px-1 py-0.5">{r.head}{r.desc ? ` — ${r.desc}` : ""}</td>
                      <td className="border-r border-black/30 px-1 py-0.5 text-right">{r.income ? money(r.income) : ""}</td>
                      <td className="border-r border-black/30 px-1 py-0.5 text-right">{r.expense ? money(r.expense) : ""}</td>
                      <td className="px-1 py-0.5 text-right">{money(r.balance)}</td>
                    </tr>
                  ))}
                  {pi === pages.length - 1 && (
                    <tr className="border-y border-black font-semibold">
                      <td className="border-r border-black px-1 py-0.5" colSpan={2}></td>
                      <td className="border-r border-black px-1 py-0.5">{tx("Total", "মোট")}</td>
                      <td className="border-r border-black px-1 py-0.5 text-right">{money(totalIncome)}</td>
                      <td className="border-r border-black px-1 py-0.5 text-right">{money(totalExpense)}</td>
                      <td className="px-1 py-0.5 text-right">{money(closing)}</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {pi === pages.length - 1 && (
                <div className="flex justify-between mt-10 text-[10px]">
                  {[
                    tx("Prepared by", "প্রস্তুতকারী"),
                    tx("Manager", "ম্যানেজার"),
                    tx("President", "সভাপতি"),
                    tx("Auditor", "নিরীক্ষক"),
                  ].map((s) => (
                    <div key={s} className="text-center">
                      <div className="border-t border-black w-24 mx-auto pt-0.5">{s}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-center text-[8px] mt-2 text-black/60">
                {tx("Page", "পৃষ্ঠা")} {pi + 1} / {pages.length}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="no-print">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{tx("Close", "বন্ধ")}</Button>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-1" />{tx("Print", "প্রিন্ট")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
