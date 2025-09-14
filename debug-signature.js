#!/usr/bin/env node

import crypto from 'crypto';

// Test signature generation and verification
const BACKEND_SECRET = 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';

function generateSignature(timestamp, body, secret) {
  const message = timestamp + '.' + body;
  console.log('🔍 Signature Generation Debug:');
  console.log('  Timestamp:', timestamp);
  console.log('  Body:', body);
  console.log('  Message:', message);
  console.log('  Secret:', secret);
  
  const signature = crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  console.log('  Generated Signature:', signature);
  return signature;
}

function verifySignature(timestamp, body, signature, secret) {
  const message = timestamp + '.' + body;
  const expectedSig = crypto.createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  console.log('🔍 Signature Verification Debug:');
  console.log('  Timestamp:', timestamp);
  console.log('  Body:', body);
  console.log('  Message:', message);
  console.log('  Received Signature:', signature);
  console.log('  Expected Signature:', expectedSig);
  console.log('  Match:', signature === expectedSig);
  
  return signature === expectedSig;
}

// Test with sample data
const timestamp = Math.floor(Date.now() / 1000).toString();
const testBody = JSON.stringify({
  prompt: 'A premium 3D Memoji-style avatar of a cheerful father',
  size: '1024x1024',
  background: 'auto'
});

console.log('🧪 Testing HMAC Signature Generation and Verification\n');

// Generate signature
const signature = generateSignature(timestamp, testBody, BACKEND_SECRET);

console.log('\n' + '='.repeat(50) + '\n');

// Verify signature
const isValid = verifySignature(timestamp, testBody, signature, BACKEND_SECRET);

console.log('\n📊 Test Result:');
console.log('✅ Signature generation and verification:', isValid ? 'PASSED' : 'FAILED');

// Test with different body formats
console.log('\n🧪 Testing Different Body Formats:\n');

const testCases = [
  { name: 'Empty object', body: JSON.stringify({}) },
  { name: 'Null body', body: JSON.stringify(null) },
  { name: 'Undefined body', body: JSON.stringify(undefined) },
  { name: 'String body', body: 'test' },
];

testCases.forEach(testCase => {
  console.log(`\n📝 Testing: ${testCase.name}`);
  const sig = generateSignature(timestamp, testCase.body, BACKEND_SECRET);
  const valid = verifySignature(timestamp, testCase.body, sig, BACKEND_SECRET);
  console.log(`   Result: ${valid ? '✅ PASS' : '❌ FAIL'}`);
});