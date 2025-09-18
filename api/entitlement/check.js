// POST /api/entitlement/check
// Input: { figmaUserId } or { userId }
// Output: { ok: boolean, plan?: string, expiry?: string, credits?: { month, monthly_total, remaining, used, free_total, free_remaining } }

import { createClient } from '@supabase/supabase-js';

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
		const { figmaUserId, userId } = req.body || {};
		if (!figmaUserId && !userId) return res.status(400).json({ error: { message: 'figmaUserId or userId is required' } });
		const supabase = getSupabase();
        let query = supabase
			.from('entitlements')
			.select('plan, expiry');
		if (figmaUserId) {
			query = query.eq('figma_user_id', figmaUserId);
		} else if (userId) {
			query = query.eq('web_user_id', userId);
		}
        const { data, error } = await query.single();
		if (error && error.code !== 'PGRST116') return res.status(500).json({ error: { message: error.message } });
        const currentMonth = new Date().toISOString().slice(0, 7);
        const PLAN_TOTAL = { monthly_basic: 100, monthly_standard: 300, monthly_pro: 1000 };

        if (!data) {
            // No entitlement → treat as free; ensure monthly row exists and return free status
            const uid = figmaUserId || userId;
            const FREE_TOTAL = 2;
            const { data: ucFree } = await supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', uid)
                .maybeSingle();
            if (!ucFree || ucFree.current_month !== currentMonth || ucFree.tier !== 'free') {
                await supabase.from('user_credits').upsert({
                    user_id: uid,
                    current_month: currentMonth,
                    credits_remaining: FREE_TOTAL,
                    tier: 'free',
                    updated_at: new Date().toISOString()
                });
            }
            const { data: freshFree } = await supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', uid)
                .single();
            const free_remaining = freshFree && freshFree.tier === 'free' && freshFree.current_month === currentMonth
              ? freshFree.credits_remaining
              : FREE_TOTAL;
            return res.status(200).json({ ok: false, credits: { month: currentMonth, monthly_total: 0, remaining: 0, used: 0, free_total: FREE_TOTAL, free_remaining } });
        }

        // Entitlement present → return plan and credits (if monthly_*)
        const plan = data.plan;
        let credits = null;
        if (PLAN_TOTAL[plan] != null) {
            const uid = figmaUserId || userId;
            const total = PLAN_TOTAL[plan];
            const { data: uc } = await supabase
                .from('user_credits')
                .select('*')
                .eq('user_id', uid)
                .maybeSingle();
            const remaining = uc && uc.current_month === currentMonth && uc.tier === plan ? uc.credits_remaining : total;
            const used = total - remaining;
            credits = { month: currentMonth, monthly_total: total, remaining, used, free_total: 2, free_remaining: 0 };
        }
        return res.status(200).json({ ok: true, plan: data.plan, expiry: data.expiry || null, credits });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}
