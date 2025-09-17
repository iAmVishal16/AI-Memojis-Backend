// Test PhonePe Sandbox Payment Flow
// Run with: node test-sandbox-payment.js

import fetch from 'node-fetch';

// Sandbox PhonePe credentials
const SANDBOX_CONFIG = {
  PHONEPE_CLIENT_ID: "TEST-M234QGP8GOGCN_25091",
  PHONEPE_CLIENT_SECRET: "MjNlYWQ5NDQtYmNmMC00NjgwLWE0NDYtYWVlZTcwZThkZTlj",
  PHONEPE_CLIENT_VERSION: "1.0",
  PHONEPE_ENVIRONMENT: "sandbox",
  BASE_URL: "https://api-preprod.phonepe.com/apis/pg-sandbox"
};

async function testSandboxPaymentFlow() {
  console.log('🧪 Testing PhonePe Sandbox Payment Flow');
  console.log('==========================================');
  console.log('');
  
  console.log('📋 Configuration:');
  console.log(`   Environment: ${SANDBOX_CONFIG.PHONEPE_ENVIRONMENT}`);
  console.log(`   Client ID: ${SANDBOX_CONFIG.PHONEPE_CLIENT_ID}`);
  console.log(`   Base URL: ${SANDBOX_CONFIG.BASE_URL}`);
  console.log('');

  try {
    // Step 1: Test Authorization
    console.log('🔐 Step 1: Testing PhonePe Authorization...');
    const authResult = await testAuthorization();
    
    if (!authResult.success) {
      console.log('❌ Authorization failed, stopping test');
      return;
    }
    
    console.log('✅ Authorization successful!');
    console.log('');

    // Step 2: Test Payment Creation
    console.log('💳 Step 2: Testing Payment Creation...');
    const paymentResult = await testPaymentCreation(authResult.accessToken);
    
    if (!paymentResult.success) {
      console.log('❌ Payment creation failed');
      return;
    }
    
    console.log('✅ Payment creation successful!');
    console.log('');

    // Step 3: Test Backend Integration
    console.log('🏠 Step 3: Testing Backend Integration...');
    const backendResult = await testBackendIntegration();
    
    if (!backendResult.success) {
      console.log('❌ Backend integration failed');
      return;
    }
    
    console.log('✅ Backend integration successful!');
    console.log('');

    // Step 4: Test Local Proxy
    console.log('🔄 Step 4: Testing Local Proxy...');
    const proxyResult = await testLocalProxy();
    
    if (!proxyResult.success) {
      console.log('❌ Local proxy test failed');
      return;
    }
    
    console.log('✅ Local proxy test successful!');
    console.log('');

    // Summary
    console.log('🎉 All Tests Passed!');
    console.log('===================');
    console.log('✅ PhonePe Authorization: Working');
    console.log('✅ Payment Creation: Working');
    console.log('✅ Backend Integration: Working');
    console.log('✅ Local Proxy: Working');
    console.log('');
    console.log('🚀 Ready for sandbox payment testing!');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Open http://localhost:8080');
    console.log('   2. Sign up/Sign in');
    console.log('   3. Try to upgrade');
    console.log('   4. Select a plan');
    console.log('   5. Click "Upgrade Now"');
    console.log('   6. You should be redirected to PhonePe sandbox');

  } catch (error) {
    console.error('💥 Test failed with error:', error.message);
  }
}

async function testAuthorization() {
  try {
    const authUrl = `${SANDBOX_CONFIG.BASE_URL}/v1/oauth/token`;
    
    const authResp = await fetch(authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SANDBOX_CONFIG.PHONEPE_CLIENT_ID,
        client_version: SANDBOX_CONFIG.PHONEPE_CLIENT_VERSION,
        client_secret: SANDBOX_CONFIG.PHONEPE_CLIENT_SECRET,
        grant_type: 'client_credentials',
      })
    });

    const authJson = await authResp.json();
    
    if (authResp.ok && authJson?.access_token) {
      console.log(`   ✅ Access Token: ${authJson.access_token.substring(0, 50)}...`);
      console.log(`   ✅ Expires At: ${new Date(authJson.expires_at * 1000).toISOString()}`);
      return { success: true, accessToken: authJson.access_token };
    } else {
      console.log(`   ❌ Status: ${authResp.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(authJson)}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false };
  }
}

async function testPaymentCreation(accessToken) {
  try {
    const payUrl = `${SANDBOX_CONFIG.BASE_URL}/v1/pay`;
    const orderId = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const payPayload = {
      merchantId: SANDBOX_CONFIG.PHONEPE_CLIENT_ID,
      merchantTransactionId: orderId,
      merchantUserId: 'test-user-123',
      amount: 99900, // ₹999 in paise (monthly plan)
      redirectUrl: 'http://localhost:8080/generate?purchase=success&plan=monthly',
      redirectMode: 'POST',
      callbackUrl: 'http://localhost:8080/api/phonepe/webhook',
      mobileNumber: '9999999999',
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

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
    
    if (payResp.ok && payJson?.data?.instrumentResponse?.redirectInfo?.url) {
      console.log(`   ✅ Order ID: ${orderId}`);
      console.log(`   ✅ Redirect URL: ${payJson.data.instrumentResponse.redirectInfo.url}`);
      return { success: true, redirectUrl: payJson.data.instrumentResponse.redirectInfo.url };
    } else {
      console.log(`   ❌ Status: ${payResp.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(payJson)}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false };
  }
}

async function testBackendIntegration() {
  try {
    const backendUrl = 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/phonepe/checkout';
    
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-123',
        plan: 'monthly',
        amount: 9.99,
        returnUrl: 'http://localhost:8080/generate?purchase=success&plan=monthly',
        cancelUrl: 'http://localhost:8080/generate?purchase=cancel'
      })
    });

    const data = await response.json();
    
    if (response.ok && data?.redirectUrl) {
      console.log(`   ✅ Backend URL: ${backendUrl}`);
      console.log(`   ✅ Redirect URL: ${data.redirectUrl}`);
      return { success: true };
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(data)}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false };
  }
}

async function testLocalProxy() {
  try {
    const proxyUrl = 'http://localhost:3000/api/phonepe/checkout';
    
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: 'test-user-123',
        plan: 'monthly',
        amount: 9.99,
        returnUrl: 'http://localhost:8080/generate?purchase=success&plan=monthly',
        cancelUrl: 'http://localhost:8080/generate?purchase=cancel'
      })
    });

    const data = await response.json();
    
    if (response.ok && data?.redirectUrl) {
      console.log(`   ✅ Proxy URL: ${proxyUrl}`);
      console.log(`   ✅ Redirect URL: ${data.redirectUrl}`);
      return { success: true };
    } else {
      console.log(`   ❌ Status: ${response.status}`);
      console.log(`   ❌ Error: ${JSON.stringify(data)}`);
      return { success: false };
    }
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return { success: false };
  }
}

// Run the test
testSandboxPaymentFlow().then(() => {
  console.log('🏁 Sandbox payment flow test completed!');
}).catch(error => {
  console.error('💥 Test failed:', error);
});
