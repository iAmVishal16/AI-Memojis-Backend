// Local proxy to the deployed backend, adding permissive CORS for local web testing
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;
const TARGET = process.env.REMOTE_BACKEND || 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app';

app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true, proxy: true, target: TARGET });
});

// Generic proxy helper
async function proxyRequest(req, res, path) {
  try {
    const url = `${TARGET}${path}${req._parsedUrl.search || ''}`;
    const init = {
      method: req.method,
      headers: { 'Content-Type': 'application/json', ...req.headers },
      body: req.method === 'GET' || req.method === 'HEAD' ? undefined : JSON.stringify(req.body || {})
    };
    // Remove host header to avoid mismatch
    delete init.headers.host;
    const r = await fetch(url, init);
    const text = await r.text();
    res.status(r.status);
    // Try to pass JSON if possible
    try {
      res.set('Content-Type', 'application/json');
      res.send(JSON.parse(text));
    } catch {
      res.send(text);
    }
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Proxy error' });
  }
}

// PhonePe endpoints - Mock for testing
app.options('/api/phonepe/checkout', (req, res) => res.status(200).end());
app.get('/api/phonepe/checkout', (req, res) => {
  res.status(200).json({ ok: true, message: 'PhonePe checkout expects POST. This is a mock GET responder.' });
});
app.post('/api/phonepe/checkout', (req, res) => {
  console.log('PhonePe checkout request:', req.body);
  const { userId, plan, returnUrl, cancelUrl } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const orderId = `test-${Date.now()}`;
  // Mock: immediately "approve" and redirect back to app's returnUrl
  const fallbackReturn = `${req.headers.origin || 'http://localhost:8081'}/?purchase=success&provider=phonepe&plan=${encodeURIComponent(plan || 'lifetime')}&orderId=${encodeURIComponent(orderId)}`;
  const redirectUrl = returnUrl || fallbackReturn;
  res.json({ ok: true, redirectUrl, orderId });
});

app.options('/api/phonepe/webhook', (req, res) => res.status(200).end());
app.post('/api/phonepe/webhook', (req, res) => {
  console.log('PhonePe webhook:', req.body);
  res.json({ ok: true });
});

app.get('/api/phonepe/status', (req, res) => {
  const { userId } = req.query;
  console.log('PhonePe status check for:', userId);
  // Mock: return false for now (no entitlement)
  res.json({ ok: false });
});

// Generate Memoji - Mock endpoint for testing (HMAC signature issue needs debugging)
app.options('/api/generate-memoji', (req, res) => res.status(200).end());
app.post('/api/generate-memoji', (req, res) => {
  console.log('Generate memoji request:', req.body);
  
  // Use the actual user prompt from the request
  const userPrompt = req.body.prompt || 'default memoji';
  console.log('User prompt:', userPrompt);
  
  // Mock response with a sample base64 image
  const mockBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  res.json({
    data: [{
      b64_json: mockBase64
    }]
  });
});

// Entitlement
app.options('/api/entitlement/check', (req, res) => res.status(200).end());
app.post('/api/entitlement/check', (req, res) => proxyRequest(req, res, '/api/entitlement/check'));

// Checkout (PayPal—kept for compatibility)
app.get('/api/checkout', (req, res) => proxyRequest(req, res, '/api/checkout'));

app.listen(PORT, () => {
  console.log(`Local proxy listening on http://localhost:${PORT} → ${TARGET}`);
});


