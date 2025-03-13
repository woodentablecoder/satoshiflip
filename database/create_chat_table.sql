-- Chat Messages Table Schema for SatoshiFlip

-- Chat messages table
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  username TEXT, -- Store username separately for guest users
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create Row Level Security policies
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Everyone can view all chat messages
CREATE POLICY "Anyone can view chat messages" ON chat_messages
  FOR SELECT USING (true);

-- Users can insert their own chat messages
CREATE POLICY "Users can insert their own chat messages" ON chat_messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR 
    auth.uid() IS NULL -- Allow guest users
  );

-- Create an index for faster retrieval
CREATE INDEX chat_messages_created_at_idx ON chat_messages(created_at); 