import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' }

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

    const token = authHeader.replace('Bearer ', '')
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const anon = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: userData, error: userErr } = await anon.auth.getUser(token)
    const userId = userData?.user?.id
    if (userErr || !userId) return json({ error: 'Unauthorized' }, 401)

    const svc = createClient(url, serviceKey)
    const { data: roleRows, error: roleErr } = await svc
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    if (roleErr) return json({ error: roleErr.message }, 500)

    const roles = (roleRows ?? []).map((r: any) => String(r.role))
    const allowed = roles.includes('developer') || roles.includes('super_admin')
    if (!allowed) return json({ error: 'Forbidden: only developer or super admin can change receipt serial settings' }, 403)

    const body = await req.json().catch(() => ({}))
    if (body?.check === true) {
      return json({ ok: true, available: true, method: 'edge-function' })
    }

    const rawStart = body?.p_start ?? body?.start
    const start = Number(rawStart)
    if (!Number.isSafeInteger(start)) return json({ error: 'শুরুর ক্রমিক নম্বর সঠিক নয়' }, 400)
    if (start < 0) return json({ error: 'ক্রমিক নম্বর ঋণাত্মক হতে পারবে না' }, 400)
    if (start > 9000000000) return json({ error: 'ক্রমিক নম্বর অনেক বড়' }, 400)

    // Highest ACTUALLY used numeric receipt number across payments and receipts.
    let maxUsed = 0
    const { data: paymentRows } = await svc
      .from('payments')
      .select('receipt_no')
      .not('receipt_no', 'is', null)
      .is('deleted_at', null)
      .is('voided_at', null)
      .neq('status', 'voided')
    for (const r of (paymentRows ?? []) as Array<{ receipt_no: string | null }>) {
      const raw = String(r.receipt_no ?? '')
      if (/^[0-9]+$/.test(raw)) {
        const n = Number(raw)
        if (Number.isSafeInteger(n) && n > maxUsed) maxUsed = n
      }
    }

    const { data: receiptRows } = await svc
      .from('receipts')
      .select('receipt_no')
      .not('receipt_no', 'is', null)
      .is('voided_at', null)
    for (const r of (receiptRows ?? []) as Array<{ receipt_no: string | null }>) {
      const raw = String(r.receipt_no ?? '')
      if (/^[0-9]+$/.test(raw)) {
        const n = Number(raw)
        if (Number.isSafeInteger(n) && n > maxUsed) maxUsed = n
      }
    }
    if (start < maxUsed) {
      return json({
        error: `এই নম্বর (${start}) প্রকৃতপক্ষে ব্যবহৃত সর্বশেষ রিসিপ্ট নম্বরের (${maxUsed}) চেয়ে ছোট — ডুপ্লিকেট এড়াতে বাতিল করা হলো`,
      }, 409)
    }

    const { data: oldRow } = await svc
      .from('receipt_settings')
      .select('receipt_serial_start')
      .eq('id', 1)
      .maybeSingle()
    const oldStart = Number((oldRow as any)?.receipt_serial_start ?? 0)

    const { error: upsertErr } = await svc
      .from('receipt_settings')
      .upsert({ id: 1, receipt_serial_start: start, updated_by: userId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (upsertErr) return json({ error: upsertErr.message }, 500)

    // Reset the live counter so the next receipt is exactly start + 1
    // (clearing any phantom drift), never below the highest real receipt.
    const floor = Math.max(start, maxUsed)
    const { error: counterResetErr } = await svc
      .from('receipt_counters')
      .upsert({ kind: 'SERIAL', year: 0, last_no: floor, updated_at: new Date().toISOString() }, { onConflict: 'kind,year' })
    if (counterResetErr) return json({ error: counterResetErr.message }, 500)

    const { error: auditErr } = await svc.from('system_audit_logs').insert({
      office_id: null,
      user_id: userId,
      module: 'receipt',
      action_type: 'update',
      reference_id: null,
      old_data: { receipt_serial_start: oldStart },
      new_data: { receipt_serial_start: start, counter_reset_to: floor },
      user_agent: req.headers.get('user-agent'),
    })

    return json({ ok: true, receipt_serial_start: start, old_receipt_serial_start: oldStart, next_receipt_no: floor + 1, audit_logged: !auditErr })

  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500)
  }
})