-- Migration to add flip_result column to games table
ALTER TABLE games 
ADD COLUMN IF NOT EXISTS flip_result TEXT CHECK (flip_result IN ('heads', 'tails'));

-- Notify in logs that migration completed
DO $$
BEGIN
  RAISE NOTICE 'Successfully added flip_result column to games table';
END $$; 