import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Generate a consistent hash for memoji configuration
 * This normalizes the config to ensure similar configurations get the same hash
 */
export function generatePromptHash(config) {
  // Normalize and sort configuration to ensure consistency
  const normalized = {
    model: config.model || 'gpt-image-1',
    size: config.size || '1024x1024',
    familyType: config.familyType || 'father',
    gesture: config.gesture || 'wave',
    hair: (config.hair || 'short').toLowerCase(),
    skinTone: (config.skinTone || 'medium').toLowerCase(),
    accessories: (config.accessories || []).sort(), // Sort to ensure consistent order
    colorTheme: config.colorTheme || 'pastel-blue',
    background: config.background || 'auto'
  };
  
  // Generate SHA-256 hash of the normalized configuration
  const configString = JSON.stringify(normalized);
  return crypto.createHash('sha256')
    .update(configString)
    .digest('hex');
}

/**
 * Check if a memoji with this configuration already exists in cache
 */
export async function checkMemojiCache(promptHash) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('memoji_cache')
      .select('*')
      .eq('prompt_hash', promptHash)
      .eq('archived', false)
      .single();
      
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking memoji cache:', error);
      return null;
    }
    
    return data;
  } catch (error) {
    console.error('Error in checkMemojiCache:', error);
    return null;
  }
}

/**
 * Store a generated memoji in cache
 */
export async function storeInCache(cacheData) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('memoji_cache')
      .insert({
        prompt_hash: cacheData.promptHash,
        image_url: cacheData.imageUrl,
        prompt_config: cacheData.config,
        generation_cost: cacheData.cost || 0.02,
        usage_count: 1,
        last_used_at: new Date().toISOString()
      })
      .select()
      .single();
      
    if (error) {
      console.error('Error storing in cache:', error);
      return null;
    }
    
    console.log('Memoji cached successfully:', cacheData.promptHash);
    return data;
  } catch (error) {
    console.error('Error in storeInCache:', error);
    return null;
  }
}

/**
 * Update cache usage statistics when a cached memoji is used
 */
export async function updateCacheUsage(promptHash) {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .rpc('increment_memoji_usage', { hash: promptHash });
      
    if (error) {
      console.error('Error updating cache usage:', error);
      return null;
    }
    
    console.log('Cache usage increment RPC ok for:', promptHash);
    return data?.[0] ?? null;
  } catch (error) {
    console.error('Error in updateCacheUsage:', error);
    return null;
  }
}

/**
 * Upload image to Supabase Storage
 */
export async function uploadToStorage(imageData, promptHash) {
  try {
    const supabase = getSupabase();
    
    // Create organized folder structure: YYYY/MM/hash.png
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const fileName = `${promptHash}.png`;
    const path = `${year}/${month}/${fileName}`;
    
    // Convert base64 to buffer if needed
    let buffer;
    if (typeof imageData === 'string') {
      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    } else {
      buffer = imageData;
    }
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('memoji-images')
      .upload(path, buffer, {
        contentType: 'image/png',
        upsert: true // Overwrite if exists
      });
      
    if (error) {
      console.error('Error uploading to storage:', error);
      throw error;
    }
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('memoji-images')
      .getPublicUrl(path);
      
    console.log('Image uploaded successfully:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadToStorage:', error);
    throw error;
  }
}

/**
 * Get cache statistics for monitoring
 */
export async function getCacheStats() {
  try {
    const supabase = getSupabase();
    
    const { data, error } = await supabase
      .from('memoji_cache')
      .select('usage_count, generation_cost')
      .eq('archived', false);
      
    if (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
    
    const stats = {
      totalCached: data.length,
      totalUsage: data.reduce((sum, item) => sum + item.usage_count, 0),
      totalCostSaved: data.reduce((sum, item) => sum + (item.usage_count * item.generation_cost), 0)
    };
    
    return stats;
  } catch (error) {
    console.error('Error in getCacheStats:', error);
    return null;
  }
}
