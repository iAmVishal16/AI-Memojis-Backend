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

// PhonePe endpoints - Proxy to real PhonePe API
app.options('/api/phonepe/checkout', (req, res) => res.status(200).end());
app.get('/api/phonepe/checkout', (req, res) => {
  res.status(200).json({ ok: true, message: 'PhonePe checkout expects POST. This is a proxy GET responder.' });
});
app.post('/api/phonepe/checkout', (req, res) => {
  console.log('PhonePe checkout request:', req.body);
  const { userId, plan, returnUrl, cancelUrl } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  const orderId = `test-${Date.now()}`;
  // Mock: return a mock PhonePe payment page URL for testing
  const mockPaymentUrl = `http://localhost:${PORT}/mock-phonepe-payment?orderId=${orderId}&plan=${encodeURIComponent(plan || 'lifetime')}&returnUrl=${encodeURIComponent(returnUrl)}&cancelUrl=${encodeURIComponent(cancelUrl)}`;
  res.json({ ok: true, redirectUrl: mockPaymentUrl, orderId });
});

app.options('/api/phonepe/webhook', (req, res) => res.status(200).end());
app.post('/api/phonepe/webhook', (req, res) => {
  console.log('PhonePe webhook:', req.body);
  // Proxy to the real PhonePe webhook API
  proxyRequest(req, res, '/api/phonepe/webhook');
});

app.get('/api/phonepe/status', (req, res) => {
  const { userId } = req.query;
  console.log('PhonePe status check for:', userId);
  // Proxy to the real PhonePe status API
  proxyRequest(req, res, '/api/phonepe/status');
});

// Mock PhonePe Payment Page (for testing until real credentials are set up)
app.get('/mock-phonepe-payment', (req, res) => {
  const { orderId, plan, returnUrl, cancelUrl } = req.query;
  
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PhonePe Payment Gateway</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0; padding: 0; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh; display: flex; align-items: center; justify-content: center;
        }
        .payment-container { 
            background: white; border-radius: 20px; padding: 40px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); max-width: 400px; width: 90%;
        }
        .phonepe-logo { 
            text-align: center; margin-bottom: 30px;
        }
        .phonepe-logo h1 { 
            color: #5f259f; font-size: 28px; margin: 0; font-weight: bold;
        }
        .payment-details { 
            background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 30px;
        }
        .detail-row { 
            display: flex; justify-content: space-between; margin-bottom: 10px;
        }
        .detail-row:last-child { margin-bottom: 0; font-weight: bold; font-size: 18px; }
        .buttons { 
            display: flex; gap: 15px; margin-top: 20px;
        }
        .btn { 
            flex: 1; padding: 15px; border: none; border-radius: 10px; 
            font-size: 16px; font-weight: bold; cursor: pointer; transition: all 0.3s;
        }
        .btn-success { 
            background: #28a745; color: white;
        }
        .btn-success:hover { 
            background: #218838; transform: translateY(-2px);
        }
        .btn-danger { 
            background: #dc3545; color: white;
        }
        .btn-danger:hover { 
            background: #c82333; transform: translateY(-2px);
        }
        .status { 
            text-align: center; margin-bottom: 20px; padding: 15px; 
            background: #e3f2fd; border-radius: 10px; color: #1976d2;
        }
    </style>
</head>
<body>
    <div class="payment-container">
        <div class="phonepe-logo">
            <h1>PhonePe</h1>
        </div>
        
        <div class="status">
            🧪 <strong>Mock Payment Gateway</strong><br>
            <small>Real PhonePe requires proper test credentials</small>
        </div>
        
        <div class="payment-details">
            <div class="detail-row">
                <span>Order ID:</span>
                <span>${orderId}</span>
            </div>
            <div class="detail-row">
                <span>Plan:</span>
                <span>${plan}</span>
            </div>
            <div class="detail-row">
                <span>Amount:</span>
                <span>$${plan === 'monthly' ? '9.99' : '99.99'}</span>
            </div>
        </div>
        
        <div class="buttons">
            <button class="btn btn-success" onclick="processPayment('success')">
                ✅ Pay Now
            </button>
            <button class="btn btn-danger" onclick="processPayment('cancel')">
                ❌ Cancel
            </button>
        </div>
    </div>

    <script>
        function processPayment(action) {
            const returnUrl = action === 'success' ? '${returnUrl}' : '${cancelUrl}';
            
            // Add a small delay to simulate payment processing
            setTimeout(() => {
                window.location.href = returnUrl;
            }, 1000);
        }
        
        // Auto-redirect after 30 seconds for testing
        setTimeout(() => {
            if (confirm('Auto-processing payment for testing. Continue?')) {
                processPayment('success');
            }
        }, 30000);
    </script>
</body>
</html>`;
  
  res.send(html);
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


