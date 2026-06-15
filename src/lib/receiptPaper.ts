/**
 * Shared paper spec for the loan/savings collection receipt
 * ("শেয়ার, সঞ্চয়, ঋণ ও বিবিধ আদায় রশিদ").
 * Both the print logic and the integration tests reference these constants so
 * the A5 landscape layout (margins, QR, single-page) stays consistent.
 */
export const COLLECTION_RECEIPT_PAPER = {
  unit: "mm" as const,
  format: "a5" as const,
  orientation: "l" as const, // landscape
  margin: 14,
  qrSize: 16, // mm
} as const;
