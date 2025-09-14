// PhonePe Standard Checkout - Create Payment Session (Supports both Sandbox and Production)
// Docs: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const {
      PHONEPE_CLIENT_ID,
      PHONEPE_CLIENT_SECRET,
      PHONEPE_CLIENT_VERSION = '1.0',
      PHONEPE_ENVIRONMENT = 'sandbox', // 'sandbox' or 'production'
      FRONTEND_URL = 'https://aimemojis.com',
    } = process.env;

    if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
      res.status(500).json({ error: 'PhonePe client credentials missing' });
      return;
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { userId, plan = 'lifetime' } = body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Determine API endpoints based on environment
    const isProduction = PHONEPE_ENVIRONMENT === 'production';
    const baseUrl = isProduction 
      ? 'https://api.phonepe.com/apis/pg/v1' 
      : 'https://api-preprod.phonepe.com/apis/pgsandbox/pg/v1';

    console.log(`🔧 PhonePe Environment: ${PHONEPE_ENVIRONMENT}`);
    console.log(`🔧 Base URL: ${baseUrl}`);
    console.log(`🔧 Client ID: ${PHONEPE_CLIENT_ID}`);
    console.log(`🔧 Client Secret Length: ${PHONEPE_CLIENT_SECRET ? PHONEPE_CLIENT_SECRET.length : 0}`);
    console.log(`🔧 Client Version: ${PHONEPE_CLIENT_VERSION}`);

    // Amount in paise (INR) - use real amounts for production, test amounts for sandbox
    const amountPaise = isProduction 
      ? (plan === 'monthly' ? 99900 : 999900) // Real amounts: ₹999 or ₹9999
      : (plan === 'monthly' ? 99900 : 499900); // Test amounts: ₹999 or ₹4999

    // 1) Get OAuth token - FIXED FORMAT
    const authUrl = `${baseUrl}/oauth/token`;
    const authResp = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: PHONEPE_CLIENT_ID,
        client_version: PHONEPE_CLIENT_VERSION,
        client_secret: PHONEPE_CLIENT_SECRET,
        grant_type: 'client_credentials',
      })
    });

    const authJson = await authResp.json().catch(() => ({}));
    if (!authResp.ok || !authJson?.access_token) {
      console.error('PhonePe Auth Error:', {
        status: authResp.status,
        statusText: authResp.statusText,
        response: authJson,
        url: authUrl,
        clientId: PHONEPE_CLIENT_ID,
        environment: PHONEPE_ENVIRONMENT,
        baseUrl: baseUrl,
      });
      res.status(400).json({ 
        error: 'PhonePe auth failed', 
        details: authJson,
        status: authResp.status,
        statusText: authResp.statusText,
        debug: {
          environment: PHONEPE_ENVIRONMENT,
          baseUrl: baseUrl,
          hasClientId: !!PHONEPE_CLIENT_ID,
          hasClientSecret: !!PHONEPE_CLIENT_SECRET,
          clientVersion: PHONEPE_CLIENT_VERSION,
        }
      });
      return;
    }

    const accessToken = authJson.access_token;

    // 2) Create payment (Standard Checkout) - FIXED PAYLOAD
    const orderId = `aim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const returnUrl = `${FRONTEND_URL}/?purchase=success&provider=phonepe&plan=${encodeURIComponent(plan)}&orderId=${encodeURIComponent(orderId)}`;
    const cancelUrl = `${FRONTEND_URL}/?purchase=cancel&provider=phonepe&plan=${encodeURIComponent(plan)}&orderId=${encodeURIComponent(orderId)}`;

    const payUrl = `${baseUrl}/pay`;
    const payPayload = {
      merchantId: PHONEPE_CLIENT_ID,
      merchantTransactionId: orderId,
      merchantUserId: String(userId),
      amount: amountPaise,
      redirectUrl: returnUrl,
      redirectMode: 'POST',
      callbackUrl: `${FRONTEND_URL}/api/phonepe/webhook`,
      mobileNumber: '9999999999', // Required for sandbox
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const payResp = await fetch(payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-VERIFY': 'sha256',
      },
      body: JSON.stringify(payPayload)
    });

    const payJson = await payResp.json().catch(() => ({}));
    if (!payResp.ok) {
      console.error('PhonePe Payment Error:', {
        status: payResp.status,
        statusText: payResp.statusText,
        response: payJson
      });
      res.status(502).json({ 
        error: 'PhonePe create payment failed', 
        details: payJson,
        status: payResp.status,
        statusText: payResp.statusText
      });
      return;
    }

    const redirectUrl = payJson?.data?.instrumentResponse?.redirectInfo?.url;
    if (!redirectUrl) {
      res.status(502).json({ error: 'No redirect URL from PhonePe', details: payJson });
      return;
    }

    res.status(200).json({ ok: true, redirectUrl, orderId });
  } catch (error) {
    console.error('PhonePe Integration Error:', error);
    res.status(500).json({ error: error?.message || 'Internal error' });
  }
}


