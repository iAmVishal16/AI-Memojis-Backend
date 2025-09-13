const crypto = require('crypto');

// Test emoji generation with proper authentication
async function testMemojiGeneration() {
  const BACKEND_URL = 'https://ai-memojis-backend.vercel.app/api/generate-memoji';
  const BACKEND_SECRET = 'f645c2896e6caebd848a7b7d5ed5e79f69763f23972a249a485d2a05daaabf5f';
  
  console.log('🎨 Testing Memoji Generation');
  console.log('============================');
  
  // Test data
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const body = {
    prompt: 'A premium 3D Memoji-style avatar of a cheerful father with short neat hair and light skin tone. Include head, shoulders, and hands with a waving gesture. casual pastel shirt. Soft rounded shapes, glossy textures, minimal modern style. Cheerful happy face with warm eyes.',
    size: '1024x1024',
    background: 'auto'
  };
  
  const rawBody = JSON.stringify(body);
  const message = timestamp + '.' + rawBody;
  
  console.log('Request details:');
  console.log('- Timestamp:', timestamp);
  console.log('- Prompt length:', body.prompt.length);
  console.log('- Size:', body.size);
  console.log('- Background:', body.background);
  console.log('- Raw body:', rawBody);
  
  // Generate signature
  const signature = crypto.createHmac('sha256', BACKEND_SECRET)
    .update(message)
    .digest('hex');
  
  console.log('- Signature:', signature);
  console.log('- Message to sign:', message);
  
  try {
    console.log('\n🚀 Sending request...');
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Timestamp': timestamp,
        'X-Signature': signature,
        'X-Client-Version': '1.0.0'
      },
      body: rawBody
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', {
      'X-RateLimit-Limit': response.headers.get('X-RateLimit-Limit'),
      'X-RateLimit-Remaining': response.headers.get('X-RateLimit-Remaining'),
      'Content-Type': response.headers.get('Content-Type')
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Success! Memoji generated');
      console.log('Response keys:', Object.keys(data));
      
      if (data.data && data.data[0] && data.data[0].b64_json) {
        console.log('📸 Image data length:', data.data[0].b64_json.length);
        console.log('🎉 Memoji generation successful!');
      } else {
        console.log('⚠️  No image data in response');
      }
    } else {
      const errorData = await response.json();
      console.log('❌ Error:', errorData);
      
      if (response.status === 401) {
        console.log('🔐 Authentication failed - checking signature generation...');
        
        // Debug signature generation
        const expectedSig = crypto.createHmac('sha256', BACKEND_SECRET)
          .update(message)
          .digest('hex');
        
        console.log('Expected signature:', expectedSig);
        console.log('Generated signature:', signature);
        console.log('Signatures match:', signature === expectedSig);
      }
    }
  } catch (error) {
    console.log('❌ Network error:', error.message);
  }
}

// Run the test
testMemojiGeneration().catch(console.error);
