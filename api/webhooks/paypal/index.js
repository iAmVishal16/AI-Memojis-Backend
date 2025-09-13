// PayPal Webhook (Sandbox) for AI Memojis
// Environment variables required (set in Vercel):
// - PAYPAL_ENV = 'sandbox' | 'live' (use 'sandbox' now)
// - PAYPAL_CLIENT_ID
// - PAYPAL_SECRET
// - PAYPAL_WEBHOOK_ID (from PayPal dashboard for this webhook URL)

// IMPORTANT: Do NOT hardcode secrets. Configure env vars in your deployment.

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
	const url = process.env.SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
	return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
	// CORS and preflight
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, PayPal-Transmission-Id, PayPal-Transmission-Time, PayPal-Transmission-Sig, PayPal-Auth-Algo, PayPal-Cert-Url, PayPal-Webhook-Id');
	if (req.method === 'OPTIONS') {
		return res.status(200).end();
	}

	if (req.method !== 'POST') {
		return res.status(405).json({ error: { message: 'Method not allowed' } });
	}

	const env = process.env.PAYPAL_ENV || 'sandbox';
	const clientId = process.env.PAYPAL_CLIENT_ID;
	const secret = process.env.PAYPAL_SECRET;
	const webhookId = process.env.PAYPAL_WEBHOOK_ID;

	// Raw body string is needed for signature verification hashing context.
	// Vercel provides req.body as parsed JSON by default for Node runtimes.
	// We'll re-stringify for verification call and use headers as provided.
	const event = req.body || {};
	const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});

	// Collect PayPal headers
	const transmissionId = req.headers['paypal-transmission-id'];
	const transmissionTime = req.headers['paypal-transmission-time'];
	const certUrl = req.headers['paypal-cert-url'];
	const authAlgo = req.headers['paypal-auth-algo'];
	const transmissionSig = req.headers['paypal-transmission-sig'];

	// If any env missing, log and accept to avoid dropping events during setup
	if (!clientId || !secret || !webhookId) {
		console.warn('[PayPal Webhook] Missing env vars. Received event will be accepted without verification.', {
			env,
			hasClientId: Boolean(clientId),
			hasSecret: Boolean(secret),
			hasWebhookId: Boolean(webhookId)
		});
		await logEvent(event);
		return res.status(200).json({ ok: true, verified: false });
	}

	try {
		// 1) Get OAuth access token
		const base = env === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
		const tokenRes = await fetch(base + '/v1/oauth2/token', {
			method: 'POST',
			headers: {
				'Authorization': 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'),
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body: 'grant_type=client_credentials'
		});
		if (!tokenRes.ok) {
			const tErr = await tokenRes.text();
			console.error('[PayPal Webhook] OAuth token error:', tokenRes.status, tErr);
			// Fail open to avoid losing events; mark unverified
			await logEvent(event);
			return res.status(200).json({ ok: true, verified: false });
		}
		const { access_token } = await tokenRes.json();

		// 2) Verify Webhook Signature
		const verifyRes = await fetch(base + '/v1/notifications/verify-webhook-signature', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${access_token}`
			},
			body: JSON.stringify({
				transmission_id: transmissionId,
				transmission_time: transmissionTime,
				cert_url: certUrl,
				auth_algo: authAlgo,
				transmission_sig: transmissionSig,
				webhook_id: webhookId,
				webhook_event: event
			})
		});

		if (!verifyRes.ok) {
			const vErr = await verifyRes.text();
			console.error('[PayPal Webhook] Verify call failed:', verifyRes.status, vErr);
			await logEvent(event);
			return res.status(200).json({ ok: true, verified: false });
		}
		const verifyJson = await verifyRes.json();
		const verified = verifyJson.verification_status === 'SUCCESS';
		if (!verified) {
			console.warn('[PayPal Webhook] Signature not verified:', verifyJson);
			// Still accept but mark unverified to avoid retries storm
			await logEvent(event);
			return res.status(200).json({ ok: true, verified: false });
		}

		// 3) Process the event
		await processPayPalEvent(event);
		return res.status(200).json({ ok: true, verified: true });
	} catch (err) {
		console.error('[PayPal Webhook] Handler error:', err);
		// Respond 200 to prevent repeated retries while we fix issues
		return res.status(200).json({ ok: true, verified: false });
	}
}

async function logEvent(event) {
	try {
		console.log('[PayPal Webhook] Event received (log only):', {
			type: event?.event_type,
			id: event?.id,
			resourceId: event?.resource?.id,
			status: event?.resource?.status,
			createTime: event?.create_time
		});
	} catch (_) {}
}

async function processPayPalEvent(event) {
	const type = event?.event_type;
	const resource = event?.resource || {};
	console.log('[PayPal Webhook] Processing event:', type);

	switch (type) {
		// Subscription lifecycle
		case 'BILLING.SUBSCRIPTION.CREATED':
		case 'BILLING.SUBSCRIPTION.ACTIVATED': {
			await upsertEntitlementFromSubscription(resource, { status: 'active' });
			break;
		}
		case 'BILLING.SUBSCRIPTION.SUSPENDED':
		case 'BILLING.SUBSCRIPTION.CANCELLED':
		case 'BILLING.SUBSCRIPTION.EXPIRED': {
			await upsertEntitlementFromSubscription(resource, { status: 'inactive' });
			break;
		}

		// Recurring payment success (older vs newer events vary by region)
		case 'PAYMENT.SALE.COMPLETED':
		case 'PAYMENT.CAPTURE.COMPLETED': {
			await recordPayment(resource);
			break;
		}

		// One-time refund
		case 'PAYMENT.CAPTURE.REFUNDED': {
			await recordRefund(resource);
			break;
		}

		default: {
			console.log('[PayPal Webhook] Unhandled event type:', type);
		}
	}
}

// Persist subscription entitlement to Supabase
async function upsertEntitlementFromSubscription(resource, { status }) {
	const supabase = getSupabase();
	const figmaUserId = resource?.custom_id || resource?.subscriber?.payer_id || null;
	try {
		console.log('[Entitlement] Upsert subscription:', {
			subscriptionId: resource?.id,
			planId: resource?.plan_id,
			status,
			nextBillingTime: resource?.billing_info?.next_billing_time,
			customId: resource?.custom_id
		});
		if (!figmaUserId) return;
		const payload = { figma_user_id: figmaUserId, plan: status === 'active' ? 'subscription' : 'none', expiry: resource?.billing_info?.next_billing_time || null, updated_at: new Date().toISOString() };
		const { error } = await supabase
			.from('entitlements')
			.upsert(payload, { onConflict: 'figma_user_id' });
		if (error) console.warn('[Entitlement] Supabase upsert error:', error.message);
	} catch (e) {
		console.warn('[Entitlement] Supabase upsert exception:', e);
	}
}

// Persist lifetime entitlement on capture when custom_id is present
async function recordPayment(resource) {
	const supabase = getSupabase();
	console.log('[Payment] Capture/Sale completed:', {
		id: resource?.id,
		amount: resource?.amount?.value + ' ' + resource?.amount?.currency_code,
		invoiceId: resource?.invoice_id,
		customId: resource?.custom_id
	});
	try {
		const figmaUserId = resource?.custom_id || null;
		if (!figmaUserId) return;
		const payload = { figma_user_id: figmaUserId, plan: 'lifetime', expiry: null, updated_at: new Date().toISOString() };
		const { error } = await supabase
			.from('entitlements')
			.upsert(payload, { onConflict: 'figma_user_id' });
		if (error) console.warn('[Entitlement] Supabase upsert error (lifetime):', error.message);
	} catch (e) {
		console.warn('[Entitlement] Supabase lifetime exception:', e);
	}
}

async function recordRefund(resource) {
	console.log('[Refund] Capture refunded:', {
		id: resource?.id,
		amount: resource?.amount?.value + ' ' + resource?.amount?.currency_code,
		invoiceId: resource?.invoice_id
	});
}
