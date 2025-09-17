export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      PHONEPE_CLIENT_ID,
      PHONEPE_CLIENT_SECRET,
      PHONEPE_CLIENT_VERSION = '1',
      PHONEPE_ENVIRONMENT = 'sandbox',
    } = process.env;

    // Robustly read orderId from query string
    let orderId = null;
    try {
      const fullUrl = new URL(req.url, 'http://localhost');
      orderId = fullUrl.searchParams.get('orderId') || fullUrl.searchParams.get('merchantOrderId');
    } catch (_) {}
    if (!orderId && req.query) {
      orderId = req.query.orderId || req.query.merchantOrderId;
    }
    if (!orderId) {
      res.status(400).json({ error: 'orderId (merchantOrderId) is required' });
      return;
    }

    const isProduction = PHONEPE_ENVIRONMENT === 'production';
    const oauthUrl = isProduction
      ? 'https://api.phonepe.com/apis/pg/v1/oauth/token'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';

    // Fetch auth token
    const formBody = `client_id=${encodeURIComponent(PHONEPE_CLIENT_ID)}&client_version=${encodeURIComponent(PHONEPE_CLIENT_VERSION)}&client_secret=${encodeURIComponent(PHONEPE_CLIENT_SECRET)}&grant_type=client_credentials`;
    const authResp = await fetch(oauthUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody,
    });
    const authJson = await authResp.json().catch(() => ({}));
    if (!authResp.ok || !authJson?.access_token) {
      res.status(400).json({ error: 'auth_failed', details: authJson });
      return;
    }
    const accessToken = authJson.access_token;

    // V2 Order Status endpoint
    const payBase = isProduction
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    // Per docs: /checkout/v2/order/{merchantOrderId}/status
    const statusUrl = `${payBase}/checkout/v2/order/${encodeURIComponent(orderId)}/status?details=false`;

    console.log(`🔎 PhonePe status check:`, { orderId, statusUrl, env: PHONEPE_ENVIRONMENT });
    const statusResp = await fetch(statusUrl, {
      method: 'GET',
      headers: {
        'Authorization': `O-Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
        // Add X-MERCHANT-ID only if your integration requires partner header
      }
    });
    const text = await statusResp.text();
    let statusJson = {};
    try { statusJson = JSON.parse(text); } catch (_) { statusJson = { raw: text }; }
    if (!statusResp.ok) {
      console.error('Status failed', { code: statusResp.status, data: statusJson });
      res.status(statusResp.status || 502).json({ error: 'status_failed', details: statusJson });
      return;
    }

    res.status(200).json({ ok: true, orderId, status: statusJson });
  } catch (err) {
    res.status(500).json({ error: err?.message || 'Internal error' });
  }
}

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
			.eq('figma_user_id', userId)
			.single();
		if (error && error.code !== 'PGRST116') return res.status(500).json({ error: { message: error.message } });
		if (!data) return res.status(200).json({ ok: false });
		return res.status(200).json({ ok: true, plan: data.plan });
	} catch (e) {
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}


