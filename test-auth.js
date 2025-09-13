import crypto from 'crypto';

// Test script to verify backend authentication
async function testBackendAuth() {
  const BACKEND_URL = 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/generate-memoji';
  const BACKEND_SECRET = process.env.BACKEND_SECRET || 'test-secret';
  
  console.log('🧪 Testing Backend Authentication');
  console.log('================================');
  
  // Test 1: Health check
  console.log('\n1. Testing health endpoint...');
  try {
    const healthResponse = await fetch('https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/health');
    const healthData = await healthResponse.json();
    console.log('✅ Health check:', healthData.status);
    console.log('   Environment checks:', healthData.checks);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test 2: Unauthenticated request (should fail)
  console.log('\n2. Testing unauthenticated request...');
  try {
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'test prompt' })
    });
    console.log('   Status:', response.status);
    if (response.status === 401) {
      console.log('✅ Correctly rejected unauthenticated request');
    } else {
      console.log('❌ Should have been rejected (401)');
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  // Test 3: Authenticated request
  console.log('\n3. Testing authenticated request...');
  try {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const body = JSON.stringify({
      prompt: 'A premium 3D Memoji-style avatar of a cheerful father with short neat hair and light skin tone',
      size: '1024x1024',
      background: 'auto'
    });
    
    const signature = crypto.createHmac('sha256', BACKEND_SECRET)
      .update(timestamp + '.' + body)
      .digest('hex');
    
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Client-Version': '1.0.0'
      },
      body: body
    });
    
    console.log('   Status:', response.status);
    console.log('   Headers:', {
      'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
      'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining')
    });
    
    if (response.ok) {
      console.log('✅ Authenticated request successful');
      const data = await response.json();
      console.log('   Response keys:', Object.keys(data));
    } else {
      const errorData = await response.json();
      console.log('❌ Authenticated request failed:', errorData);
    }
  } catch (error) {
    console.log('❌ Request failed:', error.message);
  }
  
  // Test 4: Rate limiting
  console.log('\n4. Testing rate limiting...');
  const promises = [];
  for (let i = 0; i < 12; i++) { // Send 12 requests to test rate limit
    promises.push(
      fetch(BACKEND_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Timestamp': Math.floor(Date.now() / 1000).toString(),
          'X-Signature': crypto.createHmac('sha256', BACKEND_SECRET)
            .update(Math.floor(Date.now() / 1000).toString() + '.' + JSON.stringify({ prompt: 'test' }))
            .digest('hex'),
          'X-Client-Version': '1.0.0'
        },
        body: JSON.stringify({ prompt: 'test prompt' })
      })
    );
  }
  
  try {
    const responses = await Promise.all(promises);
    const statusCounts = {};
    responses.forEach(res => {
      statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
    });
    console.log('   Status distribution:', statusCounts);
    
    if (statusCounts[429]) {
      console.log('✅ Rate limiting is working');
    } else {
      console.log('⚠️  Rate limiting may not be working (no 429 responses)');
    }
  } catch (error) {
    console.log('❌ Rate limit test failed:', error.message);
  }
  
  console.log('\n🏁 Test completed');
}

// Run the test
testBackendAuth().catch(console.error);
