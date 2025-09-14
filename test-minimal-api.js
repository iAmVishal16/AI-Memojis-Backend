#!/usr/bin/env node

import crypto from 'crypto';

// Test with minimal request
const BACKEND_URL = 'https://ai-memojis-backend.vercel.app/api/generate-memoji';
const BACKEND_SECRET = 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';

function generateSignature(timestamp, body, secret) {
  const message = timestamp + '.' + body;
  return crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
}

async function testMinimalRequest() {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const requestBody = {
    prompt: 'A simple test memoji'
  };
  
  const bodyString = JSON.stringify(requestBody);
  const signature = generateSignature(timestamp, bodyString, BACKEND_SECRET);
  
  console.log('🔍 Minimal API Request Test:');
  console.log('  Timestamp:', timestamp);
  console.log('  Body:', bodyString);
  console.log('  Signature:', signature);
  
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
    
    console.log('\n📡 Response:');
    console.log('  Status:', response.status);
    console.log('  Status Text:', response.statusText);
    
    const responseText = await response.text();
    console.log('  Body:', responseText);
    
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

// Test health endpoint first
async function testHealthEndpoint() {
  console.log('🏥 Testing Health Endpoint...');
  try {
    const response = await fetch('https://ai-memojis-backend.vercel.app/api/health');
    const data = await response.json();
    console.log('  Health Status:', data);
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
  }
}

async function runTests() {
  await testHealthEndpoint();
  console.log('\n' + '='.repeat(50) + '\n');
  await testMinimalRequest();
}

runTests();
