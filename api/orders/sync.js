// POST /api/orders/sync
// Body: { orderId: string, userId?: string }
// If the order is marked paid, grants entitlement and resets monthly credits for the user

import { createClient } from '@supabase/supabase-js';
import { resetMonthlyCredits } from '../credits/index.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  try {
    const { orderId, userId: userIdInput } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (!orderId && !userIdInput) return res.status(400).json({ error: { message: 'orderId or userId is required' } });

    const supabase = getSupabase();

    // Lookup order
    let query = supabase.from('orders').select('*');
    if (orderId) query = query.eq('order_id', orderId);
    if (userIdInput && !orderId) query = query.eq('user_id', userIdInput).order('created_at', { ascending: false });
    const { data: order, error } = await query.maybeSingle();
    if (error) return res.status(500).json({ error: { message: error.message } });
    if (!order) return res.status(404).json({ error: { message: 'Order not found' } });

    if (order.status !== 'paid') {
      return res.status(409).json({ error: { message: 'Order not marked paid yet' }, order });
    }

    const userId = order.user_id || userIdInput;
    if (!userId) return res.status(400).json({ error: { message: 'Unable to resolve userId for order' } });

    // Map plan to tier
    const plan = order.plan || 'monthly_basic';
    const planMapping = {
      'monthly_basic': 'monthly_basic',
      'monthly_standard': 'monthly_standard',
      'monthly_pro': 'monthly_pro',
      'monthly': 'monthly_basic',
      'lifetime': 'lifetime'
    };
    const subscriptionTier = planMapping[plan] || 'monthly_basic';

    // Upsert entitlement
    const { error: entErr } = await supabase
      .from('entitlements')
      .upsert({
        figma_user_id: userId,
        plan: subscriptionTier,
        expiry: subscriptionTier === 'lifetime' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'figma_user_id' });
    if (entErr) return res.status(500).json({ error: { message: entErr.message } });

    // Reset credits for the month
    try {
      await resetMonthlyCredits(userId, subscriptionTier);
    } catch (e) {
      // continue
    }

    return res.status(200).json({ ok: true, userId, plan: subscriptionTier });
  } catch (e) {
    return res.status(500).json({ error: { message: 'Internal error' } });
  }
}


