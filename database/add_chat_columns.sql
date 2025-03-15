-- Add missing columns to chat_messages table
ALTER TABLE IF EXISTS public.chat_messages
ADD COLUMN IF NOT EXISTS is_tip BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS tip_amount INTEGER,
ADD COLUMN IF NOT EXISTS tip_recipient_id UUID REFERENCES auth.users(id);

-- Comment on columns
COMMENT ON COLUMN public.chat_messages.is_tip IS 'Whether this message is a tip';
COMMENT ON COLUMN public.chat_messages.tip_amount IS 'Amount of the tip in satoshis';
COMMENT ON COLUMN public.chat_messages.tip_recipient_id IS 'User ID of the tip recipient';

-- Add these columns only if needed (they should already exist in the table)
ALTER TABLE IF EXISTS public.chat_messages
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(); 