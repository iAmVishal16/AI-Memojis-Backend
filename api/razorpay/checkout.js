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
    let {
      RAZORPAY_KEY_ID: RAW_KEY_ID,
      RAZORPAY_KEY_SECRET: RAW_KEY_SECRET,
      PAYMENT_PROVIDER: RAW_PROVIDER = 'razorpay'
    } = process.env

    const RAZORPAY_KEY_ID = (RAW_KEY_ID || '').trim()
    const RAZORPAY_KEY_SECRET = (RAW_KEY_SECRET || '').trim()
    const PAYMENT_PROVIDER = (RAW_PROVIDER || 'razorpay').trim()

    // Accept Razorpay if explicitly enabled via env, or if keys are present, or if caller forces provider
    const forceProvider = (req.query?.provider || (typeof req.body === 'string' ? (JSON.parse(req.body || '{}')||{}).provider : (req.body||{}).provider) || '').toString().toLowerCase()
    const providerEnabled = (PAYMENT_PROVIDER || '').toLowerCase() === 'razorpay' || (!!RAZORPAY_KEY_ID && !!RAZORPAY_KEY_SECRET) || forceProvider === 'razorpay'
    if (!providerEnabled) {
      return res.status(400).json({ error: 'Razorpay provider is not enabled' })
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Razorpay credentials missing' })
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const userId = body.userId
    const plan = body.plan || 'monthly_basic'
    if (!userId) return res.status(400).json({ error: 'userId is required' })

    // Production pricing in INR
    const planAmountsInr = {
      monthly_basic: 876.58,
      monthly_standard: 1754.04,
      monthly_pro: 4386.42
    }
    const amountInr = planAmountsInr[plan] || planAmountsInr.monthly_basic
    const amountPaise = Math.round(amountInr * 100)

    // Create Razorpay order
    const basicAuth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`, 'utf8').toString('base64')
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
    // Read raw text then try to parse for better diagnostics
    const rawText = await orderResp.text()
    let orderJson = {}
    try { orderJson = JSON.parse(rawText) } catch { orderJson = { raw: rawText } }
    if (!orderResp.ok || !orderJson?.id) {
      console.error('Razorpay order error:', {
        status: orderResp.status,
        statusText: orderResp.statusText,
        keyIdPrefix: (RAZORPAY_KEY_ID || '').slice(0, 8),
        provider: PAYMENT_PROVIDER,
        response: orderJson
      })
      return res.status(orderResp.status || 502).json({
        error: 'Failed to create Razorpay order',
        details: orderJson,
        status: orderResp.status,
        statusText: orderResp.statusText,
        debug: {
          provider: (PAYMENT_PROVIDER || '').toString(),
          keyIdPrefix: (RAZORPAY_KEY_ID || '').slice(0, 8),
          hasKeyId: !!RAZORPAY_KEY_ID,
          hasSecret: !!RAZORPAY_KEY_SECRET
        }
      })
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


