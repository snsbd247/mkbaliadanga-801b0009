import { api } from "./client";

export type DateRange = { from?: string; to?: string };

export const ReportsApi = {
  trialBalance: (p: DateRange) => api.get("/reports/trial-balance", { params: p }).then(r => r.data),
  profitAndLoss: (p: DateRange) => api.get("/reports/profit-loss", { params: p }).then(r => r.data),
  balanceSheet: (p: { as_of?: string }) => api.get("/reports/balance-sheet", { params: p }).then(r => r.data),
  cashbook: (p: DateRange) => api.get("/reports/cashbook", { params: p }).then(r => r.data),
};
