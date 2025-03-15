# Database Setup Instructions

To set up the database for SatoshiFlip, follow these steps:

1. Log in to your Supabase dashboard
2. Go to the SQL Editor
3. Run the SQL scripts in the following order:

## 1. Create the chat_messages table

Run the `create_chat_table.sql` script to create the chat_messages table with the necessary columns and permissions.

## 2. Add additional columns (if needed)

If you want to add additional columns for tip functionality, run the `add_chat_columns.sql` script.

## Troubleshooting

If you encounter errors related to missing columns:

1. Check the table schema in the Supabase dashboard
2. Make sure the table has the following columns:
   - id (UUID, primary key)
   - user_id (UUID, references auth.users.id)
   - username (TEXT)
   - message (TEXT)
   - created_at (TIMESTAMPTZ)
   - updated_at (TIMESTAMPTZ)

For tip functionality, the following columns are also needed:
   - is_tip (BOOLEAN)
   - tip_amount (INTEGER)
   - tip_recipient_id (UUID, references auth.users.id) 