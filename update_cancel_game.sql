-- Add DELETE policy for games
CREATE POLICY IF NOT EXISTS "Users can cancel their own pending games" ON games
  FOR DELETE USING (auth.uid() = player1_id AND status = 'pending');

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

-- Verification query to check if policy exists (informational)
SELECT table_name, 
       policy_name, 
       permissive,
       roles,
       cmd,
       qual
FROM pg_policies
WHERE tablename = 'games'
AND policyname = 'Users can cancel their own pending games'; 