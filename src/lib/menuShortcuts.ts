// Shortcut codes for header menu search.
// Format: M## stable codes — users type e.g. "M11" + Enter to jump to Farmers.
// Keep in sync with src/components/layout/AppSidebar.tsx menu items.

import type { TranslationKey } from "@/i18n/translations";

export type MenuShortcut = {
  code: string;          // e.g. "M11"
  url: string;
  labelKey: TranslationKey;
  parentKey?: TranslationKey; // group label for context
  permKey?: string;
  superOnly?: boolean;
  keywords?: string[];   // extra english/bangla aliases
};

export const MENU_SHORTCUTS: MenuShortcut[] = [
  { code: "M01", url: "/admin",                                   labelKey: "dashboard",        permKey: "dashboard", keywords: ["home","ড্যাশবোর্ড","হোম"] },

  // Members
  { code: "M11", url: "/farmers",                                 labelKey: "farmers",          parentKey: "members", permKey: "farmers", keywords: ["member","কৃষক","সদস্য"] },
  { code: "M12", url: "/farmers/import",                          labelKey: "bulkFarmerImport", parentKey: "members", permKey: "farmers" },
  { code: "M13", url: "/admin/bulk-cards",                        labelKey: "bulkCards",        parentKey: "members", permKey: "farmers" },
  { code: "M14", url: "/voters",                                  labelKey: "voterList",        parentKey: "members", permKey: "farmers" },
  { code: "M15", url: "/voters/history",                          labelKey: "voterHistory",     parentKey: "members", permKey: "farmers" },
  { code: "M16", url: "/reports/voter-audit",                     labelKey: "voterAudit",       parentKey: "members", permKey: "farmers" },

  // Operations
  { code: "M21", url: "/seasons",                                 labelKey: "seasons",          parentKey: "operations", permKey: "seasons" },
  { code: "M22", url: "/savings",                                 labelKey: "savings",          parentKey: "operations", permKey: "savings", keywords: ["সঞ্চয়"] },
  { code: "M23", url: "/share-collection",                        labelKey: "shareCollection",  parentKey: "operations", permKey: "savings" },
  { code: "M24", url: "/loans",                                   labelKey: "loans",            parentKey: "operations", permKey: "loans", keywords: ["ঋণ"] },
  { code: "M25", url: "/loans/plans",                             labelKey: "loanPlans",        parentKey: "operations", permKey: "loans" },
  { code: "M26", url: "/irrigation",                              labelKey: "irrigation",       parentKey: "operations", permKey: "irrigation", keywords: ["সেচ"] },
  { code: "M27", url: "/irrigation/rates",                        labelKey: "irrigationRatesLabel", parentKey: "operations", permKey: "irrigation" },
  { code: "M28", url: "/statement",                               labelKey: "statementLabel",   parentKey: "operations", permKey: "savings" },

  // Cash & Payments
  { code: "M31", url: "/payments",                                labelKey: "payments",         parentKey: "cashAndPayments", permKey: "payments", keywords: ["পেমেন্ট"] },
  { code: "M32", url: "/scan",                                    labelKey: "scanQr",           parentKey: "cashAndPayments", permKey: "payments", keywords: ["qr"] },
  { code: "M33", url: "/cashbook",                                labelKey: "cashbook",         parentKey: "cashAndPayments", permKey: "cashbook", keywords: ["ক্যাশবুক"] },
  { code: "M34", url: "/approvals",                               labelKey: "approvals",        parentKey: "cashAndPayments", permKey: "approvals" },

  // Accounting
  { code: "M41", url: "/finance-summary",                         labelKey: "financeSummary",   parentKey: "accounting", permKey: "accounting" },
  { code: "M42", url: "/accounts",                                labelKey: "chartOfAccounts",  parentKey: "accounting", permKey: "accounting", keywords: ["coa"] },
  { code: "M43", url: "/ledger",                                  labelKey: "generalLedger",    parentKey: "accounting", permKey: "accounting" },
  { code: "M44", url: "/journal-entry",                           labelKey: "journalEntry",     parentKey: "accounting", permKey: "accounting" },
  { code: "M45", url: "/financial-reports",                       labelKey: "financialReports", parentKey: "accounting", permKey: "accounting" },
  { code: "M46", url: "/period-close",                            labelKey: "periodClose",      parentKey: "accounting", permKey: "accounting" },
  { code: "M47", url: "/admin/reconciliation",                    labelKey: "monthlyReconciliation", parentKey: "accounting", permKey: "accounting" },
  { code: "M48", url: "/admin/share-capital-reconciliation",      labelKey: "shareCapitalReconciliation", parentKey: "accounting", permKey: "accounting" },
  { code: "M49", url: "/ledger-integrity",                        labelKey: "ledgerIntegrity",  parentKey: "accounting", permKey: "accounting" },

  // Reports
  { code: "M51", url: "/reports",                                 labelKey: "reports",          parentKey: "reports", permKey: "reports", keywords: ["রিপোর্ট"] },
  { code: "M52", url: "/reports/collections",                     labelKey: "collectionReport", parentKey: "reports", permKey: "reports" },
  { code: "M53", url: "/reports/farmer-statement",                labelKey: "farmerStatement",  parentKey: "reports", permKey: "reports" },
  { code: "M54", url: "/reports/expenses",                        labelKey: "expensesReport",   parentKey: "reports", permKey: "reports" },
  { code: "M55", url: "/reports/irrigation-due",                  labelKey: "irrigationDueReport", parentKey: "reports", permKey: "reports" },
  { code: "M56", url: "/dues",                                    labelKey: "dues",             parentKey: "reports", permKey: "reports", keywords: ["বকেয়া"] },
  { code: "M57", url: "/dues-audit",                              labelKey: "duesAudit",        parentKey: "reports", permKey: "reports" },
  { code: "M58", url: "/reports/farmer-rejections",               labelKey: "rejectedFarmerSubmissions", parentKey: "reports", permKey: "farmers" },

  // Administration
  { code: "M61", url: "/offices",                                 labelKey: "offices",          parentKey: "adminGroup", permKey: "offices", keywords: ["অফিস"] },
  { code: "M62", url: "/users",                                   labelKey: "users",            parentKey: "adminGroup", superOnly: true },
  { code: "M63", url: "/admin/role-matrix",                       labelKey: "roleMatrix",       parentKey: "adminGroup", superOnly: true },
  { code: "M64", url: "/locations",                               labelKey: "locations",        parentKey: "adminGroup", permKey: "locations" },
  { code: "M65", url: "/audit",                                   labelKey: "auditLogs",        parentKey: "adminGroup", permKey: "audit" },
  { code: "M66", url: "/admin/id-reconcile",                      labelKey: "idReconcile",      parentKey: "adminGroup", permKey: "farmers" },
  { code: "M67", url: "/admin/id-review",                         labelKey: "idReview",         parentKey: "adminGroup", permKey: "farmers" },
  { code: "M68", url: "/admin/duplicate-receipt-audit",           labelKey: "duplicateReceiptAudit", parentKey: "adminGroup", permKey: "audit", keywords: ["dup","ডুপ্লিকেট"] },

  // Tools & Imports
  { code: "M71", url: "/import",                                  labelKey: "universalImport",  parentKey: "toolsImports", permKey: "farmers" },
  { code: "M72", url: "/admin/bulk-loan-export",                  labelKey: "bulkExportLoans",  parentKey: "toolsImports", superOnly: true },
  { code: "M73", url: "/admin/card-designer",                     labelKey: "cardDesigner",     parentKey: "toolsImports", superOnly: true },
  { code: "M74", url: "/admin/qr-rotation",                       labelKey: "qrRotation",       parentKey: "toolsImports", superOnly: true },
  { code: "M75", url: "/backup",                                  labelKey: "backup",           parentKey: "toolsImports", superOnly: true, keywords: ["ব্যাকআপ"] },

  // Settings
  { code: "M81", url: "/settings",                                labelKey: "settings",         parentKey: "settings", superOnly: true, keywords: ["সেটিংস"] },
  { code: "M82", url: "/admin/receipt-template",                  labelKey: "receiptTemplate",  parentKey: "settings", superOnly: true },
  { code: "M83", url: "/admin/loan-receipt-settings",             labelKey: "loanReceiptSettings", parentKey: "settings", superOnly: true },
  { code: "M84", url: "/sms-settings",                            labelKey: "smsSettings",      parentKey: "settings", superOnly: true },
  { code: "M85", url: "/sms-logs",                                labelKey: "smsLogs",          parentKey: "settings", permKey: "sms" },

  // Profile
  { code: "M91", url: "/profile",                                 labelKey: "profile",          keywords: ["account","প্রোফাইল"] },
];
