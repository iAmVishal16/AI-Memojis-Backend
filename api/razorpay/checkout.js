// POST /api/razorpay/checkout
// Body: { userId: string, plan: 'monthly_basic'|'monthly_standard'|'monthly_pro' }
// Creates a Razorpay order, persists it in `orders`, and returns { orderId, amount, currency, keyId }

import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env not configured')
  return createClient(url, key, { auth: { persistSession: false } })
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    const {
      RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET,
      PAYMENT_PROVIDER = 'razorpay'
    } = process.env

    if (PAYMENT_PROVIDER !== 'razorpay') {
      return res.status(400).json({ error: 'Razorpay provider is not enabled' })
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay credentials missing' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const userId = body.userId
    const plan = body.plan || 'monthly_basic'
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    const planAmountsInr = {
      monthly_basic: 876.58,
      monthly_standard: 1754.04,
      monthly_pro: 4386.42
    }
    const amountInr = planAmountsInr[plan] || planAmountsInr.monthly_basic
    const amountPaise = Math.round(amountInr * 100)

    // Create Razorpay order
    const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64')
    const orderResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${basicAuth}`
      },
      body: JSON.stringify({
        amount: amountPaise,
        currency: 'INR',
        receipt: `aim-${Date.now()}`,
        payment_capture: 1,
        notes: { userId, plan }
      })
    })
    const orderJson = await orderResp.json().catch(() => ({}))
    if (!orderResp.ok || !orderJson?.id) {
      return res.status(502).json({ error: 'Failed to create Razorpay order', details: orderJson })
    }

    const orderId = orderJson.id
    const supabase = getSupabase()
    // Persist order
    try {
      const { error } = await supabase
        .from('orders')
        .upsert({
          order_id: orderId,
          user_id: userId,
          plan,
          amount_rupees: amountInr,
          status: 'created',
          provider: 'razorpay',
          updated_at: new Date().toISOString()
        }, { onConflict: 'order_id' })
      if (error) console.warn('Failed to persist order row:', error)
    } catch (e) {
      console.warn('Order persistence exception:', e)
    }

    return res.status(200).json({ ok: true, orderId, amount: amountPaise, currency: 'INR', keyId: RAZORPAY_KEY_ID })
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'Internal error' })
  }
}


