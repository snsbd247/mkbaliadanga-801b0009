import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Recompute paid/due/status for an irrigation invoice given payable + paid.
function computeInvoiceDue(payable: number, paid: number) {
  const pay = Math.max(0, Math.round(Number(payable) || 0))
  const p = Math.max(0, Math.round(Number(paid) || 0))
  const due = Math.max(0, pay - p)
  const status = due <= 0 ? 'paid' : p > 0 ? 'partial' : 'unpaid'
  return { paid: p, due, status }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const token = authHeader.replace('Bearer ', '')

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData, error: claimsErr } = await anon.auth.getClaims(token)
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claimsData.claims.sub as string

    // Service-role client for privileged reads/writes (bypasses RLS after our own auth check).
    const svc = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // ---- Authorization: developer / super_admin / admin OR payments edit permission ----
    const { data: roleRows } = await svc.from('user_roles').select('role').eq('user_id', userId)
    const roles = (roleRows ?? []).map((r: any) => r.role as string)
    const isSuper = roles.includes('developer') || roles.includes('super_admin')
    const isAdmin = isSuper || roles.includes('admin')

    let allowed = isAdmin
    if (!allowed) {
      // per-user override first
      const { data: up } = await svc.from('user_permissions').select('can_edit').eq('user_id', userId).eq('module', 'payments').maybeSingle()
      if (up) allowed = !!up.can_edit
      else {
        // role defaults
        const { data: rp } = await svc.from('role_permissions').select('role,can_edit').eq('module', 'payments').in('role', roles.length ? roles : ['__none__'])
        allowed = (rp ?? []).some((r: any) => r.can_edit)
      }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: 'Forbidden: no edit permission for payments' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ---- Input ----
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify({ error: 'Invalid body' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const paymentId = String(body.payment_id || '')
    const reason = String(body.reason || '').trim()
    if (!paymentId) return new Response(JSON.stringify({ error: 'payment_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (!reason) return new Response(JSON.stringify({ error: 'reason required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

    const newAmount = Math.round(Number(body.amount) || 0)
    if (newAmount < 0) return new Response(JSON.stringify({ error: 'amount must be >= 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    const newNote = (body.note != null && String(body.note).trim()) ? String(body.note).trim() : null
    const newMouza = body.mouza != null ? String(body.mouza).trim() : null
    const newSize = body.land_size != null ? Number(body.land_size) || 0 : null
    const newOwner = body.owner_farmer_id ? String(body.owner_farmer_id) : null
    const newFee = body.delay_fee != null ? Math.round(Number(body.delay_fee) || 0) : null

    // ---- Load payment + allocations ----
    const { data: pay, error: payErr } = await svc.from('payments')
      .select('id,amount,note,kind,reference_id,office_id,receipt_no,status,voided_at,payment_allocations(id,kind,reference_id,amount)')
      .eq('id', paymentId).maybeSingle()
    if (payErr || !pay) return new Response(JSON.stringify({ error: 'Payment not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (pay.voided_at || pay.status === 'voided') {
      return new Response(JSON.stringify({ error: 'Cannot edit a voided receipt' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const allocs: any[] = (pay as any).payment_allocations ?? []
    const irrAlloc = allocs.find((a) => a.kind === 'irrigation' && a.reference_id)
      ?? ((pay as any).kind === 'irrigation' && (pay as any).reference_id ? { reference_id: (pay as any).reference_id, amount: (pay as any).amount } : null)
    const invId: string | null = irrAlloc?.reference_id ?? null

    const before: any = {}
    const after: any = {}
    let landId: string | null = null

    // Resolve land id from invoice
    if (invId) {
      const { data: inv0 } = await svc.from('irrigation_invoices').select('land_id').eq('id', invId).maybeSingle()
      landId = (inv0 as any)?.land_id ?? null
    }

    // ---- Server-side validation (block wrong farmer / over-payment) ----
    // Validate new owner farmer exists.
    if (newOwner != null) {
      const { data: f } = await svc.from('farmers').select('id').eq('id', newOwner).maybeSingle()
      if (!f) return new Response(JSON.stringify({ error: 'ভুল কৃষক: farmer not found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    // For irrigation, the (possibly re-computed) payable must cover the new amount —
    // blocks accidentally entering a higher/lower amount that breaks the invoice.
    if (invId) {
      const { data: invV } = await svc.from('irrigation_invoices')
        .select('payable_amount,delay_fee').eq('id', invId).maybeSingle()
      if (invV) {
        const basePayable = Number((invV as any).payable_amount || 0)
        const feeDelta = newFee != null ? (newFee - Number((invV as any).delay_fee || 0)) : 0
        const effectivePayable = basePayable + feeDelta
        if (newAmount > effectivePayable) {
          return new Response(JSON.stringify({ error: `অঙ্ক প্রদেয়র চেয়ে বেশি (max ${effectivePayable})` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }
    }


    // 1) Land fields
    if (landId && (newMouza != null || newSize != null)) {
      const { data: land } = await svc.from('lands').select('mouza,land_size').eq('id', landId).maybeSingle()
      if (land) {
        const m = newMouza != null ? newMouza : land.mouza
        const s = newSize != null ? newSize : Number(land.land_size || 0)
        if (land.mouza !== m || Number(land.land_size || 0) !== s) {
          before.land = { mouza: land.mouza, land_size: land.land_size }
          after.land = { mouza: m, land_size: s }
          await svc.from('lands').update({ mouza: m, land_size: s }).eq('id', landId)
        }
      }
    }

    // 2) Invoice owner + delay fee
    if (invId && (newOwner != null || newFee != null)) {
      const { data: inv } = await svc.from('irrigation_invoices')
        .select('owner_farmer_id,delay_fee,payable_amount,due_amount,paid_amount').eq('id', invId).maybeSingle()
      if (inv) {
        const patch: any = {}
        if (newOwner != null && (inv as any).owner_farmer_id !== newOwner) {
          before.owner = (inv as any).owner_farmer_id; after.owner = newOwner; patch.owner_farmer_id = newOwner
        }
        if (newFee != null) {
          const oldFee = Number((inv as any).delay_fee || 0)
          if (oldFee !== newFee) {
            before.delay_fee = oldFee; after.delay_fee = newFee
            patch.delay_fee = newFee
            patch.payable_amount = Number((inv as any).payable_amount || 0) + (newFee - oldFee)
            patch.due_amount = Math.max(0, Number((inv as any).due_amount || 0) + (newFee - oldFee))
          }
        }
        if (Object.keys(patch).length) await svc.from('irrigation_invoices').update(patch).eq('id', invId)
      }
    }

    // 3) Payment amount adjustment
    if (newAmount !== Number((pay as any).amount || 0)) {
      const diff = newAmount - Number((pay as any).amount || 0)
      before.amount = Number((pay as any).amount || 0); after.amount = newAmount
      await svc.from('payments').update({ amount: newAmount }).eq('id', paymentId)
      if (invId) {
        const { data: inv2 } = await svc.from('irrigation_invoices').select('paid_amount,payable_amount').eq('id', invId).maybeSingle()
        if (inv2) {
          const st = computeInvoiceDue((inv2 as any).payable_amount, Number((inv2 as any).paid_amount || 0) + diff)
          await svc.from('irrigation_invoices').update({ paid_amount: st.paid, due_amount: st.due, invoice_status: st.status }).eq('id', invId)
        }
        const { data: iip } = await svc.from('irrigation_invoice_payments').select('id,collected_amount').eq('payment_id', paymentId).eq('invoice_id', invId).maybeSingle()
        if (iip) {
          const nv = Math.max(0, Number((iip as any).collected_amount || 0) + diff)
          await svc.from('irrigation_invoice_payments').update({ collected_amount: nv, irrigation_collected: nv }).eq('id', (iip as any).id)
        }
      }
      const { data: pa } = await svc.from('payment_allocations').select('id').eq('payment_id', paymentId).eq('kind', 'irrigation').maybeSingle()
      if (pa) await svc.from('payment_allocations').update({ amount: newAmount }).eq('id', (pa as any).id)
    }

    // 4) Note
    if (((pay as any).note ?? null) !== newNote) {
      before.note = (pay as any).note ?? null; after.note = newNote
      await svc.from('payments').update({ note: newNote }).eq('id', paymentId)
    }

    // 5) Audit log
    await svc.from('audit_logs').insert({
      user_id: userId, action: 'edit', entity: 'payments', entity_id: paymentId,
      office_id: (pay as any).office_id ?? null,
      old_values: before, new_values: { ...after, reason },
      meta: { receipt_no: (pay as any).receipt_no },
    })

    return new Response(JSON.stringify({ ok: true, before, after }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
