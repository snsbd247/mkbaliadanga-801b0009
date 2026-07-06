import { describe, it, expect } from "vitest";
import { sanitizeEmbedSelect } from "./index";

describe("sanitizeEmbedSelect (Laravel/MySQL embed capability validation)", () => {
  it("passes through plain column lists and wildcards untouched", () => {
    expect(sanitizeEmbedSelect("*")).toBe("*");
    expect(sanitizeEmbedSelect("id,dag_no,land_size")).toBe("id,dag_no,land_size");
  });

  it("strips the unsupported mouzas(name) nested embed but keeps scalar columns", () => {
    expect(sanitizeEmbedSelect("dag_no,land_size,mouza,mouzas(name)")).toBe(
      "dag_no,land_size,mouza",
    );
  });

  it("strips mouzas embed inside a lands(...) embed (invoices/reports shape)", () => {
    const input =
      "*, farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn), lands(dag_no,land_size,mouza,mouzas(name)), seasons(name,year,type)";
    expect(sanitizeEmbedSelect(input)).toBe(
      "*,farmers!irrigation_invoices_farmer_id_fkey(name_en,name_bn),lands(dag_no,land_size,mouza),seasons(name,year,type)",
    );
  });

  it("strips patwaris embed inside lands(...) so Laravel/MySQL does not treat nested relation fields as columns", () => {
    const input = "id,lands(mouza,land_size,dag_no,field_type,notes,patwaris(name,name_bn,mobile)),seasons(name,year)";
    expect(sanitizeEmbedSelect(input)).toBe(
      "id,lands(mouza,land_size,dag_no,field_type,notes),seasons(name,year)",
    );
  });

  it("keeps scalar patwari_id while stripping the unsupported patwaris relation", () => {
    const input = "lands(mouza,land_size,patwari_id,patwaris(name,name_bn,mobile))";
    expect(sanitizeEmbedSelect(input)).toBe("lands(mouza,land_size,patwari_id)");
  });

  it("preserves supported nested embeds like irrigation_invoice_payments(payments(receipt_no))", () => {
    const input = "*, irrigation_invoice_payments(payments(receipt_no))";
    expect(sanitizeEmbedSelect(input)).toBe(
      "*,irrigation_invoice_payments(payments(receipt_no))",
    );
  });

  it("handles aliased/hinted embeds (owner:farmers!fk) without dropping them", () => {
    const input = "owner:farmers!irrigation_invoices_owner_farmer_id_fkey(name_bn), lands(mouza,mouzas(name))";
    expect(sanitizeEmbedSelect(input)).toBe(
      "owner:farmers!irrigation_invoices_owner_farmer_id_fkey(name_bn),lands(mouza)",
    );
  });
});
