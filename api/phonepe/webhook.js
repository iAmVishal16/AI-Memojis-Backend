// POST /api/phonepe/webhook
// Records successful PhonePe payments and grants entitlement.
// This is a simplified sandbox-friendly handler. In production, verify X-VERIFY signature per PhonePe docs.

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
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VERIFY');
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

	try {
		const body = req.body || {};
		// PhonePe sends { success, code, message, data: { merchantId, merchantTransactionId, ... }, ... }
		// Our checkout attached metadata with { userId, plan } in the original request; some aggregators echo it back.
		// To be robust, also accept explicit fields.
		const status = body.success === true || body.code === 'PAYMENT_SUCCESS';
		const data = body.data || {};
		const meta = data.metadata || body.metadata || {};
		const userId = meta.userId || body.userId || data.userId;
		const plan = meta.plan || body.plan || data.plan || 'lifetime';
		const merchantTransactionId = data.merchantTransactionId || body.merchantTransactionId || '';

		if (!status) {
			return res.status(200).json({ ok: false, message: 'Ignoring non-success webhook' });
		}
		if (!userId) {
			return res.status(400).json({ error: { message: 'Missing userId in webhook payload' } });
		}

		const supabase = getSupabase();
		// Upsert entitlement for web_user_id
		const { error } = await supabase
			.from('entitlements')
			.upsert(
				{
					web_user_id: userId,
					plan: plan === 'monthly' ? 'subscription' : 'lifetime',
					provider: 'phonepe',
					transaction_id: merchantTransactionId || null
				},
				{ onConflict: 'web_user_id' }
			);
		if (error) {
			return res.status(500).json({ error: { message: error.message } });
		}

		return res.status(200).json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}


