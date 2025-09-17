// POST /api/phonepe/webhook
// Records successful PhonePe payments and grants entitlement.
// This is a simplified sandbox-friendly handler. In production, verify X-VERIFY signature per PhonePe docs.

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
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-VERIFY, Authorization');
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

	// Basic Authentication for PhonePe webhook
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Basic ')) {
		return res.status(401).json({ error: { message: 'Authentication required' } });
	}

	const credentials = Buffer.from(authHeader.slice(6), 'base64').toString();
	const [username, password] = credentials.split(':');
	
	const expectedUsername = process.env.PHONEPE_WEBHOOK_USERNAME || 'phonepe_webhook_user';
	const expectedPassword = process.env.PHONEPE_WEBHOOK_PASSWORD || 'Rule2701';
	
	if (username !== expectedUsername || password !== expectedPassword) {
		return res.status(401).json({ error: { message: 'Invalid credentials' } });
	}

	try {
		const body = req.body || {};
		// PhonePe sends { success, code, message, data: { merchantId, merchantTransactionId, ... }, ... }
		// Our checkout attached metadata with { userId, plan } in the original request; some aggregators echo it back.
		// To be robust, also accept explicit fields.
		const status = body.success === true || body.code === 'PAYMENT_SUCCESS';
		const data = body.data || {};
		const meta = data.metadata || body.metadata || {};
		const userId = meta.userId || body.userId || data.userId;
		const plan = meta.plan || body.plan || data.plan || 'monthly_basic';
		const merchantTransactionId = data.merchantTransactionId || body.merchantTransactionId || '';

		if (!status) {
			return res.status(200).json({ ok: false, message: 'Ignoring non-success webhook' });
		}
		if (!userId) {
			return res.status(400).json({ error: { message: 'Missing userId in webhook payload' } });
		}

		const supabase = getSupabase();
		
		// Map plan to subscription tier
		const planMapping = {
			'monthly_basic': 'monthly_basic',
			'monthly_standard': 'monthly_standard', 
			'monthly_pro': 'monthly_pro',
			'monthly': 'monthly_basic', // fallback
			'lifetime': 'lifetime'
		};
		const subscriptionTier = planMapping[plan] || 'monthly_basic';

		// Upsert entitlement for figma_user_id (using userId as figma_user_id for web users)
		const { error } = await supabase
			.from('entitlements')
			.upsert(
				{
					figma_user_id: userId,
					plan: subscriptionTier,
					expiry: subscriptionTier === 'lifetime' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
					updated_at: new Date().toISOString()
				},
				{ onConflict: 'figma_user_id' }
			);
		if (error) {
			return res.status(500).json({ error: { message: error.message } });
		}

		// Reset monthly credits for the user
		if (subscriptionTier !== 'lifetime') {
			try {
				await resetMonthlyCredits(userId, subscriptionTier);
			} catch (creditError) {
				console.warn('Failed to reset monthly credits:', creditError);
				// Don't fail the webhook if credit reset fails
			}
		}

		return res.status(200).json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}


