// Supabase Node.js client
const { createClient } = require('@supabase/supabase-js');

// Supabase project credentials
const SUPABASE_URL = 'https://iyoldnkgdtfomcbgfufq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b2xkbmtnZHRmb21jYmdmdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTU0NTAsImV4cCI6MjA1NzQ3MTQ1MH0.gZBLUY5IJXWYUZbSVDRHSxNVvFRxxMSHCfoL0lI8Ig0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// User ID to delete
const userIdToDelete = '2b6552f1-4734-4489-aa2f-314b156d755f';

async function deleteUser() {
  console.log(`Attempting to delete user with ID: ${userIdToDelete}`);
  
  try {
    // First, delete from the auth.users table (this requires admin privileges)
    // Note: This may fail if you don't have admin privileges in Supabase
    const authResult = await supabase.auth.admin.deleteUser(userIdToDelete);
    
    if (authResult.error) {
      console.error('Error deleting from auth.users:', authResult.error.message);
      console.log('Continuing with deletion from custom tables...');
    } else {
      console.log('Successfully deleted user from auth.users');
    }
    
    // Next, delete from your custom users table
    const usersResult = await supabase
      .from('users')
      .delete()
      .eq('id', userIdToDelete);
    
    if (usersResult.error) {
      console.error('Error deleting from users table:', usersResult.error.message);
    } else {
      console.log('Successfully deleted user from users table');
    }
    
    // Delete related data - games created by the user
    const gamesResult = await supabase
      .from('games')
      .delete()
      .eq('player1_id', userIdToDelete);
    
    if (gamesResult.error) {
      console.error('Error deleting user games:', gamesResult.error.message);
    } else {
      console.log('Successfully deleted user games');
    }
    
    // Delete games where the user was player2
    const joinedGamesResult = await supabase
      .from('games')
      .delete()
      .eq('player2_id', userIdToDelete);
    
    if (joinedGamesResult.error) {
      console.error('Error deleting joined games:', joinedGamesResult.error.message);
    } else {
      console.log('Successfully deleted joined games');
    }
    
    console.log('User deletion process completed');
  } catch (error) {
    console.error('Unexpected error during user deletion:', error.message);
  }
}

// Run the deletion function
deleteUser(); 