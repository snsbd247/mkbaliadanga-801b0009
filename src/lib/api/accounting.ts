import { api, Paginated } from "./client";

export type Account = {
  id: string; code: string; name: string; name_bn?: string | null;
  type: "asset" | "liability" | "equity" | "income" | "expense";
  parent_id?: string | null; is_active?: boolean; office_id?: string | null;
};

export type JournalLine = {
  id?: string; account_id: string; debit: number; credit: number; memo?: string | null;
  account?: { id: string; code: string; name: string };
};

export type JournalEntry = {
  id: string; entry_date: string; reference?: string | null; memo?: string | null;
  source_type?: string | null; lines: JournalLine[];
};

export const AccountsApi = {
  list: () => api.get<Account[]>("/accounts").then(r => r.data),
  create: (p: Partial<Account>) => api.post<Account>("/accounts", p).then(r => r.data),
  update: (id: string, p: Partial<Account>) => api.put<Account>(`/accounts/${id}`, p).then(r => r.data),
};

export const JournalsApi = {
  list: (params: { from?: string; to?: string; per_page?: number; page?: number } = {}) =>
    api.get<Paginated<JournalEntry>>("/journals", { params }).then(r => r.data),
  create: (p: { entry_date: string; memo?: string; reference?: string; lines: JournalLine[] }) =>
    api.post<JournalEntry>("/journals", p).then(r => r.data),
};
