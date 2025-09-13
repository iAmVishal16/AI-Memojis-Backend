export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    checks: {
      openai: !!process.env.OPENAI_API_KEY,
      backend_secret: !!process.env.BACKEND_SECRET
    }
  };

  // Check if all required environment variables are present
  const allChecksPass = Object.values(health.checks).every(check => check === true);
  
  if (!allChecksPass) {
    health.status = 'unhealthy';
    return res.status(503).json(health);
  }

  res.status(200).json(health);
}