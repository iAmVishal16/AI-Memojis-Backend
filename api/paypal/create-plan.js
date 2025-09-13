// Create a Sandbox Plan ($9.99/month) for a given product ID
export default async function handler(req, res) {
	const env = process.env.PAYPAL_ENV || 'sandbox';
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const secret = process.env.PAYPAL_SECRET;
	if (!clientId || !secret) return res.status(500).json({ error: 'Missing creds' });
	const { product_id, amount = '9.99', currency = 'USD', name = 'AI Memojis Pro Monthly' } = req.body || {};
	if (!product_id) return res.status(400).json({ error: 'Missing product_id' });
	try {
		const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
		const tokenRes = await fetch(base + '/v1/oauth2/token', {
			method: 'POST',
			headers: { 'Authorization': 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=client_credentials'
		});
		if (!tokenRes.ok) return res.status(502).json({ step: 'oauth', status: tokenRes.status, body: await tokenRes.text() });
		const { access_token } = await tokenRes.json();
		// Create plan
		const planBody = {
			product_id,
			name,
			status: 'ACTIVE',
			billing_cycles: [
				{
					frequency: { interval_unit: 'MONTH', interval_count: 1 },
					tenure_type: 'REGULAR',
					sequence: 1,
					total_cycles: 0,
					pricing_scheme: { fixed_price: { value: amount, currency_code: currency } }
				}
			],
			payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 1 }
		};
		const r = await fetch(base + '/v1/billing/plans', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify(planBody)
		});
		const text = await r.text();
		return res.status(r.status).json({ status: r.status, body: text });
	} catch (e) {
		return res.status(500).json({ error: String(e) });
	}
}
