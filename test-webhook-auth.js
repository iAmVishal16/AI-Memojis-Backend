#!/usr/bin/env node

/**
 * Test PhonePe Webhook Authentication
 * Tests the webhook endpoint with proper authentication
 */

import fetch from 'node-fetch';

const WEBHOOK_URL = 'https://ai-memojis-backend-5l1qfxz9v-iamvishal16s-projects.vercel.app/api/phonepe/webhook';
const USERNAME = 'phonepe_webhook_user';
const PASSWORD = 'Rule2701';

// Create Basic Auth header
const credentials = Buffer.from(`${USERNAME}:${PASSWORD}`).toString('base64');
const authHeader = `Basic ${credentials}`;

async function testWebhookAuth() {
  console.log('🔐 Testing PhonePe Webhook Authentication...\n');

  // Test 1: Valid authentication with success payload
  console.log('Test 1: Valid authentication with PAYMENT_SUCCESS');
  try {
    const successPayload = {
      success: true,
      code: 'PAYMENT_SUCCESS',
      data: {
        merchantId: 'TEST_MERCHANT',
        merchantTransactionId: 'test-order-123',
        metadata: {
          userId: 'test-user-123',
          plan: 'monthly'
        }
      }
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(successPayload)
    });

    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 2: Invalid authentication
  console.log('Test 2: Invalid authentication');
  try {
    const invalidAuthHeader = `Basic ${Buffer.from('wrong:password').toString('base64')}`;
    
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': invalidAuthHeader
      },
      body: JSON.stringify({ test: 'data' })
    });

    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 3: No authentication
  console.log('Test 3: No authentication header');
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ test: 'data' })
    });

    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }

  // Test 4: Payment failure (should be ignored)
  console.log('Test 4: Payment failure (should be ignored)');
  try {
    const failurePayload = {
      success: false,
      code: 'PAYMENT_FAILED',
      data: {
        merchantId: 'TEST_MERCHANT',
        merchantTransactionId: 'test-order-456',
        metadata: {
          userId: 'test-user-456',
          plan: 'lifetime'
        }
      }
    };

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify(failurePayload)
    });

    const result = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${result}\n`);
  } catch (error) {
    console.error('Error:', error.message);
  }

  console.log('✅ Webhook authentication tests completed!');
}

testWebhookAuth().catch(console.error);
