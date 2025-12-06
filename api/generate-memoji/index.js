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
  const { prompt, size, background, model, familyType, gesture, hair, skinTone, headshot } = body;

  // Allow either a direct prompt, compact option IDs, or headshot upload
  const hasCompact = familyType || gesture || hair || skinTone || Array.isArray(body.accessories) || body.colorTheme;
  const hasHeadshot = headshot && typeof headshot === 'string' && headshot.length > 0;
  
  if ((!prompt || typeof prompt !== 'string') && !hasCompact && !hasHeadshot) {
    return { valid: false, error: 'Either prompt, compact option IDs, or headshot is required.' };
  }

  if (prompt && prompt.length > 1000) {
    return { valid: false, error: 'Prompt is too long (max 1000 characters).' };
  }

  if (headshot && typeof headshot === 'string' && headshot.length > 10 * 1024 * 1024) { // 10MB base64 limit
    return { valid: false, error: 'Headshot image is too large (max 10MB).' };
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

/**
 * Analyze headshot image using OpenAI Vision API to extract facial features
 * @param {string} headshotBase64 - Base64 encoded image (without data URL prefix)
 * @returns {Promise<Object>} Extracted facial features
 */
async function analyzeHeadshot(headshotBase64) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Use GPT-4o for vision capabilities
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this headshot photo in extreme detail and extract ALL facial features, expressions, and characteristics in JSON format. Pay special attention to facial expressions, emotions, and micro-expressions:

{
  "estimatedAge": "number (e.g., 25, 35, 45)",
  "gender": "male or female",
  "skinTone": "light, medium-light, medium, medium-dark, or dark",
  "hairColor": "black, brown, blonde, red, gray, or other",
  "hairStyle": "short, long, curly, straight, wavy, bald, ponytail, bun, or other",
  "hairLength": "short, medium, or long",
  "facialStructure": "round, oval, square, heart, or diamond",
  "eyeColor": "brown, blue, green, hazel, or other",
  "hasGlasses": true or false,
  "hasBeard": true or false,
  "hasMustache": true or false,
  "ethnicity": "general description if identifiable",
  "facialExpression": {
    "smileIntensity": "none, subtle, moderate, wide, or beaming",
    "smileType": "closed-lip, open-lip, or teeth-showing",
    "hasDimples": true or false,
    "eyeExpression": "wide-open, slightly-closed, squinting, or relaxed",
    "eyeShape": "almond, round, narrow, or other",
    "eyebrowPosition": "raised, neutral, lowered, or furrowed",
    "eyebrowShape": "straight, arched, curved, or thick",
    "eyeCrinkles": true or false,
    "lipCurvature": "upward, neutral, or downward",
    "lipFullness": "thin, medium, or full"
  },
  "emotionalState": {
    "primaryEmotion": "joyful, calm, energetic, serene, friendly, confident, or other",
    "energyLevel": "low, moderate, or high",
    "warmthLevel": "warm, neutral, or cool",
    "expressionIntensity": "mild, moderate, or strong"
  },
  "facialDetails": {
    "noseShape": "small, medium, large, narrow, or wide",
    "cheekProminence": "high, medium, or low",
    "jawline": "sharp, rounded, or soft",
    "headPosition": "straight, tilted-left, tilted-right, or looking-up/down"
  }
}

Be extremely specific and accurate. Analyze the exact facial expression, emotion, and micro-details visible in the photo. If you cannot determine a feature, use "unknown" or a reasonable default based on what you can see.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${headshotBase64}`
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 1000
    });

    const analysisText = response.choices[0].message.content;
    const analysis = JSON.parse(analysisText);
    
    console.log('Headshot analysis result:', analysis);
    
    return analysis;
  } catch (error) {
    console.error('Error analyzing headshot:', error);
    throw new Error(`Failed to analyze headshot: ${error.message}`);
  }
}

/**
 * Map analyzed features to memoji generation parameters
 * @param {Object} analysis - Facial features from Vision API
 * @returns {Object} Mapped parameters for memoji generation
 */
function mapFeaturesToMemojiParams(analysis) {
  // Map gender and age to familyType
  let familyType = 'father'; // default
  if (analysis.gender === 'female') {
    if (analysis.estimatedAge && analysis.estimatedAge < 18) {
      familyType = 'young-daughter';
    } else if (analysis.estimatedAge && analysis.estimatedAge > 60) {
      familyType = 'grandmother';
    } else {
      familyType = 'mother';
    }
  } else if (analysis.gender === 'male') {
    if (analysis.estimatedAge && analysis.estimatedAge < 18) {
      familyType = 'young-son';
    } else if (analysis.estimatedAge && analysis.estimatedAge > 60) {
      familyType = 'grandfather';
    } else {
      familyType = 'father';
    }
  }

  // Map skin tone
  const skinToneMap = {
    'light': 'light',
    'medium-light': 'medium-light',
    'medium': 'medium',
    'medium-dark': 'medium-dark',
    'dark': 'dark'
  };
  const skinTone = skinToneMap[analysis.skinTone?.toLowerCase()] || 'medium';

  // Map hair style
  const hairMap = {
    'short': 'short',
    'long': 'long',
    'curly': 'curly',
    'straight': 'long',
    'wavy': 'long',
    'bald': 'bald',
    'ponytail': 'ponytail',
    'bun': 'bun'
  };
  const hair = hairMap[analysis.hairStyle?.toLowerCase()] || analysis.hairLength?.toLowerCase() || 'short';

  return {
    familyType,
    skinTone,
    hair,
    hasGlasses: analysis.hasGlasses || false,
    hasBeard: analysis.hasBeard || false,
    hasMustache: analysis.hasMustache || false,
    analysis // Keep full analysis for prompt building
  };
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

  // Handle headshot upload - analyze image and extract features
  let headshotAnalysis = null;
  let headshotParams = null;
  
  if (req.body.headshot) {
    try {
      console.log('Headshot provided, analyzing with Vision API...');
      headshotAnalysis = await analyzeHeadshot(req.body.headshot);
      headshotParams = mapFeaturesToMemojiParams(headshotAnalysis);
      
      // Override familyType and skinTone from headshot analysis
      req.body.familyType = headshotParams.familyType;
      req.body.skinTone = headshotParams.skinTone;
      req.body.hair = headshotParams.hair;
      
      // Add glasses to accessories if detected
      if (headshotParams.hasGlasses && (!req.body.accessories || !Array.isArray(req.body.accessories))) {
        req.body.accessories = ['glasses'];
      } else if (headshotParams.hasGlasses && !req.body.accessories.includes('glasses')) {
        req.body.accessories.push('glasses');
      }
      
      console.log('Headshot analysis complete:', {
        familyType: headshotParams.familyType,
        skinTone: headshotParams.skinTone,
        hair: headshotParams.hair
      });
    } catch (error) {
      console.error('Headshot analysis failed:', error);
      return res.status(400).json({ 
        error: { 
          message: `Failed to analyze headshot: ${error.message}` 
        } 
      });
    }
  }

  // If prompt not provided, rebuild from compact IDs server-side (or headshot analysis)
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
      
      // Build enhanced prompt with detailed facial expression matching
      let promptEnhancement = '';
      let expressionDetails = '';
      let emotionalDetails = '';
      
      if (headshotAnalysis) {
        // Age and facial structure
        const ageDesc = headshotAnalysis.estimatedAge ? `approximately ${headshotAnalysis.estimatedAge} years old` : '';
        const facialDesc = headshotAnalysis.facialStructure ? `with a ${headshotAnalysis.facialStructure} face shape` : '';
        promptEnhancement = `${ageDesc} ${facialDesc}`.trim();
        if (promptEnhancement) {
          promptEnhancement = `, ${promptEnhancement}`;
        }
        
        // Detailed facial expression description
        if (headshotAnalysis.facialExpression) {
          const expr = headshotAnalysis.facialExpression;
          const expressionParts = [];
          
          // Smile description
          if (expr.smileIntensity && expr.smileIntensity !== 'none') {
            let smileDesc = '';
            if (expr.smileIntensity === 'beaming' || expr.smileIntensity === 'wide') {
              smileDesc = `a ${expr.smileIntensity} smile`;
            } else if (expr.smileIntensity === 'moderate') {
              smileDesc = `a warm, ${expr.smileIntensity} smile`;
            } else {
              smileDesc = `a ${expr.smileIntensity} smile`;
            }
            
            if (expr.hasDimples) {
              smileDesc += ' with visible dimples';
            }
            if (expr.smileType === 'teeth-showing') {
              smileDesc += ' showing teeth';
            }
            expressionParts.push(smileDesc);
          }
          
          // Eye description
          if (expr.eyeExpression) {
            let eyeDesc = '';
            if (expr.eyeExpression === 'wide-open') {
              eyeDesc = 'bright, wide-open eyes';
            } else if (expr.eyeExpression === 'slightly-closed') {
              eyeDesc = 'eyes slightly closed';
            } else if (expr.eyeExpression === 'squinting') {
              eyeDesc = 'squinting eyes';
            } else {
              eyeDesc = 'relaxed eyes';
            }
            
            if (expr.eyeShape) {
              eyeDesc += ` with ${expr.eyeShape} shape`;
            }
            if (expr.eyeCrinkles) {
              eyeDesc += ' crinkled at the corners';
            }
            expressionParts.push(eyeDesc);
          }
          
          // Eyebrow description
          if (expr.eyebrowPosition && expr.eyebrowPosition !== 'neutral') {
            expressionParts.push(`${expr.eyebrowPosition} eyebrows`);
          }
          
          if (expressionParts.length > 0) {
            expressionDetails = `with ${expressionParts.join(', ')}`;
          }
        }
        
        // Emotional state description
        if (headshotAnalysis.emotionalState) {
          const emo = headshotAnalysis.emotionalState;
          const emotionParts = [];
          
          if (emo.primaryEmotion) {
            emotionParts.push(emo.primaryEmotion);
          }
          if (emo.energyLevel && emo.energyLevel !== 'moderate') {
            emotionParts.push(emo.energyLevel + ' energy');
          }
          if (emo.warmthLevel && emo.warmthLevel === 'warm') {
            emotionParts.push('warm');
          }
          
          if (emotionParts.length > 0) {
            emotionalDetails = `, conveying ${emotionParts.join(', ')}`;
          }
        }
      }
      
      // Build the comprehensive prompt
      const basePrompt = `A premium 3D Memoji-style avatar of a ${ft}${promptEnhancement} with ${h} ${headshotAnalysis?.hairColor || ''} hair and ${skin} skin tone.`;
      const expressionPrompt = expressionDetails ? ` ${expressionDetails}` : '';
      const emotionPrompt = emotionalDetails || '';
      const matchingPrompt = headshotAnalysis ? `, using the provided reference photo to match the exact facial expression, emotion, and feel - preserving the same smile intensity, eye expression, eyebrow position, facial structure, and overall demeanor. Transform the reference photo into a premium 3D Memoji-style avatar while maintaining all facial features and expressions` : '';
      
      req.body.prompt = `${basePrompt}${expressionPrompt}${emotionPrompt} Include head, shoulders, and hands with a ${g} gesture. ${clothing}. ${acc}. ${bg} Soft rounded shapes, glossy textures, minimal modern style.${matchingPrompt}.`.trim();
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

  // Enforce credits BEFORE cache check to prevent credit bypass
  if (userId && subscriptionTier) {
    try {
      const userCredits = await getUserCredits(userId, subscriptionTier);
      
      if (userCredits.credits_remaining <= 0) {
        return res.status(402).json({
          error: { code: 'OUT_OF_CREDITS', message: 'You are out of credits. Please wait for monthly renewal.' },
          remaining: 0
        });
      }

      // Debit 1 credit per generation (regardless of cache hit/miss)
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
      return res.status(500).json({ error: { message: 'Credit system error. Please try again.' } });
    }
  }

  // Check cache AFTER credit enforcement
  // Note: Headshot-based generations are not cached to ensure uniqueness
  if (!req.body.headshot) {
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
        
        // Return cached result (credits already consumed)
        return res.status(200).json({
          success: true,
          imageUrl: cachedMemoji.image_url,
          cached: true,
          costSaved: cachedMemoji.generation_cost,
          cacheId: cachedMemoji.id,
          creditsConsumed: true // Indicate credits were consumed
        });
      }
      
      console.log('Cache miss - proceeding with OpenAI generation');
    } catch (cacheError) {
      console.error('Cache check failed, proceeding with generation:', cacheError);
      // Continue with normal generation if cache fails
    }
  } else {
    console.log('Headshot provided - skipping cache (headshot-based generations are unique)');
  }

  // Credits already enforced above - proceed with generation
  // Remove anonymous device-based free path (auth is now required)

  // Structured logging
  console.log('Request details:', {
    ip: clientIP,
    clientVersion: authResult.clientVersion,
    promptLength: prompt?.length || 0,
    size,
    background,
    model: model || "gpt-image-1",
    hasHeadshot: !!req.body.headshot,
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
      
      // Note: gpt-image-1 doesn't support reference images directly in the generate endpoint
      // We rely on the enhanced prompt with detailed facial expression analysis for matching
      if (req.body.headshot) {
        console.log('Using enhanced prompt with detailed facial expression analysis for headshot matching');
      }
    } else if (selectedModel === "dall-e-3") {
      generationParams.size = size || "1024x1024";
      generationParams.quality = "hd";
      generationParams.style = "vivid";
      // Note: DALL-E 3 doesn't support reference images directly in generate endpoint
      // The enhanced prompt with detailed analysis should help with matching
    } else if (selectedModel === "dall-e-2") {
      generationParams.size = size || "1024x1024";
      // Note: DALL-E 2 doesn't support reference images directly in generate endpoint
      // The enhanced prompt with detailed analysis should help with matching
    }

    console.log('Generating image with model:', selectedModel, 'Parameters:', {
      ...generationParams,
      prompt: generationParams.prompt?.substring(0, 200) + '...' // Truncate prompt in logs
    });
    
    const image = await openai.images.generate(generationParams);

    // Store in cache for future use (skip caching for headshot-based generations)
    if (!req.body.headshot) {
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
    } else {
      console.log('Skipping cache for headshot-based generation');
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
