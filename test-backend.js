// Test script for AI Memojis Backend
const fetch = require('node-fetch');

async function testBackend() {
    const backendUrl = 'http://localhost:3000/api/generate-memoji';
    
    const testData = {
        prompt: 'A premium 3D Memoji-style avatar of a cheerful father with short neat hair. Include head, shoulders, and hands with a thumbs up gesture. Casual pastel shirt. Pastel circular background. Soft rounded shapes, glossy textures, minimal modern style.',
        size: '1024x1024',
        background: 'transparent'
    };

    try {
        console.log('🧪 Testing backend API...');
        console.log('📡 Sending request to:', backendUrl);
        console.log('📝 Test prompt:', testData.prompt.substring(0, 50) + '...');
        
        const response = await fetch(backendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        console.log('📊 Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Success! Response keys:', Object.keys(result));
            console.log('🖼️  Image data length:', result.data?.[0]?.b64_json?.length || 'No image data');
        } else {
            const error = await response.text();
            console.log('❌ Error:', error);
        }
    } catch (error) {
        console.log('💥 Network error:', error.message);
        console.log('💡 Make sure the backend is running: npm start');
    }
}

// Test health endpoint
async function testHealth() {
    try {
        const response = await fetch('http://localhost:3000/api/health');
        const result = await response.json();
        console.log('🏥 Health check:', result);
    } catch (error) {
        console.log('💥 Health check failed:', error.message);
    }
}

console.log('🚀 AI Memojis Backend Test');
console.log('========================');
testHealth().then(() => testBackend());
