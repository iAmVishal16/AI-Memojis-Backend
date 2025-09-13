// GET /api/phonepe/status?userId=...
// Returns entitlement presence for a web user id.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
	if (!url || !key) throw new Error('Supabase env not configured');
	return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: { message: 'Method not allowed' } });

	try {
		const userId = (req.query && (req.query.userId || req.query.uid)) || '';
		if (!userId) return res.status(400).json({ error: { message: 'userId is required' } });
		const supabase = getSupabase();
		const { data, error } = await supabase
			.from('entitlements')
			.select('plan')
			.eq('web_user_id', userId)
			.single();
		if (error && error.code !== 'PGRST116') return res.status(500).json({ error: { message: error.message } });
		if (!data) return res.status(200).json({ ok: false });
		return res.status(200).json({ ok: true, plan: data.plan });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}


