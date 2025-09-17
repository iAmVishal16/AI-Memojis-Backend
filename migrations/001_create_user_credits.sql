-- Create user_credits table for persistent credit storage
-- Run this in your Supabase SQL editor

CREATE TABLE IF NOT EXISTS user_credits (
  user_id TEXT PRIMARY KEY,
  current_month TEXT NOT NULL, -- Format: YYYY-MM
  credits_remaining INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'monthly_basic',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_credits_month ON user_credits(current_month);
CREATE INDEX IF NOT EXISTS idx_user_credits_tier ON user_credits(tier);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

-- Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON user_credits TO authenticated;
-- GRANT ALL ON user_credits TO service_role;
