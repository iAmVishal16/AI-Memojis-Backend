#!/usr/bin/env node

import crypto from 'crypto';

// Test actual API request
const BACKEND_URL = 'https://ai-memojis-backend.vercel.app/api/generate-memoji';
const BACKEND_SECRET = 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';

function generateSignature(timestamp, body, secret) {
  const message = timestamp + '.' + body;
  return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

async function testAPIRequest() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestBody = {
    prompt: 'A premium 3D Memoji-style avatar of a cheerful father with short neat hair and light skin tone. Include head, shoulders, and hands with a waving gesture. casual pastel shirt. Soft rounded shapes, glossy textures, minimal modern style. Cheerful happy face with warm eyes.',
    size: '1024x1024',
    background: 'auto'
  };
  
  const bodyString = JSON.stringify(requestBody);
  const signature = generateSignature(timestamp, bodyString, BACKEND_SECRET);
  
  console.log('🔍 API Request Debug:');
  console.log('  URL:', BACKEND_URL);
  console.log('  Timestamp:', timestamp);
  console.log('  Body:', bodyString);
  console.log('  Signature:', signature);
  console.log('  Headers:', {
    'Content-Type': 'application/json',
    'X-Timestamp': timestamp,
    'X-Signature': signature,
    'X-Client-Version': '1.0.0'
  });
  
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Client-Version': '1.0.0'
      },
      body: bodyString
    });
    
    console.log('\n📡 API Response:');
    console.log('  Status:', response.status);
    console.log('  Status Text:', response.statusText);
    console.log('  Headers:', Object.fromEntries(response.headers.entries()));
    
    const responseText = await response.text();
    console.log('  Body:', responseText);
    
    if (response.status === 401) {
      console.log('\n❌ Authentication failed. Let me check the signature generation...');
      
      // Debug the signature generation step by step
      console.log('\n🔍 Signature Generation Debug:');
      console.log('  Step 1 - Timestamp:', timestamp);
      console.log('  Step 2 - Body String:', bodyString);
      console.log('  Step 3 - Message:', timestamp + '.' + bodyString);
      console.log('  Step 4 - Secret:', BACKEND_SECRET);
      
      const expectedSignature = crypto.createHmac('sha256', BACKEND_SECRET)
        .update(timestamp + '.' + bodyString)
        .digest('hex');
      
      console.log('  Step 5 - Expected Signature:', expectedSignature);
      console.log('  Step 6 - Generated Signature:', signature);
      console.log('  Step 7 - Match:', signature === expectedSignature);
    }
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

testAPIRequest();
