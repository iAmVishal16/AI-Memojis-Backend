// Test PhonePe Authorization API
// Run with: node test-phonepe-auth.js

import fetch from 'node-fetch';

async function testPhonePeAuth() {
  const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID;
  const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;
  const PHONEPE_CLIENT_VERSION = '1.0';

  console.log('🧪 Testing PhonePe Authorization API...');
  console.log('=====================================');
  
  if (!PHONEPE_CLIENT_ID || !PHONEPE_CLIENT_SECRET) {
    console.error('❌ Missing PhonePe credentials in environment variables');
    console.log('Please set:');
    console.log('  PHONEPE_CLIENT_ID=your_client_id');
    console.log('  PHONEPE_CLIENT_SECRET=your_client_secret');
    return;
  }

  console.log('✅ Client ID:', PHONEPE_CLIENT_ID);
  console.log('✅ Client Version:', PHONEPE_CLIENT_VERSION);
  console.log('✅ Client Secret:', PHONEPE_CLIENT_SECRET.substring(0, 8) + '...');
  console.log('');

  try {
    console.log('📡 Making authorization request...');
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

    const authJson = await authResp.json();
    
    console.log('📊 Response Status:', authResp.status);
    console.log('📊 Response Headers:', Object.fromEntries(authResp.headers.entries()));
    console.log('📊 Response Body:', JSON.stringify(authJson, null, 2));

    if (authResp.ok && authJson?.access_token) {
      console.log('');
      console.log('🎉 PhonePe Authorization SUCCESS!');
      console.log('=====================================');
      console.log('🔑 Access Token:', authJson.access_token.substring(0, 50) + '...');
      console.log('⏰ Expires At:', new Date(authJson.expires_at * 1000).toISOString());
      console.log('🆔 Token Type:', authJson.token_type);
      console.log('');
      
      // Test payment creation
      console.log('🧪 Testing Payment Creation...');
      await testPaymentCreation(authJson.access_token, PHONEPE_CLIENT_ID);
      
      return authJson.access_token;
    } else {
      console.log('');
      console.log('❌ PhonePe Authorization FAILED');
      console.log('=====================================');
      console.log('Error:', authJson);
      
      if (authResp.status === 401) {
        console.log('');
        console.log('💡 Possible solutions:');
        console.log('  1. Check your Client ID and Secret');
        console.log('  2. Ensure credentials are from PhonePe Dashboard');
        console.log('  3. Verify sandbox environment is enabled');
      }
    }
  } catch (error) {
    console.error('');
    console.error('❌ PhonePe Authorization ERROR:', error.message);
    console.log('');
    console.log('💡 Possible solutions:');
    console.log('  1. Check your internet connection');
    console.log('  2. Verify PhonePe API is accessible');
    console.log('  3. Check for firewall/proxy issues');
  }
}

async function testPaymentCreation(accessToken, clientId) {
  try {
    const payUrl = 'https://api-preprod.phonepe.com/apis/pg-sandbox/v1/pay';
    const orderId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const payPayload = {
      merchantId: clientId,
      merchantTransactionId: orderId,
      merchantUserId: 'test-user-123',
      amount: 10000, // 100 INR in paise
      redirectUrl: 'https://aimemojis.com/?test=success',
      redirectMode: 'POST',
      callbackUrl: 'https://aimemojis.com/api/phonepe/webhook',
      mobileNumber: '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    console.log('📡 Making payment creation request...');
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

    const payJson = await payResp.json();
    
    console.log('📊 Payment Response Status:', payResp.status);
    console.log('📊 Payment Response:', JSON.stringify(payJson, null, 2));

    if (payResp.ok && payJson?.data?.instrumentResponse?.redirectInfo?.url) {
      console.log('');
      console.log('🎉 Payment Creation SUCCESS!');
      console.log('=====================================');
      console.log('🔗 Redirect URL:', payJson.data.instrumentResponse.redirectInfo.url);
      console.log('🆔 Order ID:', orderId);
    } else {
      console.log('');
      console.log('❌ Payment Creation FAILED');
      console.log('=====================================');
      console.log('Error:', payJson);
    }
  } catch (error) {
    console.error('');
    console.error('❌ Payment Creation ERROR:', error.message);
  }
}

// Run the test
testPhonePeAuth().then(() => {
  console.log('');
  console.log('🏁 Test completed!');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
