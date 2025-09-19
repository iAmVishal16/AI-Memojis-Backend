-- Create memoji_cache table for storing generated memojis
CREATE TABLE public.memoji_cache (
  id SERIAL PRIMARY KEY,
  prompt_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of normalized prompt config
  image_url TEXT NOT NULL, -- Supabase Storage URL
  prompt_config JSONB NOT NULL, -- Original configuration for reference
  generation_cost DECIMAL(10,4) DEFAULT 0.02, -- Cost saved by cache hit (estimated $0.02 per generation)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  usage_count INTEGER DEFAULT 0, -- How many times this cache was used
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE -- For archiving popular memojis
);

-- Indexes for performance
CREATE INDEX idx_memoji_cache_hash ON public.memoji_cache(prompt_hash);
CREATE INDEX idx_memoji_cache_created_at ON public.memoji_cache(created_at);
CREATE INDEX idx_memoji_cache_usage_count ON public.memoji_cache(usage_count DESC);

-- Add RLS policies
ALTER TABLE public.memoji_cache ENABLE ROW LEVEL SECURITY;

-- Allow backend service to read/write cache
CREATE POLICY "Backend can manage memoji cache" ON public.memoji_cache
  FOR ALL USING (true) WITH CHECK (true);

-- Add updated_at trigger
CREATE TRIGGER update_memoji_cache_updated_at 
  BEFORE UPDATE ON public.memoji_cache 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
