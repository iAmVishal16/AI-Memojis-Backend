// Diagnostic: Show masked PayPal config (do not expose full secrets)
export default async function handler(req, res) {
	const env = process.env.PAYPAL_ENV || 'sandbox';
	const clientId = process.env.PAYPAL_CLIENT_ID || '';
	const secret = process.env.PAYPAL_SECRET || '';
	const webhookId = process.env.PAYPAL_WEBHOOK_ID || '';
	function mask(v){ if(!v) return ''; const s=String(v); if(s.length<=8) return s[0]+"***"+s[s.length-1]; return s.slice(0,4)+"***"+s.slice(-4);} 
	return res.status(200).json({
		env,
		base: env==='live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
		clientIdMasked: mask(clientId),
		secretMasked: mask(secret),
		webhookIdMasked: mask(webhookId)
	});
}
