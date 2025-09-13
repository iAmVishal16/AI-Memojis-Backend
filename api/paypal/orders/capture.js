// Capture PayPal Order (Sandbox/Live)

export default async function handler(req, res) {
	if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

	const env = process.env.PAYPAL_ENV || 'sandbox';
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const secret = process.env.PAYPAL_SECRET;

	const { orderId } = req.body || {};
	if (!orderId) return res.status(400).json({ error: { message: 'Missing orderId' } });

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
			console.error('[PayPal CaptureOrder] OAuth error:', tokenRes.status, tErr);
			return res.status(502).json({ error: { message: 'PayPal OAuth error' } });
		}
		const { access_token } = await tokenRes.json();

		// Capture
		const capRes = await fetch(base + `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
			method: 'POST',
			headers: { 'Authorization': `Bearer ${access_token}`, 'Content-Type': 'application/json' }
		});
		const j = await capRes.json();
		if (!capRes.ok) {
			console.error('[PayPal CaptureOrder] Error:', capRes.status, j);
			return res.status(capRes.status).json({ error: { message: j && j.message || 'Capture failed' } });
		}

		try {
			const pu = Array.isArray(j.purchase_units) ? j.purchase_units[0] : null;
			const captures = pu && pu.payments && Array.isArray(pu.payments.captures) ? pu.payments.captures : [];
			const capture = captures[0];
			console.log('[PayPal CaptureOrder] Success:', {
				orderId: j.id,
				status: j.status,
				captureId: capture && capture.id,
				amount: capture && capture.amount && (capture.amount.value + ' ' + capture.amount.currency_code),
				customId: pu && pu.custom_id
			});
			// TODO: Upsert lifetime entitlement for figmaUserId = pu.custom_id
		} catch (e) {
			console.warn('[PayPal CaptureOrder] Post-process warning:', e);
		}

		return res.status(200).json({ ok: true, id: j.id, status: j.status });
	} catch (err) {
		console.error('[PayPal CaptureOrder] Handler error:', err);
		return res.status(500).json({ error: { message: 'Internal error' } });
	}
}
