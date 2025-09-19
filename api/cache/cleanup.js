import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }
  
  try {
    const supabase = getSupabase();
    
    // Clean up old cache entries (older than 90 days and used less than 2 times)
    const { data: deletedEntries, error: deleteError } = await supabase
      .from('memoji_cache')
      .delete()
      .lt('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .lt('usage_count', 2)
      .select('id');
      
    if (deleteError) {
      console.error('Error cleaning up old cache entries:', deleteError);
      return res.status(500).json({ error: { message: 'Failed to clean up cache' } });
    }
    
    // Archive popular memojis (used more than 100 times)
    const { data: archivedEntries, error: archiveError } = await supabase
      .from('memoji_cache')
      .update({ archived: true })
      .gt('usage_count', 100)
      .eq('archived', false)
      .select('id');
      
    if (archiveError) {
      console.error('Error archiving popular entries:', archiveError);
      return res.status(500).json({ error: { message: 'Failed to archive popular entries' } });
    }
    
    return res.status(200).json({
      success: true,
      cleanup: {
        deletedEntries: deletedEntries?.length || 0,
        archivedEntries: archivedEntries?.length || 0,
        message: 'Cache cleanup completed successfully'
      }
    });
    
  } catch (error) {
    console.error('Error in cache cleanup:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}
