// Supabase Node.js client
const { createClient } = require('@supabase/supabase-js');

// Supabase project credentials
const SUPABASE_URL = 'https://iyoldnkgdtfomcbgfufq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b2xkbmtnZHRmb21jYmdmdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTU0NTAsImV4cCI6MjA1NzQ3MTQ1MH0.gZBLUY5IJXWYUZbSVDRHSxNVvFRxxMSHCfoL0lI8Ig0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function cleanupOrphanedGames() {
  try {
    console.log('Starting cleanup of orphaned games...');
    
    // First get all games with pending status
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select(`
        id,
        player1_id,
        users:player1_id (id)
      `)
      .eq('status', 'pending');
    
    if (gamesError) {
      console.error('Error fetching games for cleanup:', gamesError);
      return { success: false, error: gamesError.message };
    }
    
    // Find orphaned games (where the user reference is null)
    const orphanedGameIds = games
      .filter(game => !game.users || !game.users.id)
      .map(game => game.id);
    
    console.log(`Found ${orphanedGameIds.length} orphaned games to clean up`);
    
    if (orphanedGameIds.length === 0) {
      return { success: true, message: 'No orphaned games found' };
    }
    
    console.log('Orphaned game IDs:');
    orphanedGameIds.forEach(id => console.log(`- ${id}`));
    
    // Ask for confirmation before deleting
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    const answer = await new Promise(resolve => {
      rl.question(`Delete ${orphanedGameIds.length} orphaned games? (yes/no): `, resolve);
    });
    
    rl.close();
    
    if (answer.toLowerCase() !== 'yes') {
      console.log('Cleanup cancelled by user');
      return { success: false, message: 'Cleanup cancelled by user' };
    }
    
    // Delete the orphaned games
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .in('id', orphanedGameIds);
    
    if (deleteError) {
      console.error('Error deleting orphaned games:', deleteError);
      return { success: false, error: deleteError.message };
    }
    
    console.log(`Successfully cleaned up ${orphanedGameIds.length} orphaned games`);
    return { 
      success: true, 
      message: `Successfully cleaned up ${orphanedGameIds.length} orphaned games`,
      deletedIds: orphanedGameIds
    };
  } catch (error) {
    console.error('Error in cleanupOrphanedGames:', error);
    return { success: false, error: error.message };
  }
}

// Run the cleanup function
cleanupOrphanedGames()
  .then(result => {
    console.log('Cleanup completed:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error during cleanup:', error);
    process.exit(1);
  }); 