/**
 * ধাপ ৪ — Invoice generation query-parameter validation.
 *
 * Validates the office / date-range / farmer filters used by the Step 4
 * invoice-generation API and UI, returning bilingual (English + Bangla)
 * error messages so both server responses and inline forms can reuse them.
 */
export interface Step4Query {
  office_id?: string | null;
  season_id?: string | null;
  farmer_id?: string | null;
  from?: string | null;
  to?: string | null;
}

export interface BilingualError {
  field: string;
  en: string;
  bn: string;
}

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Returns a list of bilingual errors; empty array means the query is valid. */
export function validateStep4Query(q: Step4Query): BilingualError[] {
  const errors: BilingualError[] = [];

  if (!q.office_id || !String(q.office_id).trim()) {
    errors.push({
      field: "office_id",
      en: "Office is required.",
      bn: "অফিস নির্বাচন আবশ্যক।",
    });
  }

  if (q.from && !isDate(String(q.from))) {
    errors.push({
      field: "from",
      en: "Start date must be a valid date (YYYY-MM-DD).",
      bn: "শুরুর তারিখ সঠিক হতে হবে (YYYY-MM-DD)।",
    });
  }

  if (q.to && !isDate(String(q.to))) {
    errors.push({
      field: "to",
      en: "End date must be a valid date (YYYY-MM-DD).",
      bn: "শেষের তারিখ সঠিক হতে হবে (YYYY-MM-DD)।",
    });
  }

  if (
    q.from &&
    q.to &&
    isDate(String(q.from)) &&
    isDate(String(q.to)) &&
    String(q.from) > String(q.to)
  ) {
    errors.push({
      field: "to",
      en: "End date must be on or after the start date.",
      bn: "শেষের তারিখ শুরুর তারিখের সমান বা পরে হতে হবে।",
    });
  }

  return errors;
}

export const isStep4QueryValid = (q: Step4Query): boolean =>
  validateStep4Query(q).length === 0;
