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
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const userId = body.userId || body.figmaUserId
    if (!userId) return res.status(400).json({ error: { message: 'userId required' } })

    const supabase = getSupabase()
    const currentMonth = new Date().toISOString().slice(0, 7)

    // Check entitlement for active paid plan
    const { data: ent, error: entErr } = await supabase
      .from('entitlements')
      .select('plan, expiry')
      .eq('figma_user_id', userId)
      .maybeSingle()

    const now = new Date()
    const plan = ent?.plan || null
    const expiryValid = ent?.expiry ? new Date(ent.expiry) > now : !!ent?.plan && ent.plan === 'lifetime'

    const PLAN_TOTAL: any = {
      monthly_basic: 100,
      monthly_standard: 300,
      monthly_pro: 1000
    }

    if (plan && expiryValid && PLAN_TOTAL[plan] != null) {
      // Paid plan
      // Ensure user_credits row exists and is current for month and tier
      const total = PLAN_TOTAL[plan]
      const { data: uc } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle()

      if (!uc || uc.current_month !== currentMonth || uc.tier !== plan) {
        await supabase.from('user_credits').upsert({
          user_id: userId,
          current_month: currentMonth,
          credits_remaining: total,
          tier: plan,
          updated_at: new Date().toISOString()
        })
      }

      const { data: fresh } = await supabase
        .from('user_credits')
        .select('*')
        .eq('user_id', userId)
        .single()

      const remaining = fresh?.credits_remaining ?? total
      const used = total - remaining
      return res.status(200).json({
        ok: true,
        tier: plan,
        month: currentMonth,
        monthly_total: total,
        remaining,
        used,
        free_total: 2,
        free_remaining: 0,
        last_updated: fresh?.updated_at || new Date().toISOString()
      })
    }

    // Free user monthly status (persist in user_credits as tier 'free')
    const FREE_TOTAL = 2
    const { data: ucFree } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (!ucFree || ucFree.current_month !== currentMonth || ucFree.tier !== 'free') {
      await supabase.from('user_credits').upsert({
        user_id: userId,
        current_month: currentMonth,
        credits_remaining: FREE_TOTAL,
        tier: 'free',
        updated_at: new Date().toISOString()
      })
    }

    const { data: freshFree } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single()

    const remainingFree = freshFree?.tier === 'free' ? freshFree.credits_remaining : FREE_TOTAL
    const usedFree = FREE_TOTAL - remainingFree
    return res.status(200).json({
      ok: true,
      tier: 'free',
      month: currentMonth,
      monthly_total: 0,
      remaining: 0,
      used: 0,
      free_total: FREE_TOTAL,
      free_remaining: remainingFree,
      last_updated: freshFree?.updated_at || new Date().toISOString()
    })
  } catch (e) {
    console.error('credits/status error', e)
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
}


