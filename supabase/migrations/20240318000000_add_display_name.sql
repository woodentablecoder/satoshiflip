-- Add display_name column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Create an index on display_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_display_name ON users(display_name);

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can update their own display_name" ON users;
DROP POLICY IF EXISTS "Anyone can view display_names" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Enable update for users based on id" ON users;

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policies with proper UUID handling
CREATE POLICY "Enable read access for all users"
    ON users FOR SELECT
    USING (true);

CREATE POLICY "Enable update for users based on id"
    ON users FOR UPDATE
    USING (auth.uid() = id::uuid)
    WITH CHECK (auth.uid() = id::uuid);

-- Grant necessary permissions
GRANT UPDATE (display_name) ON users TO authenticated; 