// Shared cash reconciliation helpers so Cash Book, Hand Cash and the Dashboard
// always agree on how "net" and "month-end" balances are computed.

import { computeHandCash, type HandCashInput, type HandCashResult } from "./handCash";

const n = (v: unknown) => Number(v ?? 0) || 0;

export type SavingsReceipt = { kind?: string | null; amount?: number | null };
export type StreamExpense = { amount?: number | null; stream?: string | null };

export interface SavingsHandCashInput {
  /** All receipts for the period (any stream); non-irrigation ones count as savings income. */
  receipts: SavingsReceipt[];
  /** Expenses for the period (any stream); non-irrigation ones count as savings expense. */
  expenses: StreamExpense[];
  /** Opening balance carried into the period (defaults to 0). */
  opening?: number;
}

export interface SavingsHandCashResult {
  income: number;
  expense: number;
  opening: number;
  closing: number;
  /** Net movement in the period (income - expense), independent of opening. */
  net: number;
}

const isIrrigationKind = (k: unknown) => String(k ?? "").toLowerCase() === "irrigation";
const isIrrigationStream = (s: unknown) => String(s ?? "irrigation") === "irrigation";

/**
 * Savings-stream hand cash: non-irrigation receipts − non-irrigation expenses.
 * closing = opening + income - expense
 */
export function computeSavingsHandCash(input: SavingsHandCashInput): SavingsHandCashResult {
  const { receipts, expenses, opening = 0 } = input;
  const income = receipts.filter((r) => !isIrrigationKind(r.kind)).reduce((s, r) => s + n(r.amount), 0);
  const expense = expenses.filter((e) => !isIrrigationStream(e.stream)).reduce((s, e) => s + n(e.amount), 0);
  const open = n(opening);
  return { income, expense, opening: open, net: income - expense, closing: open + income - expense };
}

/** Irrigation-stream hand cash (re-exported wrapper for symmetry). */
export function computeIrrigationHandCash(input: HandCashInput): HandCashResult {
  return computeHandCash(input);
}

export interface ReconcileEntry {
  /** Human-readable name of the balance being compared. */
  label: string;
  /** Value shown on the Dashboard card. */
  dashboard: number;
  /** Value derived from the source ledger (Cash Book / Hand Cash). */
  source: number;
}

export interface ReconcileMismatch extends ReconcileEntry {
  diff: number;
}

export interface ReconcileResult {
  ok: boolean;
  mismatches: ReconcileMismatch[];
}

/**
 * Compare Dashboard card values against their source ledger values.
 * Differences within `tolerance` (default 0.5 to absorb rounding) are treated
 * as matching.
 */
export function reconcileBalances(entries: ReconcileEntry[], tolerance = 0.5): ReconcileResult {
  const mismatches = entries
    .map((e) => ({ ...e, diff: Math.round((n(e.dashboard) - n(e.source)) * 100) / 100 }))
    .filter((e) => Math.abs(e.diff) > tolerance);
  return { ok: mismatches.length === 0, mismatches };
}
