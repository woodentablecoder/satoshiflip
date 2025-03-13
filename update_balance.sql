-- Update all users to have a specific balance amount
-- Replace 10000000 with the balance you want to set (in satoshis)

-- Option 1: Set all users to the same balance
UPDATE users 
SET balance = 10000000;

-- Option 2: If you want to give all users an additional amount
-- UPDATE users 
-- SET balance = balance + 10000000;

-- Option 3: Reset balances for testing purposes
-- UPDATE users 
-- SET balance = 
--   CASE 
--     WHEN id = 'specific-user-id-here' THEN 50000000
--     ELSE 10000000 
--   END;

-- Note: This needs to be run with admin privileges in Supabase SQL Editor
-- as it bypasses Row Level Security policies
