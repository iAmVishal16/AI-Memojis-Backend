#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Configuration
const LOCAL_PROXY_URL = 'http://localhost:3000/api/generate-memoji';
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

// Save base64 image to file
function saveImage(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  log('green', `📸 Saved image: ${filepath}`);
  return filepath;
}

// Test memoji generation using local proxy (no auth required)
async function testMemojiGeneration(testName, prompt, size = '1024x1024', background = 'auto') {
  log('cyan', `\n🎨 Testing: ${testName}`);
  log('cyan', '='.repeat(50));
  
  const body = JSON.stringify({ prompt, size, background });
  
  log('blue', 'Request Details:');
  log('blue', `- Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
  log('blue', `- Size: ${size}`);
  log('blue', `- Background: ${background}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(LOCAL_PROXY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    const duration = Date.now() - startTime;
    
    log('blue', `- Response Status: ${response.status}`);
    log('blue', `- Response Time: ${duration}ms`);
    
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

// Test with actual OpenAI API (if available)
async function testWithRealAPI(testName, prompt, size = '1024x1024', background = 'auto') {
  log('cyan', `\n🎨 Testing with Real API: ${testName}`);
  log('cyan', '='.repeat(50));
  
  // Check if OpenAI API key is available
  if (!process.env.OPENAI_API_KEY) {
    log('yellow', '⚠️  OPENAI_API_KEY not set, skipping real API test');
    return { success: false, error: 'No API key' };
  }
  
  const body = JSON.stringify({ prompt, size, background });
  
  log('blue', 'Request Details:');
  log('blue', `- Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
  log('blue', `- Size: ${size}`);
  log('blue', `- Background: ${background}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: body
    });
    
    const duration = Date.now() - startTime;
    
    log('blue', `- Response Status: ${response.status}`);
    log('blue', `- Response Time: ${duration}ms`);
    
    if (response.ok) {
      const data = await response.json();
      log('green', '✅ Success! Memoji generated with OpenAI API');
      
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const base64Data = data.data[0].b64_json;
        const filename = `real_api_${testName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.png`;
        const savedPath = saveImage(base64Data, filename);
        
        log('green', `🎉 Real API memoji saved successfully!`);
        log('green', `📊 Image size: ${Math.round(base64Data.length / 1024)}KB`);
        return { success: true, filename: savedPath, data };
      } else {
        log('yellow', '⚠️  No image data in response');
        return { success: false, error: 'No image data' };
      }
    } else {
      const errorData = await response.json();
      log('red', '❌ OpenAI API Error:', errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    log('red', '❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Main test runner
async function runAllTests() {
  log('bright', '🚀 AI Memojis CLI Test Suite (Local Proxy)');
  log('bright', '==========================================');
  
  ensureOutputDir();
  
  const testResults = [];
  
  // Wait a moment for local proxy to start
  log('blue', '⏳ Waiting for local proxy to start...');
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Test 1: Basic memoji generation with local proxy
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
  
  // Test 5: Real OpenAI API (if key is available)
  const realApiResult = await testWithRealAPI(
    'Real API Test',
    'A premium 3D Memoji-style avatar of a professional woman with bob haircut and olive skin tone. Include head, shoulders, and hands with a confident pose. business blazer. Soft rounded shapes, glossy textures, minimal modern style. Professional face with intelligent eyes.'
  );
  testResults.push(realApiResult);
  
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
  log('yellow', '💡 Note: Local proxy uses mock responses. For real memoji generation, set OPENAI_API_KEY environment variable.');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests().catch(console.error);
}

export { testMemojiGeneration, testWithRealAPI };
