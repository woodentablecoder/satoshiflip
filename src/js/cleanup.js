/**
 * One-time cleanup script for SatoshiFlip
 * This script deletes specific users and all games from the database
 * Run this script with Node.js directly
 */

// Import the supabase client
const { createClient } = require('@supabase/supabase-js');

// Supabase project credentials - same as in supabase.js
const SUPABASE_URL = 'https://iyoldnkgdtfomcbgfufq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b2xkbmtnZHRmb21jYmdmdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTU0NTAsImV4cCI6MjA1NzQ3MTQ1MH0.gZBLUY5IJXWYUZbSVDRHSxNVvFRxxMSHCfoL0lI8Ig0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Users to delete
const userIdsToDelete = [
  '29abc1d4-9a4d-4180-9b59-2b3cfab77bfc',
  '2b6552f1-4734-4489-aa2f-314b156d755f'
];

// Function to delete specific users
async function deleteSpecificUsers() {
  console.log('Starting deletion of specific users...');
  
  try {
    for (const userId of userIdsToDelete) {
      console.log(`Deleting user: ${userId}`);
      
      // Delete the user from the users table
      const { error: userDeletionError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (userDeletionError) {
        console.error(`Error deleting user ${userId} from users table:`, userDeletionError);
      } else {
        console.log(`User ${userId} successfully deleted from users table`);
      }
      
      // Note: Deleting from auth.users typically requires admin rights and might not work with the anon key
    }
    
    console.log('User deletion complete');
  } catch (error) {
    console.error('Error in deleteSpecificUsers:', error);
  }
}

// Function to delete all games
async function deleteAllGames() {
  console.log('Starting deletion of all games...');
  
  try {
    // Delete all games from the games table
    const { error: gameDeletionError } = await supabase
      .from('games')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all games (using a dummy condition)
    
    if (gameDeletionError) {
      console.error('Error deleting all games:', gameDeletionError);
    } else {
      console.log('All games successfully deleted');
    }
  } catch (error) {
    console.error('Error in deleteAllGames:', error);
  }
}

// Main cleanup function
async function performCleanup() {
  console.log('Starting database cleanup...');
  
  try {
    // First delete games that might reference the users
    await deleteAllGames();
    
    // Then delete the specific users
    await deleteSpecificUsers();
    
    console.log('Cleanup completed successfully');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup
performCleanup().then(() => {
  console.log('Cleanup process complete.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error during cleanup:', error);
  process.exit(1);
}); 