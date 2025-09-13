// POST /api/entitlement/check
// Input: { figmaUserId } or { userId }
// Output: { ok: boolean, plan?: 'lifetime'|'subscription', expiry?: string }

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
		if (!data) return res.status(200).json({ ok: false });
		return res.status(200).json({ ok: true, plan: data.plan, expiry: data.expiry || null });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}
