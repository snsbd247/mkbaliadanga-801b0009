// CSV template generator for the universal importer.
// Returns a CSV string with a comment header (instructions) + columns + 1 sample row.

type Tpl = { columns: string[]; sample: Record<string, any>; instructions?: string };

const TEMPLATES: Record<string, Tpl> = {
  lands: {
    columns: ["account_number", "dag_no", "land_size", "land_size_unit", "owner_type", "field_type", "mouza"],
    sample: { account_number: "10001", dag_no: "123, 124/A, 125-B", land_size: 33, land_size_unit: "shotok", owner_type: "owner", field_type: "medium_land", mouza: "Mouza A" },
    instructions: "জমির তথ্য (Lands)। account_number = কৃষকের সদস্য নম্বর। land_size শতক (shotok) হিসেবে সংরক্ষিত হয়। land_size_unit = shotok|katha|bigha|acre (ডিফল্ট shotok); katha/bigha/acre স্বয়ংক্রিয় রূপান্তর হয় (১ বিঘা=৩৩ শতক=২০ কাঠা, ১ একর≈১০০ শতক)। dag_no একাধিক দাগ কমা দিয়ে — canonical ফরম্যাট যেমন \"123, 124/A, 125-B\" (শুধু সংখ্যা/অক্ষর/'/'/'-' গ্রহণযোগ্য)। owner_type = owner|borgadar। field_type = high_land|medium_land|low_land।",
  },
  land_relations: {
    columns: ["owner_account_number", "tenant_account_number", "dag_no", "share_percentage", "valid_from", "valid_to", "note"],
    sample: { owner_account_number: "10001", tenant_account_number: "10002", dag_no: "123, 124/A", share_percentage: 50, valid_from: "2026-01-01", valid_to: "", note: "" },
    instructions: "বর্গা সম্পর্ক (Borga relations)। dag_no মালিকের জমির রেকর্ডের সাথে হুবহু মিলতে হবে (canonical কমা-সেপারেটেড, যেমন \"123, 124/A\")। share_percentage ০-১০০। valid_to ঐচ্ছিক।",
  },
  payments: {
    columns: ["account_number", "kind", "amount", "method", "note"],
    sample: { account_number: "10001", kind: "savings", amount: 500, method: "cash", note: "Monthly" },
    instructions: "পেমেন্ট (Payments)। kind = savings | loan | irrigation। method = cash | bkash | bank। amount টাকায়।",
  },
  irrigation: {
    columns: ["account_number","dag_no","season_year","season_type","quantity","base_charge","canal_charge","maintenance_charge","other_charge","previous_due_brought","penalty_amount","entry_date","note"],
    sample: { account_number: "10001", dag_no: "123, 124/A", season_year: 2026, season_type: "boro", quantity: 0.33, base_charge: 200, canal_charge: 50, maintenance_charge: 20, other_charge: 0, previous_due_brought: 0, penalty_amount: 0, entry_date: "2026-02-01", note: "" },
    instructions: "সেচ ইনভয়েস (Irrigation)। season_type = boro | aman | aus। dag_no অবশ্যই ঐ কৃষকের জন্য আগে থেকে থাকতে হবে (canonical কমা-সেপারেটেড, যেমন \"123, 124/A\")। সব চার্জ টাকায়। entry_date = YYYY-MM-DD।",
  },
  cashbook_receipts: {
    columns: ["receipt_date", "kind", "account_number", "amount", "method", "note"],
    sample: { receipt_date: "2026-02-01", kind: "donation", account_number: "", amount: 1000, method: "cash", note: "" },
    instructions: "ক্যাশবুক আয়/রসিদ (Cashbook receipts)। kind = irrigation|bigha_rent|pond|crop_sale|scrap|loan_taken|donation|savings_deposit|share|other। account_number ঐচ্ছিক। receipt_date = YYYY-MM-DD।",
  },
  cashbook_expenses: {
    columns: ["expense_date", "head", "payee", "amount", "method", "note"],
    sample: { expense_date: "2026-02-01", head: "Office", payee: "Stationery", amount: 500, method: "cash", note: "" },
    instructions: "ক্যাশবুক খরচ (Cashbook expenses)। head = খরচের খাত, payee = প্রাপক। method = cash | bkash | bank। expense_date = YYYY-MM-DD।",
  },
  shares: {
    columns: ["account_number", "balance"],
    sample: { account_number: "10001", balance: 500 },
    instructions: "শেয়ার মূলধন (Shares)। প্রতি কৃষকের শেয়ার ব্যালেন্স সেট করে (এক কৃষকে এক সারি)। বিদ্যমান ব্যালেন্স ওভাররাইট হবে।",
  },
  loans: {
    columns: ["account_number", "principal", "interest_rate", "total_payable", "issued_on", "note"],
    sample: { account_number: "10001", principal: 10000, interest_rate: 12, total_payable: 11200, issued_on: "2026-01-15", note: "Crop loan" },
    instructions: "ঋণ (Loans)। প্রতি সারিতে একটি অনুমোদিত ঋণ তৈরি হয়। interest_rate শতাংশে (০-১০০)। total_payable ঐচ্ছিক (ডিফল্ট = principal)। issued_on = YYYY-MM-DD।",
  },
  loan_payments: {
    columns: ["account_number", "amount", "paid_on", "note"],
    sample: { account_number: "10001", amount: 1000, paid_on: "2026-02-15", note: "1st installment" },
    instructions: "ঋণ পরিশোধ (Loan payments)। কৃষকের সর্বশেষ active/approved ঋণে প্রযোজ্য হয়। আগে Loan মডিউল থেকে ঋণ তৈরি করুন। paid_on = YYYY-MM-DD।",
  },
  loan_installments: {
    columns: ["account_number", "installment_no", "due_date", "amount", "status"],
    sample: { account_number: "10001", installment_no: 1, due_date: "2026-02-15", amount: 1000, status: "due" },
    instructions: "ঋণ কিস্তি (Loan installments)। status = due | paid | missed | partial। installment_no ১ থেকে শুরু। due_date = YYYY-MM-DD।",
  },
  savings: {
    columns: ["account_number", "type", "amount", "txn_date", "note"],
    sample: { account_number: "10001", type: "deposit", amount: 500, txn_date: "2026-02-01", note: "Monthly deposit" },
    instructions: "সঞ্চয় (Savings)। type = deposit | withdrawal। সব সারি approved হিসেবে যোগ হয়। txn_date = YYYY-MM-DD।",
  },
  ledger: {
    columns: ["entry_date", "account_code", "debit", "credit", "description", "reference_type"],
    sample: { entry_date: "2026-02-01", account_code: "1010", debit: 500, credit: 0, description: "Cash adjustment", reference_type: "manual" },
    instructions: "লেজার এন্ট্রি (Ledger) — শুধু Super-admin। account_code চার্ট অফ অ্যাকাউন্টসে থাকতে হবে। debit অথবা credit দিন (দুটোই ০ নয়)। entry_date = YYYY-MM-DD।",
  },
  patwaris: {
    columns: ["name", "name_bn", "mobile", "nid", "address", "mouza", "note"],
    sample: { name: "Md. Rahim", name_bn: "মোঃ রহিম", mobile: "01700000000", nid: "1234567890", address: "Village A", mouza: "Mouza A", note: "" },
    instructions: "পাটোয়ারী (Patwaris) বাল্ক-যোগ। mouza নাম দিয়ে বিদ্যমান মৌজার সাথে ম্যাচ হয় (ঐচ্ছিক)। পাটোয়ারী active হিসেবে তৈরি হয়।",
  },
};

function csvEscape(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCsvTemplate(module: keyof typeof TEMPLATES): string {
  const tpl = TEMPLATES[module];
  const header = tpl.columns.join(",");
  const sample = tpl.columns.map((c) => csvEscape((tpl.sample as any)[c])).join(",");
  const lines: string[] = [];
  if (tpl.instructions) lines.push(`# ${tpl.instructions}`);
  lines.push(header, sample);
  return lines.join("\n");
}

export function downloadCsvTemplate(module: keyof typeof TEMPLATES) {
  const csv = buildCsvTemplate(module);
  // Prepend UTF-8 BOM so Excel opens Bangla/Unicode CSV correctly
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${module}_template.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const CSV_TEMPLATE_MODULES = Object.keys(TEMPLATES) as (keyof typeof TEMPLATES)[];
