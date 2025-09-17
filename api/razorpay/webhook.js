// POST /api/razorpay/webhook
// Verifies signature, marks order paid, upserts entitlement, resets monthly credits

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { resetMonthlyCredits } from '../credits/index.js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Razorpay-Signature')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })

  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET
    if (!secret) return res.status(500).json({ error: { message: 'Webhook secret not set' } })

    const payload = JSON.stringify(req.body || {})
    const sig = req.headers['x-razorpay-signature']
    if (!sig) return res.status(401).json({ error: { message: 'Signature missing' } })

    const generated = crypto.createHmac('sha256', secret).update(payload).digest('hex')
    if (generated !== sig) return res.status(401).json({ error: { message: 'Invalid signature' } })

    const event = req.body?.event
    const entity = req.body?.payload?.payment?.entity || req.body?.payload?.order?.entity
    const orderId = (entity && (entity.order_id || entity.id)) || req.body?.payload?.order?.entity?.id
    const notes = (entity && entity.notes) || {}
    const userId = notes.userId || req.body.userId
    const plan = notes.plan || req.body.plan || 'monthly_basic'

    if (!orderId) return res.status(400).json({ error: { message: 'orderId missing in webhook' } })

    if (!['payment.captured', 'order.paid'].includes(event)) {
      return res.status(200).json({ ok: true, ignored: true })
    }

    const supabase = getSupabase()

    // Mark order paid
    const { error: orderErr } = await supabase
      .from('orders')
      .upsert({
        order_id: orderId,
        user_id: userId || null,
        plan,
        status: 'paid',
        provider: 'razorpay',
        raw_response: req.body,
        updated_at: new Date().toISOString()
      }, { onConflict: 'order_id' })
    if (orderErr) console.warn('Order upsert error:', orderErr)

    if (userId) {
      // Map plan → tier
      const tier = ['monthly_basic','monthly_standard','monthly_pro'].includes(plan) ? plan : 'monthly_basic'
      const { error: entErr } = await supabase
        .from('entitlements')
        .upsert({
          figma_user_id: userId,
          plan: tier,
          expiry: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { onConflict: 'figma_user_id' })
      if (entErr) console.warn('Entitlement upsert error:', entErr)

      try { await resetMonthlyCredits(userId, tier) } catch (e) { /* noop */ }
    }

    return res.status(200).json({ ok: true })
  } catch (e) {
    return res.status(500).json({ error: { message: e?.message || 'Internal error' } })
  }
}


