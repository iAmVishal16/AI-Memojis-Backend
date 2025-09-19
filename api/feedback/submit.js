import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method not allowed' } });
  }

  try {
    const { userId, rating, reviewComment } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({ error: { message: 'userId is required' } });
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return res.status(400).json({ error: { message: 'rating must be a number between 1 and 5' } });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return res.status(500).json({ error: { message: 'Server configuration error' } });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

    // Check if user already submitted feedback
    const { data: existingFeedback, error: checkError } = await supabase
      .from('feedback')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking existing feedback:', checkError);
      return res.status(500).json({ error: { message: 'Failed to check existing feedback' } });
    }

    if (existingFeedback) {
      return res.status(400).json({ error: { message: 'Feedback already submitted for this user' } });
    }

    // Insert feedback
    const { data, error } = await supabase
      .from('feedback')
      .insert({
        user_id: userId,
        rating: rating,
        review_comment: reviewComment || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting feedback:', error);
      return res.status(500).json({ error: { message: 'Failed to submit feedback' } });
    }

    return res.status(200).json({
      success: true,
      feedback: data
    });

  } catch (error) {
    console.error('Unexpected error in feedback submission:', error);
    return res.status(500).json({ error: { message: 'Internal server error' } });
  }
}
