-- Create users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create analysis history table
CREATE TABLE IF NOT EXISTS analysis_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  input_type TEXT NOT NULL, -- 'text', 'url', 'file'
  original_content TEXT NOT NULL,
  content_preview TEXT,
  
  -- Analysis Results
  verdict TEXT NOT NULL, -- 'REAL', 'FAKE', 'UNVERIFIED'
  confidence_score FLOAT NOT NULL, -- 0-100
  explanation TEXT,
  
  -- Supporting Data
  key_entities JSONB,
  sentiment_score FLOAT,
  source_credibility FLOAT,
  fact_check_results JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_analysis_history_user_id ON analysis_history(user_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_created_at ON analysis_history(created_at DESC);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for users table
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for analysis_history table
CREATE POLICY "Users can view own history" ON analysis_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analysis" ON analysis_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analysis" ON analysis_history
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own analysis" ON analysis_history
  FOR DELETE USING (auth.uid() = user_id);
