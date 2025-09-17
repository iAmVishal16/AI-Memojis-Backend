// Credits Management API - Persistent storage for user credits
// Replaces in-memory userCreditsMap with Supabase database

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase env not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

// Credit limits per tier
const MONTHLY_CREDIT_LIMITS = {
  'free': 2,
  'monthly_basic': 100,
  'monthly_standard': 300,
  'monthly_pro': 1000,
  'monthly': 100, // Default for 'monthly' if specific tier not found
  'lifetime': Infinity // Lifetime users have unlimited credits
};

function getCreditsForTier(tier) {
  return MONTHLY_CREDIT_LIMITS[tier] || MONTHLY_CREDIT_LIMITS['monthly_basic'];
}

// Get user's current credit status
export async function getUserCredits(userId, subscriptionTier) {
  const supabase = getSupabase();
  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  
  try {
    // Try to get existing record
    const { data: existing, error } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
      console.error('Error fetching user credits:', error);
      throw error;
    }

    // If no record exists or tier/month changed, create/update
    if (!existing || existing.current_month !== currentMonth || existing.tier !== subscriptionTier) {
      const creditsRemaining = getCreditsForTier(subscriptionTier);
      
      const { data: upserted, error: upsertError } = await supabase
        .from('user_credits')
        .upsert({
          user_id: userId,
          current_month: currentMonth,
          credits_remaining: creditsRemaining,
          tier: subscriptionTier,
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id' })
        .select()
        .single();

      if (upsertError) {
        console.error('Error upserting user credits:', upsertError);
        throw upsertError;
      }

      return upserted;
    }

    return existing;
  } catch (error) {
    console.error('getUserCredits error:', error);
    // Fallback to default credits
    return {
      user_id: userId,
      current_month: currentMonth,
      credits_remaining: getCreditsForTier(subscriptionTier),
      tier: subscriptionTier
    };
  }
}

// Debit a credit from user's account
export async function debitCredit(userId, subscriptionTier) {
  const supabase = getSupabase();
  
  try {
    // Get current credits
    const userData = await getUserCredits(userId, subscriptionTier);
    
    if (userData.credits_remaining <= 0) {
      return false; // No credits available
    }

    // Debit one credit
    const { error } = await supabase
      .from('user_credits')
      .update({
        credits_remaining: userData.credits_remaining - 1,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error debiting credit:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('debitCredit error:', error);
    return false;
  }
}

// Reset credits for new month (called by webhook or cron job)
export async function resetMonthlyCredits(userId, subscriptionTier) {
  const supabase = getSupabase();
  const currentMonth = new Date().toISOString().slice(0, 7);
  const creditsRemaining = getCreditsForTier(subscriptionTier);
  
  try {
    const { error } = await supabase
      .from('user_credits')
      .upsert({
        user_id: userId,
        current_month: currentMonth,
        credits_remaining: creditsRemaining,
        tier: subscriptionTier,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (error) {
      console.error('Error resetting monthly credits:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('resetMonthlyCredits error:', error);
    return false;
  }
}

// API endpoint for credit operations
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { userId, subscriptionTier, action } = req.body || req.query || {};

    if (!userId || !subscriptionTier) {
      return res.status(400).json({ error: 'userId and subscriptionTier are required' });
    }

    switch (action) {
      case 'get':
        const credits = await getUserCredits(userId, subscriptionTier);
        return res.json({ credits });
      
      case 'debit':
        const success = await debitCredit(userId, subscriptionTier);
        return res.json({ success, creditsRemaining: success ? (await getUserCredits(userId, subscriptionTier)).credits_remaining : 0 });
      
      case 'reset':
        const resetSuccess = await resetMonthlyCredits(userId, subscriptionTier);
        return res.json({ success: resetSuccess });
      
      default:
        return res.status(400).json({ error: 'Invalid action. Use: get, debit, or reset' });
    }
  } catch (error) {
    console.error('Credits API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
