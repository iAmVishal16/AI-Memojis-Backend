// Create PayPal Order (Sandbox/Live)

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

	const env = process.env.PAYPAL_ENV || 'sandbox';
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const secret = process.env.PAYPAL_SECRET;

	if (!clientId || !secret) return res.status(500).json({ error: { message: 'Missing PayPal credentials' } });

	const { amount, currency = 'USD', title = 'AI Memojis Pro Lifetime', figmaUserId = '', type = 'lifetime' } = req.body || {};
	if (!amount) return res.status(400).json({ error: { message: 'Missing amount' } });

	try {
		const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
		// OAuth token
		const tokenRes = await fetch(base + '/v1/oauth2/token', {
			method: 'POST',
			headers: { 'Authorization': 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'grant_type=client_credentials'
		});
		if (!tokenRes.ok) {
			const tErr = await tokenRes.text();
			console.error('[PayPal CreateOrder] OAuth error:', tokenRes.status, tErr);
			return res.status(502).json({ error: { message: 'PayPal OAuth error', details: tErr, base } });
		}
		const { access_token } = await tokenRes.json();

		// Create order
		const orderRes = await fetch(base + '/v2/checkout/orders', {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				intent: 'CAPTURE',
				purchase_units: [{
					amount: { currency_code: currency, value: amount },
					description: title,
					custom_id: String(figmaUserId || '').slice(0,127)
				}],
				application_context: { shipping_preference: 'NO_SHIPPING' }
			})
		});
		const j = await orderRes.json();
		if (!orderRes.ok) {
			console.error('[PayPal CreateOrder] Error:', orderRes.status, j);
			return res.status(orderRes.status).json({ error: { message: j && j.message || 'Create order failed', details: j } });
		}
		return res.status(200).json({ id: j.id });
	} catch (err) {
		console.error('[PayPal CreateOrder] Handler error:', err);
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}
