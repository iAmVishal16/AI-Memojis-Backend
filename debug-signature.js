import crypto from 'crypto';

// Debug script to test signature generation
const BACKEND_SECRET = 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';
const timestamp = Math.floor(Date.now() / 1000).toString();
const body = JSON.stringify({
  prompt: 'test',
  size: '1024x1024',
  background: 'auto'
});

console.log('Debug signature generation:');
console.log('Timestamp:', timestamp);
console.log('Body:', body);
console.log('Secret:', BACKEND_SECRET);

const message = timestamp + '.' + body;
console.log('Message to sign:', message);

const signature = crypto.createHmac('sha256', BACKEND_SECRET)
  .update(message)
  .digest('hex');

console.log('Generated signature:', signature);

// Test with a simple request
const testSignature = crypto.createHmac('sha256', BACKEND_SECRET)
  .update('1757522038.{"prompt":"test","size":"1024x1024","background":"auto"}')
  .digest('hex');

console.log('Test signature for known values:', testSignature);
