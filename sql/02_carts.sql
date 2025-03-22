-- Carts Table
CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  checkout_at TIMESTAMPTZ
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS carts_user_id_idx ON carts(user_id);
CREATE INDEX IF NOT EXISTS carts_status_idx ON carts(status);

-- RLS Policies for carts
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

-- Define a constant for the demo user ID
CREATE OR REPLACE FUNCTION get_demo_user_id() RETURNS UUID AS $$
  BEGIN
    RETURN '550e8400-e29b-41d4-a716-446655440000'::UUID;
  END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Policy: Users can only see their own carts or demo user can see carts with their ID
CREATE POLICY "Users can view their own carts"
  ON carts FOR SELECT
  USING (auth.uid() = user_id OR user_id = get_demo_user_id());

-- Policy: Users can insert their own carts or carts for the demo user
CREATE POLICY "Users can insert their own carts"
  ON carts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id = get_demo_user_id());

-- Policy: Users can update their own carts or the demo user's carts
CREATE POLICY "Users can update their own carts"
  ON carts FOR UPDATE
  USING (auth.uid() = user_id OR user_id = get_demo_user_id())
  WITH CHECK (auth.uid() = user_id OR user_id = get_demo_user_id());

-- Policy: Users can delete their own carts or the demo user's carts
CREATE POLICY "Users can delete their own carts"
  ON carts FOR DELETE
  USING (auth.uid() = user_id OR user_id = get_demo_user_id()); 