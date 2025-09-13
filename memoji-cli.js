#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';

// Configuration
const LOCAL_PROXY_URL = 'http://localhost:3000/api/generate-memoji';
const PRODUCTION_URL = 'https://ai-memojis-backend-cbhjztnqu-iamvishal16s-projects.vercel.app/api/generate-memoji';
const OUTPUT_DIR = './test-outputs';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(color, message, ...args) {
  console.log(`${colors[color]}${message}${colors.reset}`, ...args);
}

// Create output directory
function ensureOutputDir() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('green', `✅ Created output directory: ${OUTPUT_DIR}`);
  }
}

// Save base64 image to file
function saveImage(base64Data, filename) {
  const buffer = Buffer.from(base64Data, 'base64');
  const filepath = path.join(OUTPUT_DIR, filename);
  fs.writeFileSync(filepath, buffer);
  log('green', `📸 Saved image: ${filepath}`);
  return filepath;
}

// Generate memoji with different backends
async function generateMemoji(prompt, size = '1024x1024', background = 'auto', useLocal = true) {
  const url = useLocal ? LOCAL_PROXY_URL : PRODUCTION_URL;
  const body = JSON.stringify({ prompt, size, background });
  
  log('blue', `🎨 Generating memoji with ${useLocal ? 'local proxy' : 'production API'}...`);
  log('blue', `📝 Prompt: ${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}`);
  log('blue', `📐 Size: ${size}, Background: ${background}`);
  
  try {
    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: body
    });
    
    const duration = Date.now() - startTime;
    
    log('blue', `⏱️  Response time: ${duration}ms`);
    log('blue', `📊 Status: ${response.status}`);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.data && data.data[0] && data.data[0].b64_json) {
        const base64Data = data.data[0].b64_json;
        const timestamp = Date.now();
        const filename = `memoji_${timestamp}.png`;
        const savedPath = saveImage(base64Data, filename);
        
        log('green', `🎉 Memoji generated successfully!`);
        log('green', `📊 Image size: ${Math.round(base64Data.length / 1024)}KB`);
        return { success: true, filename: savedPath, data };
      } else {
        log('yellow', '⚠️  No image data in response');
        return { success: false, error: 'No image data' };
      }
    } else {
      const errorData = await response.json();
      log('red', '❌ Error:', errorData);
      return { success: false, error: errorData };
    }
  } catch (error) {
    log('red', '❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Interactive CLI
async function interactiveCLI() {
  log('bright', '🎭 AI Memojis Interactive CLI');
  log('bright', '==============================');
  
  ensureOutputDir();
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise(resolve => rl.question(query, resolve));
  
  try {
    while (true) {
      log('cyan', '\n📋 Memoji Generation Options:');
      log('cyan', '1. Generate custom memoji');
      log('cyan', '2. Generate family member memoji');
      log('cyan', '3. Generate professional memoji');
      log('cyan', '4. Batch generate multiple memojis');
      log('cyan', '5. Test different sizes');
      log('cyan', '6. Switch backend (local/production)');
      log('cyan', '7. View generated files');
      log('cyan', '8. Exit');
      
      const choice = await question('\n🔢 Choose an option (1-8): ');
      
      switch (choice.trim()) {
        case '1':
          await customMemojiGeneration(rl, question);
          break;
        case '2':
          await familyMemojiGeneration(rl, question);
          break;
        case '3':
          await professionalMemojiGeneration(rl, question);
          break;
        case '4':
          await batchGeneration(rl, question);
          break;
        case '5':
          await sizeTestGeneration(rl, question);
          break;
        case '6':
          await switchBackend(rl, question);
          break;
        case '7':
          await viewGeneratedFiles();
          break;
        case '8':
          log('green', '👋 Goodbye!');
          rl.close();
          return;
        default:
          log('red', '❌ Invalid choice. Please try again.');
      }
    }
  } catch (error) {
    log('red', '❌ Error:', error.message);
  } finally {
    rl.close();
  }
}

// Custom memoji generation
async function customMemojiGeneration(rl, question) {
  log('cyan', '\n🎨 Custom Memoji Generation');
  log('cyan', '============================');
  
  const prompt = await question('📝 Enter your memoji prompt: ');
  const size = await question('📐 Enter size (1024x1024, 1792x1024, 1024x1792) [1024x1024]: ') || '1024x1024';
  const background = await question('🎨 Enter background (auto, transparent) [auto]: ') || 'auto';
  const useLocal = await question('🏠 Use local proxy? (y/n) [y]: ') !== 'n';
  
  if (prompt.trim()) {
    await generateMemoji(prompt.trim(), size, background, useLocal);
  } else {
    log('red', '❌ Prompt cannot be empty');
  }
}

// Family member memoji generation
async function familyMemojiGeneration(rl, question) {
  log('cyan', '\n👨‍👩‍👧‍👦 Family Member Memoji Generation');
  log('cyan', '====================================');
  
  const familyMembers = [
    { name: 'Father', prompt: 'A premium 3D Memoji-style avatar of a cheerful father with short neat hair and light skin tone. Include head, shoulders, and hands with a waving gesture. casual pastel shirt. Soft rounded shapes, glossy textures, minimal modern style. Cheerful happy face with warm eyes.' },
    { name: 'Mother', prompt: 'A premium 3D Memoji-style avatar of a warm mother with long curly hair and medium skin tone. Include head, shoulders, and hands with a thumbs up gesture. elegant blouse. Soft rounded shapes, glossy textures, minimal modern style. Kind face with gentle eyes.' },
    { name: 'Son', prompt: 'A premium 3D Memoji-style avatar of a young boy with messy hair and fair skin tone. Include head, shoulders, and hands with a peace sign gesture. colorful t-shirt. Soft rounded shapes, glossy textures, minimal modern style. Playful face with bright eyes.' },
    { name: 'Daughter', prompt: 'A premium 3D Memoji-style avatar of a young girl with pigtails and tan skin tone. Include head, shoulders, and hands with a pointing gesture. cute dress. Soft rounded shapes, glossy textures, minimal modern style. Sweet face with curious eyes.' }
  ];
  
  log('blue', 'Available family members:');
  familyMembers.forEach((member, index) => {
    log('blue', `${index + 1}. ${member.name}`);
  });
  
  const choice = await question('\n🔢 Choose family member (1-4): ');
  const memberIndex = parseInt(choice) - 1;
  
  if (memberIndex >= 0 && memberIndex < familyMembers.length) {
    const member = familyMembers[memberIndex];
    const useLocal = await question('🏠 Use local proxy? (y/n) [y]: ') !== 'n';
    await generateMemoji(member.prompt, '1024x1024', 'auto', useLocal);
  } else {
    log('red', '❌ Invalid choice');
  }
}

// Professional memoji generation
async function professionalMemojiGeneration(rl, question) {
  log('cyan', '\n💼 Professional Memoji Generation');
  log('cyan', '=================================');
  
  const professions = [
    { name: 'Business Executive', prompt: 'A premium 3D Memoji-style avatar of a professional business executive with styled hair and olive skin tone. Include head, shoulders, and hands with a confident pose. business suit. Soft rounded shapes, glossy textures, minimal modern style. Professional face with intelligent eyes.' },
    { name: 'Doctor', prompt: 'A premium 3D Memoji-style avatar of a medical doctor with neat hair and medium skin tone. Include head, shoulders, and hands with a caring gesture. medical coat. Soft rounded shapes, glossy textures, minimal modern style. Compassionate face with wise eyes.' },
    { name: 'Teacher', prompt: 'A premium 3D Memoji-style avatar of an enthusiastic teacher with friendly hair and light skin tone. Include head, shoulders, and hands with a teaching gesture. casual professional attire. Soft rounded shapes, glossy textures, minimal modern style. Encouraging face with patient eyes.' },
    { name: 'Engineer', prompt: 'A premium 3D Memoji-style avatar of a technical engineer with practical hair and tan skin tone. Include head, shoulders, and hands with a problem-solving pose. casual tech attire. Soft rounded shapes, glossy textures, minimal modern style. Focused face with analytical eyes.' }
  ];
  
  log('blue', 'Available professions:');
  professions.forEach((profession, index) => {
    log('blue', `${index + 1}. ${profession.name}`);
  });
  
  const choice = await question('\n🔢 Choose profession (1-4): ');
  const professionIndex = parseInt(choice) - 1;
  
  if (professionIndex >= 0 && professionIndex < professions.length) {
    const profession = professions[professionIndex];
    const useLocal = await question('🏠 Use local proxy? (y/n) [y]: ') !== 'n';
    await generateMemoji(profession.prompt, '1024x1024', 'auto', useLocal);
  } else {
    log('red', '❌ Invalid choice');
  }
}

// Batch generation
async function batchGeneration(rl, question) {
  log('cyan', '\n📦 Batch Memoji Generation');
  log('cyan', '==========================');
  
  const count = await question('🔢 How many memojis to generate? [3]: ') || '3';
  const countNum = parseInt(count);
  
  if (countNum > 0 && countNum <= 10) {
    const prompts = [
      'A cheerful father with short hair and light skin tone, waving gesture, casual shirt',
      'A warm mother with long hair and medium skin tone, thumbs up gesture, elegant blouse',
      'A playful child with messy hair and fair skin tone, peace sign gesture, colorful t-shirt',
      'A confident teenager with spiky hair and tan skin tone, pointing gesture, casual hoodie',
      'A professional woman with bob haircut and olive skin tone, confident pose, business blazer'
    ];
    
    const useLocal = await question('🏠 Use local proxy? (y/n) [y]: ') !== 'n';
    
    log('blue', `🚀 Generating ${countNum} memojis...`);
    
    for (let i = 0; i < countNum; i++) {
      const prompt = prompts[i % prompts.length];
      log('blue', `\n📝 Generating memoji ${i + 1}/${countNum}...`);
      await generateMemoji(prompt, '1024x1024', 'auto', useLocal);
      
      // Small delay between requests
      if (i < countNum - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } else {
    log('red', '❌ Please enter a number between 1 and 10');
  }
}

// Size test generation
async function sizeTestGeneration(rl, question) {
  log('cyan', '\n📐 Size Test Generation');
  log('cyan', '=======================');
  
  const sizes = ['1024x1024', '1792x1024', '1024x1792'];
  const prompt = 'A premium 3D Memoji-style avatar of a friendly person with neat hair and medium skin tone. Include head, shoulders, and hands with a welcoming gesture. casual attire. Soft rounded shapes, glossy textures, minimal modern style. Friendly face with warm eyes.';
  
  const useLocal = await question('🏠 Use local proxy? (y/n) [y]: ') !== 'n';
  
  log('blue', '🚀 Testing different sizes...');
  
  for (const size of sizes) {
    log('blue', `\n📐 Testing size: ${size}`);
    await generateMemoji(prompt, size, 'auto', useLocal);
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Switch backend
async function switchBackend(rl, question) {
  log('cyan', '\n🔄 Backend Configuration');
  log('cyan', '========================');
  
  log('blue', 'Current configuration:');
  log('blue', `- Local Proxy: ${LOCAL_PROXY_URL}`);
  log('blue', `- Production: ${PRODUCTION_URL}`);
  
  const choice = await question('\n🔢 Choose backend (1: Local, 2: Production) [1]: ') || '1';
  
  if (choice === '1') {
    log('green', '✅ Using local proxy backend');
  } else if (choice === '2') {
    log('green', '✅ Using production backend');
  } else {
    log('red', '❌ Invalid choice');
  }
}

// View generated files
async function viewGeneratedFiles() {
  log('cyan', '\n📁 Generated Files');
  log('cyan', '==================');
  
  if (!fs.existsSync(OUTPUT_DIR)) {
    log('yellow', '⚠️  No output directory found');
    return;
  }
  
  const files = fs.readdirSync(OUTPUT_DIR);
  const imageFiles = files.filter(file => file.endsWith('.png'));
  
  if (imageFiles.length === 0) {
    log('yellow', '⚠️  No generated images found');
    return;
  }
  
  log('green', `📸 Found ${imageFiles.length} generated images:`);
  imageFiles.forEach((file, index) => {
    const filepath = path.join(OUTPUT_DIR, file);
    const stats = fs.statSync(filepath);
    const sizeKB = Math.round(stats.size / 1024);
    log('blue', `${index + 1}. ${file} (${sizeKB}KB)`);
  });
}

// Run interactive CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  interactiveCLI().catch(console.error);
}

export { generateMemoji, interactiveCLI };
