// Test PhonePe Backend Integration
// Run with: node test-phonepe-backend.js

const fetch = require('node-fetch');

async function testBackendIntegration() {
  console.log('🧪 Testing PhonePe Backend Integration...');
  console.log('==========================================');
  
  // Test your backend endpoint
  const backendUrl = 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/phonepe/checkout';
  
  const testPayload = {
    userId: 'test-user-123',
    plan: 'monthly'
  };

  console.log('📡 Testing backend endpoint:', backendUrl);
  console.log('📦 Payload:', JSON.stringify(testPayload, null, 2));
  console.log('');

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    const responseData = await response.json();
    
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    console.log('📊 Response Body:', JSON.stringify(responseData, null, 2));

    if (response.ok && responseData?.redirectUrl) {
      console.log('');
      console.log('🎉 Backend Integration SUCCESS!');
      console.log('=====================================');
      console.log('🔗 Redirect URL:', responseData.redirectUrl);
      console.log('🆔 Order ID:', responseData.orderId);
      console.log('');
      console.log('✅ PhonePe integration is working correctly!');
    } else {
      console.log('');
      console.log('❌ Backend Integration FAILED');
      console.log('=====================================');
      console.log('Error:', responseData);
      
      if (response.status === 500 && responseData.error?.includes('credentials')) {
        console.log('');
        console.log('💡 Solution: Set environment variables in Vercel:');
        console.log('  PHONEPE_CLIENT_ID=your_client_id');
        console.log('  PHONEPE_CLIENT_SECRET=your_client_secret');
        console.log('  PHONEPE_CLIENT_VERSION=1.0');
      }
    }
  } catch (error) {
    console.error('');
    console.error('❌ Backend Test ERROR:', error.message);
    console.log('');
    console.log('💡 Possible solutions:');
    console.log('  1. Check if backend is deployed');
    console.log('  2. Verify the backend URL is correct');
    console.log('  3. Check network connectivity');
  }
}

// Run the test
testBackendIntegration().then(() => {
  console.log('');
  console.log('🏁 Backend test completed!');
}).catch(error => {
  console.error('💥 Backend test failed:', error);
});
