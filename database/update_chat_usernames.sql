-- Update existing chat messages with email usernames
-- This will extract the username part from email addresses

-- First, update any null usernames to 'Anonymous'
UPDATE public.chat_messages
SET username = 'Anonymous'
WHERE username IS NULL;

-- Then, update email usernames to just use the part before the @
UPDATE public.chat_messages
SET username = SPLIT_PART(username, '@', 1)
WHERE username LIKE '%@%'; 