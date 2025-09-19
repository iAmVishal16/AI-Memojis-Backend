import { OpenAI } from 'openai';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { getUserCredits, debitCredit } from '../credits/index.js';
import { 
  generatePromptHash, 
  checkMemojiCache, 
  storeInCache, 
  updateCacheUsage,
  uploadToStorage 
} from '../cache/utils.js';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Rate limiting store (in-memory for simplicity, use Redis in production)
const rateLimitStore = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 requests per minute per IP
const RATE_LIMIT_BURST = 5; // Allow 5 burst requests

function safeTimingEqual(a, b) {
  const aBuf = Buffer.from(a || '', 'utf8');
  const bBuf = Buffer.from(b || '', 'utf8');
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function verifyHMACSignature(req) {
  const secret = process.env.BACKEND_SECRET;
  const timestamp = req.headers['x-timestamp'];
  const signature = req.headers['x-signature'];
  const clientVersion = req.headers['x-client-version'];

  if (!secret) {
    console.error('BACKEND_SECRET is not set.');
    return { valid: false, error: 'Server configuration error: secret missing.' };
  }

  if (!timestamp || !signature) {
    return { valid: false, error: 'Missing authentication headers.' };
  }

  // Check replay window (5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const tsNum = Number(timestamp);
  if (!tsNum || Math.abs(now - tsNum) > 300) {
    return { valid: false, error: 'Invalid or expired timestamp.' };
  }

  // Compute expected signature
  // Note: req.body is already parsed by Vercel, so we need to stringify it consistently
  const rawBody = JSON.stringify(req.body || {});
  const expectedSig = crypto.createHmac('sha256', secret)
    .update(timestamp + '.' + rawBody)
    .digest('hex');

  // Debug logging
  console.log('Auth debug:', {
    timestamp,
    signature,
    expectedSig,
    rawBody,
    message: timestamp + '.' + rawBody
  });

  if (!safeTimingEqual(signature, expectedSig)) {
    return { valid: false, error: 'Invalid signature.' };
  }

  return { valid: true, clientVersion };
}

function checkRateLimit(ip) {
  const now = Date.now();
  const key = `rate_limit_${ip}`;
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  const record = rateLimitStore.get(key);
  
  // Reset window if expired
  if (now - record.windowStart > RATE_LIMIT_WINDOW) {
    record.count = 1;
    record.windowStart = now;
    rateLimitStore.set(key, record);
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  // Check burst limit
  if (record.count >= RATE_LIMIT_BURST && now - record.windowStart < 10000) { // 10 seconds burst window
    return { allowed: false, remaining: 0, resetTime: record.windowStart + RATE_LIMIT_WINDOW };
  }

  // Check regular limit
  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, remaining: 0, resetTime: record.windowStart + RATE_LIMIT_WINDOW };
  }

  record.count++;
  rateLimitStore.set(key, record);
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

function validateRequestBody(body) {
  const { prompt, size, background, model, familyType, gesture, hair, skinTone } = body;

  // Allow either a direct prompt or compact option IDs that we will rebuild server-side
  const hasCompact = familyType || gesture || hair || skinTone || Array.isArray(body.accessories) || body.colorTheme;
  if ((!prompt || typeof prompt !== 'string') && !hasCompact) {
    return { valid: false, error: 'Either prompt or compact option IDs are required.' };
  }

  if (prompt.length > 1000) {
    return { valid: false, error: 'Prompt is too long (max 1000 characters).' };
  }

  if (size && !['1024x1024', '1024x1536', '1536x1024'].includes(size)) {
    return { valid: false, error: 'Invalid size parameter.' };
  }

  if (background && !['auto', 'transparent'].includes(background)) {
    return { valid: false, error: 'Invalid background parameter.' };
  }

  if (model && !['gpt-image-1', 'dall-e-3', 'dall-e-2'].includes(model)) {
    return { valid: false, error: 'Invalid model parameter.' };
  }

  return { valid: true };
}

export default async function handler(req, res) {
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Signature, X-Timestamp, X-Client-Version, X-Device-Id');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  // Check rate limiting
  const rateLimitResult = checkRateLimit(clientIP);
  if (!rateLimitResult.allowed) {
    console.warn(`Rate limit exceeded for IP: ${clientIP}`);
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimitResult.resetTime);
    return res.status(429).json({ error: { message: 'Rate limit exceeded. Please try again later.' } });
  }

  // Verify HMAC signature
  const authResult = verifyHMACSignature(req);
  if (!authResult.valid) {
    console.warn(`Authentication failed for IP: ${clientIP}, Error: ${authResult.error}`);
    return res.status(401).json({ error: { message: 'Unauthorized' } });
  }

  // If prompt not provided, rebuild from compact IDs server-side
  if (!req.body.prompt) {
    try {
      const { familyType, gesture, hair, skinTone, accessories, colorTheme, background } = req.body || {};
      const ft = (familyType || 'father');
      const g = (gesture || 'wave').replace(/_/g, '-');
      const h = (hair || 'short');
      const skin = (skinTone || 'light');
      const acc = Array.isArray(accessories) && accessories.length ? `wearing ${accessories[0]}` : '';
      const clothing = colorTheme === 'warm-pink' ? 'soft pastel sweater' : 'casual pastel shirt';
      const bg = (background === 'transparent' || colorTheme === 'transparent') ? '' : 'Pastel circular background.';
      req.body.prompt = `A premium 3D Memoji-style avatar of a ${ft} with ${h} and ${skin} skin tone. Include head, shoulders, and hands with a ${g} gesture. ${clothing}. ${acc}. ${bg} Soft rounded shapes, glossy textures, minimal modern style. Cheerful happy face with warm eyes.`.trim();
    } catch (e) {
      console.warn('Failed to rebuild prompt from compact IDs', e);
    }
  }

  // Validate request body
  const validationResult = validateRequestBody(req.body);
  if (!validationResult.valid) {
    console.warn(`Invalid request body from IP: ${clientIP}, Error: ${validationResult.error}`);
    return res.status(400).json({ error: { message: validationResult.error } });
  }

  const { prompt, size, background, model, userId, subscriptionTier } = req.body;
  const deviceId = (req.headers['x-device-id'] || req.body?.deviceId || '').toString().slice(0,128);

  // Require authentication for any generation
  if (!userId) {
    return res.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in required to generate memojis.' } });
  }

  // Check cache first - before any credit enforcement
  try {
    const cacheConfig = {
      model: model || 'gpt-image-1',
      size: size || '1024x1024',
      familyType: req.body.familyType || 'father',
      gesture: req.body.gesture || 'wave',
      hair: req.body.hair || 'short',
      skinTone: req.body.skinTone || 'medium',
      accessories: req.body.accessories || [],
      colorTheme: req.body.colorTheme || 'pastel-blue',
      background: background || 'auto'
    };
    
    const promptHash = generatePromptHash(cacheConfig);
    console.log('Checking cache for hash:', promptHash);
    
    const cachedMemoji = await checkMemojiCache(promptHash);
    if (cachedMemoji) {
      console.log('Cache hit! Returning cached memoji:', cachedMemoji.id);
      
      // Update usage statistics
      await updateCacheUsage(promptHash);
      
      // Return cached result without consuming credits
      return res.status(200).json({
        success: true,
        imageUrl: cachedMemoji.image_url,
        cached: true,
        costSaved: cachedMemoji.generation_cost,
        cacheId: cachedMemoji.id
      });
    }
    
    console.log('Cache miss - proceeding with OpenAI generation');
  } catch (cacheError) {
    console.error('Cache check failed, proceeding with generation:', cacheError);
    // Continue with normal generation if cache fails
  }

  // Enforce credits before generation (persistent storage)
  if (userId && subscriptionTier) {
    try {
      const userCredits = await getUserCredits(userId, subscriptionTier);
      
      if (userCredits.credits_remaining <= 0) {
        return res.status(402).json({
          error: { code: 'OUT_OF_CREDITS', message: 'You are out of credits. Please wait for monthly renewal.' },
          remaining: 0
        });
      }

      // Debit 1 credit per generation
      const debitSuccess = await debitCredit(userId, subscriptionTier);
      if (!debitSuccess) {
        return res.status(402).json({
          error: { code: 'OUT_OF_CREDITS', message: 'Failed to debit credit. Please try again.' },
          remaining: 0
        });
      }

      // Get updated credits for response header
      const updatedCredits = await getUserCredits(userId, subscriptionTier);
      res.setHeader('X-Credits-Remaining', String(updatedCredits.credits_remaining));
    } catch (e) {
      console.warn('Credit enforcement error', e);
      // Continue without credit enforcement if database is down
    }
  }
  // Remove anonymous device-based free path (auth is now required)

  // Structured logging
  console.log('Request details:', {
    ip: clientIP,
    clientVersion: authResult.clientVersion,
    promptLength: prompt.length,
    size,
    background,
    model: model || "gpt-image-1",
    timestamp: new Date().toISOString()
  });

  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set.');
    return res.status(500).json({ error: { message: 'Server configuration error: OpenAI API key missing.' } });
  }

  try {
    // Determine the model to use (default to gpt-image-1)
    const selectedModel = model || "gpt-image-1";
    
    // Prepare the generation parameters based on the model
    const generationParams = {
      model: selectedModel,
      prompt: prompt,
      n: 1,
    };

    // Add model-specific parameters
    if (selectedModel === "gpt-image-1") {
      generationParams.size = size || "1024x1024";
      generationParams.quality = "high";
      generationParams.background = background || "auto";
      generationParams.output_format = "png";
    } else if (selectedModel === "dall-e-3") {
      generationParams.size = size || "1024x1024";
      generationParams.quality = "hd";
      generationParams.style = "vivid";
    } else if (selectedModel === "dall-e-2") {
      generationParams.size = size || "1024x1024";
    }

    console.log('Generating image with model:', selectedModel, 'Parameters:', generationParams);
    
    const image = await openai.images.generate(generationParams);

    // Store in cache for future use
    try {
      const cacheConfig = {
        model: selectedModel,
        size: size || '1024x1024',
        familyType: req.body.familyType || 'father',
        gesture: req.body.gesture || 'wave',
        hair: req.body.hair || 'short',
        skinTone: req.body.skinTone || 'medium',
        accessories: req.body.accessories || [],
        colorTheme: req.body.colorTheme || 'pastel-blue',
        background: background || 'auto'
      };
      
      const promptHash = generatePromptHash(cacheConfig);
      
      // Upload image to Supabase Storage
      const imageUrl = await uploadToStorage(image.data[0].b64_json, promptHash);
      
      // Store in cache
      await storeInCache({
        promptHash,
        imageUrl,
        config: cacheConfig,
        cost: 0.02 // Estimated cost per generation
      });
      
      console.log('Memoji cached successfully:', promptHash);
    } catch (cacheError) {
      console.error('Failed to cache memoji:', cacheError);
      // Continue with response even if caching fails
    }

    // Add rate limit headers to successful response
    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining);

    res.json({
      data: image.data,
      usage: {
        freeGenerationsRemaining: -1 // Pro user
      }
    });

  } catch (error) {
    console.error('Error generating image:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      stack: error.stack,
      ip: clientIP,
      timestamp: new Date().toISOString()
    });
    
    let errorMessage = 'Internal server error during image generation.';
    if (error.response && error.response.data) {
      errorMessage = error.response.data.error.message || errorMessage;
    } else if (error.message) {
      errorMessage = error.message;
    }
    res.status(500).json({ error: { message: errorMessage } });
  }
}
