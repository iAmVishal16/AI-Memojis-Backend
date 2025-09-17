// POST /api/sign
// Input: { body: object, timestamp?: number }
// Output: { timestamp, signature }
// Signs message `${timestamp}.${JSON.stringify(body)}` using BACKEND_SECRET

import crypto from 'crypto'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } })

  const secret = process.env.BACKEND_SECRET
  if (!secret) return res.status(500).json({ error: { message: 'Server secret not configured' } })

  try {
    const { body } = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: { message: 'body object is required' } })
    }
    // Lightweight allow-list (optional): ensure only expected fields can be signed
    const allowedKeys = ['model','size','background','prompt','familyType','gesture','hair','skinTone','accessories','colorTheme','userId','subscriptionTier','deviceId']
    const sanitized = {}
    for (const k of Object.keys(body)) {
      if (allowedKeys.includes(k)) sanitized[k] = body[k]
    }
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const payload = JSON.stringify(sanitized)
    const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${payload}`).digest('hex')
    return res.status(200).json({ timestamp, signature })
  } catch (e) {
    return res.status(500).json({ error: { message: 'Internal error' } })
  }
}


