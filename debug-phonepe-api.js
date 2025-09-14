#!/usr/bin/env node

/**
 * Test PhonePe API Integration
 * Debug the "Api Mapping Not Found" error
 */

import fetch from 'node-fetch';

const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || '1.0';

async function testPhonePeAuth() {
  console.log('🔐 Testing PhonePe Authentication...\n');
  
  if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
    console.error('❌ PhonePe credentials not found in environment variables');
    return;
  }

  console.log('📋 Credentials:');
  console.log(`Client ID: ${PHONEPE_CLIENT_ID}`);
  console.log(`Client Secret: ${PHONEPE_CLIENT_SECRET.substring(0, 8)}...`);
  console.log(`Client Version: ${PHONEPE_CLIENT_VERSION}\n`);

  try {
    // Test OAuth token endpoint
    console.log('1️⃣ Testing OAuth Token Endpoint...');
    const authUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token';
    
    const authResp = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: PHONEPE_CLIENT_ID,
        client_version: PHONEPE_CLIENT_VERSION,
        client_secret: PHONEPE_CLIENT_SECRET,
        grant_type: 'client_credentials',
      })
    });

    console.log(`Status: ${authResp.status} ${authResp.statusText}`);
    const authJson = await authResp.json().catch(() => ({}));
    console.log('Response:', JSON.stringify(authJson, null, 2));

    if (!authResp.ok || !authJson?.access_token) {
      console.error('❌ OAuth token failed');
      return;
    }

    console.log('✅ OAuth token successful\n');

    // Test payment creation endpoint
    console.log('2️⃣ Testing Payment Creation Endpoint...');
    const accessToken = authJson.access_token;
    const orderId = `test-${Date.now()}`;
    const amountPaise = 99900; // 999 INR
    
    const payUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/pay';
    const payPayload = {
      merchantId: PHONEPE_CLIENT_ID,
      merchantTransactionId: orderId,
      merchantUserId: 'test-user',
      amount: amountPaise,
      redirectUrl: 'https://aimemojis.com/?purchase=success',
      redirectMode: 'POST',
      callbackUrl: 'https://aimemojis.com/api/phonepe/webhook',
      mobileNumber: '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    console.log('Payload:', JSON.stringify(payPayload, null, 2));

    const payResp = await fetch(payUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'X-VERIFY': 'sha256',
      },
      body: JSON.stringify(payPayload)
    });

    console.log(`Status: ${payResp.status} ${payResp.statusText}`);
    const payJson = await payResp.json().catch(() => ({}));
    console.log('Response:', JSON.stringify(payJson, null, 2));

    if (payResp.ok && payJson?.data?.instrumentResponse?.redirectInfo?.url) {
      console.log('✅ Payment creation successful');
      console.log(`Redirect URL: ${payJson.data.instrumentResponse.redirectInfo.url}`);
    } else {
      console.error('❌ Payment creation failed');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPhonePeAuth().catch(console.error);
