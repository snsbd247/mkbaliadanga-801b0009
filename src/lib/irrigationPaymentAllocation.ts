/**
 * Pure FIFO allocator for irrigation payments.
 * Splits a `collected` amount across invoices ordered by due_date asc.
 * Returns per-invoice take amounts (>= 0). Never exceeds invoice due.
 */
export interface AllocInvoice {
  id: string;
  due_date: string | Date;
  due_amount: number;
}

export function allocateFifo(invoices: AllocInvoice[], collected: number): Record<string, number> {
  const out: Record<string, number> = {};
  let remaining = Math.max(0, Number(collected) || 0);
  const sorted = [...invoices].sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime(),
  );
  for (const inv of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, Number(inv.due_amount) || 0));
    if (take > 0) {
      out[inv.id] = +take.toFixed(2);
      remaining = +(remaining - take).toFixed(2);
    }
  }
  return out;
}

/**
 * Split a current-collected amount into income-head portions
 * (irrigation / delay / maintenance / canal), proportionally if the
 * collected amount is less than the total payable.
 */
export interface SplitInput {
  collected: number;
  irrigation: number;
  delay: number;
  maintenance: number;
  canal: number;
}
export interface SplitOutput {
  irrigation: number;
  delay: number;
  maintenance: number;
  canal: number;
}
export function splitCurrentByHeads(i: SplitInput): SplitOutput {
  const overhead = i.delay + i.maintenance + i.canal;
  const cur = Math.max(0, Number(i.collected) || 0);
  if (overhead <= 0) return { irrigation: cur, delay: 0, maintenance: 0, canal: 0 };
  const scale = Math.min(1, cur / overhead);
  const delayPart = +(i.delay * scale).toFixed(2);
  const maintPart = +(i.maintenance * scale).toFixed(2);
  const canalPart = +(i.canal * scale).toFixed(2);
  const irrPart = +(cur - delayPart - maintPart - canalPart).toFixed(2);
  return { irrigation: Math.max(0, irrPart), delay: delayPart, maintenance: maintPart, canal: canalPart };
}
