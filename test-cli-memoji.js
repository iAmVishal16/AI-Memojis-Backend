#!/usr/bin/env node

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// Configuration
const BACKEND_URL = 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/generate-memoji';
const BACKEND_SECRET = process.env.BACKEND_SECRET || 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';
const OUTPUT_DIR = './test-outputs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message, ...args) {
  console.log(`${colors[color]}${message}${colors.reset}`, ...args);
}

// Create output directory
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('green', `✅ Created output directory: ${OUTPUT_DIR}`);
  }
}

// Generate HMAC signature
function generateSignature(timestamp, body, secret) {
  const message = timestamp + '.' + body;
  return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

// Save base64 image to file
function saveImage(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  log('green', `📸 Saved image: ${filepath}`);
  return filepath;
}

// Test memoji generation with different parameters
async function testMemojiGeneration(testName, prompt, size = '1024x1024', background = 'auto') {
  log('cyan', `\n🎨 Testing: ${testName}`);
  log('cyan', '='.repeat(50));
  
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = JSON.stringify({ prompt, size, background });
  const signature = generateSignature(timestamp, body, BACKEND_SECRET);
  
  log('blue', 'Request Details:');
  log('blue', `- Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
  log('blue', `- Size: ${size}`);
  log('blue', `- Background: ${background}`);
  log('blue', `- Timestamp: ${timestamp}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Client-Version': '1.0.0'
      },
      body: body
    });
    
    const duration = Date.now() - startTime;
    
    log('blue', `- Response Status: ${response.status}`);
    log('blue', `- Response Time: ${duration}ms`);
    log('blue', `- Rate Limit Headers:`, {
      limit: response.headers.get('X-RateLimit-Limit'),
      remaining: response.headers.get('X-RateLimit-Remaining')
    });
    
    if (response.ok) {
      const data = await response.json();
      log('green', '✅ Success! Memoji generated');
      
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const base64Data = data.data[0].b64_json;
        const filename = `${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const savedPath = saveImage(base64Data, filename);
        
        log('green', `🎉 Memoji saved successfully!`);
        log('green', `📊 Image size: ${Math.round(base64Data.length / 1024)}KB`);
        return { success: true, filename: savedPath, data };
      } else {
        log('yellow', '⚠️  No image data in response');
        return { success: false, error: 'No image data' };
      }
    } else {
      const errorData = await response.json();
      log('red', '❌ Error:', errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    log('red', '❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test authentication failure
async function testAuthenticationFailure() {
  log('cyan', `\n🔐 Testing Authentication Failure`);
  log('cyan', '='.repeat(50));
  
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // Missing authentication headers
      },
      body: JSON.stringify({ prompt: 'test prompt' })
    });
    
    log('blue', `Response Status: ${response.status}`);
    
    if (response.status === 401) {
      log('green', '✅ Correctly rejected unauthenticated request');
    } else {
      log('red', '❌ Should have been rejected (401)');
    }
  } catch (error) {
    log('red', '❌ Request failed:', error.message);
  }
}

// Test rate limiting
async function testRateLimiting() {
  log('cyan', `\n⚡ Testing Rate Limiting`);
  log('cyan', '='.repeat(50));
  
  const promises = [];
  for (let i = 0; i < 12; i++) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({ prompt: `Rate limit test ${i}` });
    const signature = generateSignature(timestamp, body, BACKEND_SECRET);
    
    promises.push(
      fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'X-Client-Version': '1.0.0'
        },
        body: body
      })
    );
  }
  
  try {
    const responses = await Promise.all(promises);
    const statusCounts = {};
    responses.forEach(res => {
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    });
    
    log('blue', 'Status distribution:', statusCounts);
    
    if (statusCounts[429]) {
      log('green', '✅ Rate limiting is working');
    } else {
      log('yellow', '⚠️  Rate limiting may not be working (no 429 responses)');
    }
  } catch (error) {
    log('red', '❌ Rate limit test failed:', error.message);
  }
}

// Test invalid parameters
async function testInvalidParameters() {
  log('cyan', `\n🚫 Testing Invalid Parameters`);
  log('cyan', '='.repeat(50));
  
  const invalidTests = [
    { name: 'Empty prompt', body: { prompt: '' } },
    { name: 'Missing prompt', body: {} },
    { name: 'Invalid size', body: { prompt: 'test', size: '999x999' } },
    { name: 'Invalid background', body: { prompt: 'test', background: 'invalid' } },
    { name: 'Too long prompt', body: { prompt: 'a'.repeat(1001) } }
  ];
  
  for (const test of invalidTests) {
    log('blue', `Testing: ${test.name}`);
    
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify(test.body);
    const signature = generateSignature(timestamp, body, BACKEND_SECRET);
    
    try {
      const response = await fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': timestamp,
          'X-Signature': signature,
          'X-Client-Version': '1.0.0'
        },
        body: body
      });
      
      log('blue', `  Status: ${response.status}`);
      
      if (response.status === 400) {
        log('green', '  ✅ Correctly rejected invalid request');
      } else {
        log('yellow', '  ⚠️  Unexpected response status');
      }
    } catch (error) {
      log('red', '  ❌ Request failed:', error.message);
    }
  }
}

// Main test runner
async function runAllTests() {
  log('bright', '🚀 AI Memojis CLI Test Suite');
  log('bright', '============================');
  
  ensureOutputDir();
  
  const testResults = [];
  
  // Test 1: Basic memoji generation
  const basicResult = await testMemojiGeneration(
    'Basic Father Memoji',
    'A premium 3D Memoji-style avatar of a cheerful father with short neat hair and light skin tone. Include head, shoulders, and hands with a waving gesture. casual pastel shirt. Soft rounded shapes, glossy textures, minimal modern style. Cheerful happy face with warm eyes.'
  );
  testResults.push(basicResult);
  
  // Test 2: Different family member
  const motherResult = await testMemojiGeneration(
    'Mother Memoji',
    'A premium 3D Memoji-style avatar of a warm mother with long curly hair and medium skin tone. Include head, shoulders, and hands with a thumbs up gesture. elegant blouse. Soft rounded shapes, glossy textures, minimal modern style. Kind face with gentle eyes.'
  );
  testResults.push(motherResult);
  
  // Test 3: Different size
  const landscapeResult = await testMemojiGeneration(
    'Landscape Memoji',
    'A premium 3D Memoji-style avatar of a young child with messy hair and fair skin tone. Include head, shoulders, and hands with a peace sign gesture. colorful t-shirt. Soft rounded shapes, glossy textures, minimal modern style. Playful face with bright eyes.',
    '1792x1024'
  );
  testResults.push(landscapeResult);
  
  // Test 4: Transparent background
  const transparentResult = await testMemojiGeneration(
    'Transparent Memoji',
    'A premium 3D Memoji-style avatar of a teenager with spiky hair and tan skin tone. Include head, shoulders, and hands with a pointing gesture. casual hoodie. Soft rounded shapes, glossy textures, minimal modern style. Confident face with determined eyes.',
    '1024x1024',
    'transparent'
  );
  testResults.push(transparentResult);
  
  // Test 5: Authentication failure
  await testAuthenticationFailure();
  
  // Test 6: Rate limiting
  await testRateLimiting();
  
  // Test 7: Invalid parameters
  await testInvalidParameters();
  
  // Summary
  log('bright', '\n📊 Test Summary');
  log('bright', '===============');
  
  const successfulTests = testResults.filter(r => r.success).length;
  const totalTests = testResults.length;
  
  log('green', `✅ Successful tests: ${successfulTests}/${totalTests}`);
  
  if (successfulTests > 0) {
    log('green', `📸 Generated images saved in: ${OUTPUT_DIR}`);
    log('blue', 'Generated files:');
    testResults.filter(r => r.success).forEach(result => {
      log('blue', `  - ${path.basename(result.filename)}`);
    });
  }
  
  log('bright', '\n🏁 CLI Test Suite Complete!');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testMemojiGeneration, testAuthenticationFailure, testRateLimiting, testInvalidParameters };
