-- Linked bank <-> cashbook sync: pair the auto-posted rows so edits/deletes stay consistent.
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS link_id uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS link_id uuid;
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS link_id uuid;

CREATE INDEX IF NOT EXISTS idx_bank_transactions_link_id ON public.bank_transactions (link_id);
CREATE INDEX IF NOT EXISTS idx_expenses_link_id ON public.expenses (link_id);
CREATE INDEX IF NOT EXISTS idx_receipts_link_id ON public.receipts (link_id);