/**
 * Script to update chat usernames in the database
 * This will extract the username part from email addresses
 */

const { createClient } = require('@supabase/supabase-js');

// Supabase project credentials
const SUPABASE_URL = 'https://iyoldnkgdtfomcbgfufq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b2xkbmtnZHRmb21jYmdmdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTU0NTAsImV4cCI6MjA1NzQ3MTQ1MH0.gZBLUY5IJXWYUZbSVDRHSxNVvFRxxMSHCfoL0lI8Ig0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateChatUsernames() {
  console.log('Starting chat username update...');
  
  try {
    // First, update any null usernames to 'Anonymous'
    const { data: nullData, error: nullError } = await supabase.rpc('run_sql', {
      sql: `UPDATE public.chat_messages SET username = 'Anonymous' WHERE username IS NULL;`
    });
    
    if (nullError) {
      console.error('Error updating null usernames:', nullError);
    } else {
      console.log('Updated null usernames to "Anonymous"');
    }
    
    // Then, update email usernames to just use the part before the @
    const { data: emailData, error: emailError } = await supabase.rpc('run_sql', {
      sql: `UPDATE public.chat_messages SET username = SPLIT_PART(username, '@', 1) WHERE username LIKE '%@%';`
    });
    
    if (emailError) {
      console.error('Error updating email usernames:', emailError);
    } else {
      console.log('Updated email usernames to use just the username part');
    }
    
    console.log('Chat username update completed successfully!');
  } catch (error) {
    console.error('Unexpected error during update:', error);
  }
}

// Run the update function
updateChatUsernames();