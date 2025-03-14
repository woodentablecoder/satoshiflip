-- SatoshiFlip Database Schema for Supabase

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT UNIQUE NOT NULL,
  btc_address TEXT UNIQUE NOT NULL,
  balance BIGINT DEFAULT 0, -- Stored in satoshis
  created_at TIMESTAMP DEFAULT NOW()
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player1_id UUID REFERENCES users(id),
  player2_id UUID REFERENCES users(id),
  wager_amount BIGINT NOT NULL, -- In satoshis
  team_choice TEXT CHECK (team_choice IN ('heads', 'tails')), -- Creator's choice
  status TEXT CHECK (status IN ('pending', 'active', 'completed')),
  winner_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  amount BIGINT NOT NULL, -- In satoshis, negative for withdrawals
  type TEXT CHECK (type IN ('deposit', 'withdrawal', 'wager', 'win')),
  status TEXT CHECK (status IN ('pending', 'completed', 'failed')),
  tx_hash TEXT, -- Blockchain transaction hash when applicable
  created_at TIMESTAMP DEFAULT NOW()
);

-- RPC function to update balance
CREATE OR REPLACE FUNCTION update_balance(user_id UUID, amount BIGINT)
RETURNS VOID AS $$
BEGIN
  UPDATE users 
  SET balance = balance + amount
  WHERE id = user_id;
  
  INSERT INTO transactions (user_id, amount, type, status)
  VALUES (user_id, amount, 
    CASE WHEN amount > 0 THEN 'win' ELSE 'wager' END,
    'completed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to create a user record (bypasses RLS)
CREATE OR REPLACE FUNCTION create_user_record(user_id UUID, user_email TEXT, user_btc_address TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (id, email, btc_address, balance)
  VALUES (user_id, user_email, user_btc_address, 0)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to create a game
DROP FUNCTION IF EXISTS public.create_game;
CREATE OR REPLACE FUNCTION public.create_game(user_id UUID, amount BIGINT, team_choice TEXT)
RETURNS UUID AS $$
DECLARE
  game_id UUID;
BEGIN
  -- Check balance
  IF (SELECT balance FROM users WHERE id = user_id) < amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  -- Validate team choice
  IF team_choice NOT IN ('heads', 'tails') THEN
    RAISE EXCEPTION 'Invalid team choice. Must be heads or tails.';
  END IF;

  -- Deduct wager from balance
  UPDATE users SET balance = balance - amount WHERE id = user_id;
  
  -- Record transaction
  INSERT INTO transactions (user_id, amount, type, status)
  VALUES (user_id, -amount, 'wager', 'completed');
  
  -- Create game
  INSERT INTO games (player1_id, wager_amount, team_choice, status)
  VALUES (user_id, amount, team_choice, 'pending')
  RETURNING id INTO game_id;
  
  RETURN game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to join a game
CREATE OR REPLACE FUNCTION join_game(user_id UUID, game_id UUID)
RETURNS JSON AS $$
DECLARE
  game_data games;
  wager_amount BIGINT;
  winner_id UUID;
  result JSON;
  flip_result TEXT;
BEGIN
  -- Get game data
  SELECT * INTO game_data FROM games WHERE id = game_id;
  
  -- Check if game exists and is pending
  IF game_data IS NULL THEN
    RAISE EXCEPTION 'Game not found';
  END IF;
  
  IF game_data.status != 'pending' THEN
    RAISE EXCEPTION 'Game is no longer available';
  END IF;
  
  IF game_data.player1_id = user_id THEN
    RAISE EXCEPTION 'Cannot join your own game';
  END IF;
  
  wager_amount := game_data.wager_amount;
  
  -- Check balance
  IF (SELECT balance FROM users WHERE id = user_id) < wager_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;
  
  -- Deduct wager from balance
  UPDATE users SET balance = balance - wager_amount WHERE id = user_id;
  
  -- Record transaction
  INSERT INTO transactions (user_id, amount, type, status)
  VALUES (user_id, -wager_amount, 'wager', 'completed');
  
  -- Perform 50/50 coinflip (random function)
  flip_result := CASE WHEN random() < 0.5 THEN 'heads' ELSE 'tails' END;
  
  -- Determine winner based on flip result and team choice
  IF flip_result = game_data.team_choice THEN
    winner_id := game_data.player1_id; -- Creator wins
  ELSE
    winner_id := user_id; -- Joiner wins
  END IF;
  
  -- Update game
  UPDATE games SET 
    player2_id = user_id,
    status = 'completed',
    winner_id = winner_id,
    completed_at = NOW()
  WHERE id = game_id;
  
  -- Award winnings to winner (twice the wager)
  PERFORM update_balance(winner_id, wager_amount * 2);
  
  -- Prepare result
  SELECT json_build_object(
    'winner_id', winner_id,
    'amount', wager_amount * 2,
    'flip_result', flip_result
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a cancel_game function to safely cancel games
CREATE OR REPLACE FUNCTION cancel_game(user_id UUID, game_id UUID)
RETURNS TABLE (success BOOLEAN, game_id UUID) AS $$
DECLARE
    _game_record RECORD;
BEGIN
    -- First, check that the game exists, is pending, and belongs to the user
    SELECT * INTO _game_record 
    FROM games 
    WHERE id = game_id 
      AND player1_id = user_id
      AND status = 'pending';
      
    IF NOT FOUND THEN
        -- Game not found or user is not the creator or game not pending
        RETURN QUERY SELECT FALSE, NULL::UUID;
        RETURN;
    END IF;
    
    -- Delete the game
    DELETE FROM games 
    WHERE id = game_id 
      AND player1_id = user_id
      AND status = 'pending';
      
    -- Return success status and game_id
    RETURN QUERY SELECT TRUE, game_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Row Level Security policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- User policies
CREATE POLICY "Users can view their own data" ON users
  FOR SELECT USING (auth.uid() = id);

-- Add INSERT policy for users
CREATE POLICY "Users can insert their own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Game policies
CREATE POLICY "Anyone can view pending games" ON games
  FOR SELECT USING (status = 'pending');
  
CREATE POLICY "Users can view their own games" ON games
  FOR SELECT USING (auth.uid() = player1_id OR auth.uid() = player2_id);
  
CREATE POLICY "Users can create games" ON games
  FOR INSERT WITH CHECK (auth.uid() = player1_id);

-- Add DELETE policy for games
CREATE POLICY "Users can cancel their own pending games" ON games
  FOR DELETE USING (auth.uid() = player1_id AND status = 'pending');

-- Transaction policies
CREATE POLICY "Users can view their own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id); 