
ALTER TABLE public.sms_settings
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'bn',
  ADD COLUMN IF NOT EXISTS reminder_days_before integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS tpl_savings_deposit_en text NOT NULL DEFAULT 'Deposit of {amount} BDT received. Balance: {balance} BDT.',
  ADD COLUMN IF NOT EXISTS tpl_savings_withdraw_en text NOT NULL DEFAULT 'Withdrawal of {amount} BDT done. Balance: {balance} BDT.',
  ADD COLUMN IF NOT EXISTS tpl_loan_approved_en text NOT NULL DEFAULT 'Your loan of {amount} BDT is approved. Total payable: {payable} BDT.',
  ADD COLUMN IF NOT EXISTS tpl_loan_payment_en text NOT NULL DEFAULT 'Loan payment {amount} BDT received. Due: {due} BDT.',
  ADD COLUMN IF NOT EXISTS tpl_irrigation_payment_en text NOT NULL DEFAULT 'Irrigation payment {amount} BDT received. Thank you.',
  ADD COLUMN IF NOT EXISTS tpl_due_reminder_en text NOT NULL DEFAULT 'Reminder: {type} due of {due} BDT on {date}. Please pay soon.';

-- Prevent duplicate reminders for same loan/irrigation event
CREATE UNIQUE INDEX IF NOT EXISTS sms_logs_due_reminder_unique
  ON public.sms_logs (event_type, reference_type, reference_id)
  WHERE event_type IN ('due_reminder_loan','due_reminder_irrigation');
