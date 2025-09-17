// PhonePe Standard Checkout - Create Payment Session (Supports both Sandbox and Production)
// Docs: https://developer.phonepe.com/payment-gateway/website-integration/standard-checkout/api-integration/api-integration-website

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

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
    const { userId, plan = 'monthly_basic', amount } = body;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    // Map plan to pricing
    const planPricing = {
      'monthly_basic': { price: 9.99, credits: 100 },
      'monthly_standard': { price: 19.99, credits: 300 },
      'monthly_pro': { price: 49.99, credits: 1000 }
    };

    const selectedPlan = planPricing[plan] || planPricing['monthly_basic'];
    const amountInRupees = amount || selectedPlan.price;

    // Determine API endpoints based on environment
    const isProduction = PHONEPE_ENVIRONMENT === 'production';
    // In V2, OAuth lives at the API root, while pay/status live under /pg/v1
    const apiRoot = isProduction 
      ? 'https://api.phonepe.com/apis' 
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';

    console.log(`🔧 PhonePe Environment: ${PHONEPE_ENVIRONMENT}`);
    console.log(`🔧 API Root: ${apiRoot}`);
    console.log(`🔧 Client ID: ${PHONEPE_CLIENT_ID}`);
    console.log(`🔧 Client Secret Length: ${PHONEPE_CLIENT_SECRET ? PHONEPE_CLIENT_SECRET.length : 0}`);
    console.log(`🔧 Client Version: ${PHONEPE_CLIENT_VERSION}`);

    // Amount in paise (INR) - convert from USD to INR for PhonePe
    const usdToInrRate = 83; // Approximate USD to INR rate
    const amountInRupees = selectedPlan.price * usdToInrRate;
    const amountPaise = Math.round(amountInRupees * 100);

    // 1) Get OAuth token - try multiple V2-compatible paths to avoid mapping issues
    const authCandidates = (
      PHONEPE_ENVIRONMENT === 'sandbox'
        ? ['https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token']
        : ['https://api.phonepe.com/apis/pg/v1/oauth/token']
    );
    let accessToken = null;
    let lastAuthError = null;
    let triedUrls = [];
    for (const candidate of authCandidates) {
      triedUrls.push(candidate);
      try {
        // Try both snake_case and camelCase parameter formats
        const authBodies = [
          `client_id=${encodeURIComponent(PHONEPE_CLIENT_ID)}&client_version=${encodeURIComponent(PHONEPE_CLIENT_VERSION)}&client_secret=${encodeURIComponent(PHONEPE_CLIENT_SECRET)}&grant_type=client_credentials`,
        ];
        for (const body of authBodies) {
          const bodyString = typeof body === 'string' ? body : body.toString();
          const resp = await fetch(candidate, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: bodyString
          });
          const json = await resp.json().catch(() => ({}));
          if (resp.ok && json?.access_token) {
            accessToken = json.access_token;
            console.log(`✅ PhonePe Auth succeeded at: ${candidate}`);
            break;
          } else {
            lastAuthError = { status: resp.status, statusText: resp.statusText, response: json, url: candidate };
            console.warn('Auth attempt failed:', lastAuthError);
          }
        }
        if (accessToken) break;
      } catch (e) {
        lastAuthError = { error: e?.message || String(e), url: candidate };
        console.warn('Auth attempt threw:', lastAuthError);
      }
    }
    if (!accessToken) {
      res.status(400).json({
        error: 'PhonePe auth failed',
        details: lastAuthError,
        triedUrls,
        debug: {
          environment: PHONEPE_ENVIRONMENT,
          apiRoot: apiRoot,
          hasClientId: !!PHONEPE_CLIENT_ID,
          hasClientSecret: !!PHONEPE_CLIENT_SECRET,
          clientVersion: PHONEPE_CLIENT_VERSION,
        }
      });
      return;
    }
    

    // 2) Create payment (Standard Checkout) - FIXED PAYLOAD
    const orderId = `aim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const returnUrl = `${FRONTEND_URL}/?purchase=success&provider=phonepe&plan=${encodeURIComponent(plan)}&orderId=${encodeURIComponent(orderId)}`;

    // V2 Create Payment endpoint per docs:
    // Sandbox: https://api-preprod.phonepe.com/apis/pg-sandbox/checkout/v2/pay
    // Production: https://api.phonepe.com/apis/pg/checkout/v2/pay
    const payBase = isProduction
      ? 'https://api.phonepe.com/apis/pg'
      : 'https://api-preprod.phonepe.com/apis/pg-sandbox';
    const payUrl = `${payBase}/checkout/v2/pay`;

    const payPayload = {
      merchantOrderId: orderId,
      amount: amountPaise,
      paymentFlow: {
        type: 'PG_CHECKOUT',
        merchantUrls: {
          redirectUrl: returnUrl
        }
      }
    };

    // Persist order record for webhook reconciliation
    try {
      const supabase = getSupabase();
      const { error: orderErr } = await supabase
        .from('orders')
        .upsert({
          order_id: orderId,
          user_id: userId,
          plan: plan,
          amount_rupees: Math.round((amountInRupees + Number.EPSILON) * 100) / 100,
          status: 'created',
          provider: 'phonepe',
          updated_at: new Date().toISOString()
        }, { onConflict: 'order_id' });
      if (orderErr) {
        console.warn('Failed to persist order before checkout:', orderErr);
      }
    } catch (persistErr) {
      console.warn('Order persistence error:', persistErr);
    }

    const payResp = await fetch(payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `O-Bearer ${accessToken}`
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

    // V2 returns redirectUrl at the top level
    const redirectUrl = payJson?.redirectUrl;
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


