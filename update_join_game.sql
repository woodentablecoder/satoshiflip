-- Updated join_game function to avoid column ambiguity
CREATE OR REPLACE FUNCTION join_game(user_id UUID, game_id UUID)
RETURNS JSON AS $$
DECLARE
  game_data games;
  wager_amount BIGINT;
  w_id UUID; -- Renamed from winner_id to avoid ambiguity
  result JSON;
  flip_result_value TEXT;
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
  flip_result_value := CASE WHEN random() < 0.5 THEN 'heads' ELSE 'tails' END;
  
  -- Determine winner based on flip result and team choice
  IF flip_result_value = game_data.team_choice THEN
    w_id := game_data.player1_id; -- Creator wins
  ELSE
    w_id := user_id; -- Joiner wins
  END IF;
  
  -- Update game
  UPDATE games SET 
    player2_id = user_id,
    status = 'completed',
    winner_id = w_id,
    flip_result = flip_result_value,
    completed_at = NOW()
  WHERE id = game_id;
  
  -- Award winnings to winner (twice the wager)
  PERFORM update_balance(w_id, wager_amount * 2);
  
  -- Prepare result
  SELECT json_build_object(
    'winner_id', w_id,
    'amount', wager_amount * 2,
    'flip_result', flip_result_value
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
