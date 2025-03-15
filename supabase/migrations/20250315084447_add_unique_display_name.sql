-- Add unique constraint to display_name column in users table
-- First, make sure any NULL values are handled (NULL values don't violate uniqueness constraints)
-- and make sure there are no duplicate display names

-- Create a function to handle duplicate display names
CREATE OR REPLACE FUNCTION handle_duplicate_display_names()
RETURNS void AS $$
DECLARE
    duplicate_record RECORD;
BEGIN
    -- Find records with duplicate display names (excluding NULLs)
    FOR duplicate_record IN 
        SELECT display_name, array_agg(id) as user_ids
        FROM users
        WHERE display_name IS NOT NULL
        GROUP BY display_name
        HAVING COUNT(*) > 1
    LOOP
        -- Keep the first user's display name, append a random suffix to others
        FOR i IN 2..array_length(duplicate_record.user_ids, 1) LOOP
            UPDATE users
            SET display_name = display_name || '-' || floor(random() * 10000)::text
            WHERE id = duplicate_record.user_ids[i];
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute the function to handle duplicates
SELECT handle_duplicate_display_names();

-- Drop the function after use
DROP FUNCTION handle_duplicate_display_names();

-- Now add the unique constraint
ALTER TABLE users ADD CONSTRAINT unique_display_name UNIQUE (display_name);

-- Update the create_user_record function to handle the unique constraint
CREATE OR REPLACE FUNCTION create_user_record(user_id UUID, user_email TEXT, user_btc_address TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO users (id, email, btc_address, balance, display_name)
  VALUES (user_id, user_email, user_btc_address, 0, NULL)
  ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 