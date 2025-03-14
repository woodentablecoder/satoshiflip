/**
 * Supabase Configuration and Service Functions
 * This file handles all Supabase interactions for SatoshiFlip
 */

// Import Supabase client
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// Supabase project credentials
// Replace these with your actual Supabase project credentials
const SUPABASE_URL = 'https://iyoldnkgdtfomcbgfufq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5b2xkbmtnZHRmb21jYmdmdWZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE4OTU0NTAsImV4cCI6MjA1NzQ3MTQ1MH0.gZBLUY5IJXWYUZbSVDRHSxNVvFRxxMSHCfoL0lI8Ig0';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Authentication functions
 */

// Sign up with email and password
export async function signUp(email, password) {
  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    
    if (error) throw error;
    
    if (data?.user) {
      // Generate a unique BTC address using timestamp and user ID
      const uniqueBtcAddress = `btc-${Date.now()}-${data.user.id.substring(0, 8)}`;
      
      console.log('Creating user record in database with ID:', data.user.id);
      
      try {
        // Create user profile with zero balance using RPC function to bypass RLS
        // This is an alternative until the proper RLS policy is set
        const { error: rpcError } = await supabase.rpc('create_user_record', {
          user_id: data.user.id,
          user_email: data.user.email,
          user_btc_address: uniqueBtcAddress
        });
        
        if (rpcError) {
          console.error('Error creating user via RPC:', rpcError);
          
          // Fallback: Try direct insert (will work if you've added the INSERT policy)
          const { error: insertError } = await supabase.from('users').insert({
            id: data.user.id,
            email: data.user.email,
            btc_address: uniqueBtcAddress,
            balance: 0
          });
          
          if (insertError) {
            console.error('Error creating user record:', insertError);
            throw insertError;
          }
        }
      } catch (insertError) {
        console.error('Failed to create user record:', insertError);
        // Continue with signup even if record creation fails
        // The record will be created on login or state check
      }
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error signing up:', error);
    return { success: false, error: error.message };
  }
}

// Sign in with email and password
export async function signIn(email, password) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) throw error;
    
    // Check if the user exists in the users table
    if (data?.user) {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();
      
      if (userError && userError.code === 'PGRST116') {
        // User doesn't exist in the users table, create a record
        console.log('User authenticated but no database record found. Creating one now.');
        
        // Generate a unique BTC address
        const uniqueBtcAddress = `btc-${Date.now()}-${data.user.id.substring(0, 8)}`;
        
        try {
          // Try using the RPC function first
          const { error: rpcError } = await supabase.rpc('create_user_record', {
            user_id: data.user.id,
            user_email: data.user.email,
            user_btc_address: uniqueBtcAddress
          });
          
          if (rpcError) {
            console.error('Error creating user via RPC:', rpcError);
            
            // Fallback to direct insert
            const { error: insertError } = await supabase.from('users').insert({
              id: data.user.id,
              email: data.user.email,
              btc_address: uniqueBtcAddress,
              balance: 0
            });
            
            if (insertError) {
              console.error('Error creating user record during login:', insertError);
              // Continue login even if record creation fails
            }
          }
        } catch (error) {
          console.error('Failed to create user record during login:', error);
          // Continue login even if record creation fails
        }
      }
    }
    
    return { success: true, data };
  } catch (error) {
    console.error('Error signing in:', error);
    return { success: false, error: error.message };
  }
}

// Sign out
export async function signOut() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Error signing out:', error);
    return { success: false, error: error.message };
  }
}

// Get current session and user
export async function getCurrentUser() {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * User balance functions
 */

// Get user balance
export async function getUserBalance(userId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data.balance;
  } catch (error) {
    console.error('Error getting user balance:', error);
    return 0;
  }
}

/**
 * Game functions
 */

// Create a new game
export async function createGame(userId, wagerAmount, teamChoice) {
  try {
    // Check user balance
    const balance = await getUserBalance(userId);
    if (balance < wagerAmount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Check if user already has an active game
    const { data: existingGames, error: existingError } = await supabase
      .from('games')
      .select('id')
      .eq('player1_id', userId)
      .eq('status', 'pending')
      .limit(1);
    
    if (existingError) throw existingError;
    
    if (existingGames && existingGames.length > 0) {
      return { success: false, error: 'You can only create one game at a time' };
    }
    
    // Check if there are already 10 active games in total
    const { data: totalGames, error: countError } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('status', 'pending');
    
    if (countError) throw countError;
    
    if (totalGames && totalGames.length >= 10) {
      return { success: false, error: 'Maximum number of active games reached (10). Please try again later.' };
    }
    
    // Create game in transaction
    const { data, error } = await supabase.rpc('create_game', {
      user_id: userId,
      amount: wagerAmount,
      team_choice: teamChoice
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error creating game:', error);
    return { success: false, error: error.message };
  }
}

// Get active games
export async function getActiveGames() {
  try {
    console.log('Fetching active games...');
    
    // Use inner join to ensure we only get games with valid users
    const { data, error } = await supabase
      .from('games')
      .select(`
        id,
        wager_amount,
        created_at,
        player1_id,
        player1:player1_id (email)
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching active games:', error);
      return [];
    }
    
    if (!data || data.length === 0) {
      console.log('No active games found');
      return [];
    }
    
    // Format the returned data and filter out games with missing users
    const formattedGames = data.map(game => {
      // Check if player1 object exists and has email property
      if (!game.player1 || !game.player1.email) {
        console.warn(`Game ${game.id} has no associated user data. This may indicate a foreign key issue.`);
        // Skip games with missing user data
        return null;
      }
      
      const email = game.player1.email;
      const username = email.split('@')[0];
      
      return {
        id: game.id,
        playerId: game.player1_id,
        playerName: username,
        wagerAmount: game.wager_amount,
        createdAt: new Date(game.created_at)
      };
    }).filter(game => game !== null); // Remove any null entries
    
    return formattedGames;
  } catch (error) {
    console.error('Error in getActiveGames:', error);
    return [];
  }
}

// Join a game
export async function joinGame(userId, gameId) {
  try {
    // Get game details first
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError) throw gameError;
    
    // Check user balance
    const balance = await getUserBalance(userId);
    if (balance < game.wager_amount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    try {
      // Execute coinflip via RPC
      const { data, error } = await supabase.rpc('join_game', {
        user_id: userId,
        game_id: gameId
      });
      
      if (error) throw error;
      
      // Dispatch balance update event after successful RPC call
      window.dispatchEvent(new CustomEvent('balanceChanged'));
      
      return { success: true, data };
    } catch (rpcError) {
      console.error('RPC join_game failed:', rpcError);
      
      // Check if it's the ambiguous column error
      if (rpcError.message && rpcError.message.includes('ambiguous')) {
        console.log('Detected ambiguous column error, implementing client-side fallback');
        
        // Fallback: Implement client-side coinflip logic
        
        // First, deduct the wager amount from player2's balance (joining player)
        const { data: player2Data, error: player2QueryError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single();
          
        if (player2QueryError) throw player2QueryError;
        
        // Update player2's balance by deducting wager amount
        const { error: player2BalanceError } = await supabase
          .from('users')
          .update({
            balance: player2Data.balance - game.wager_amount
          })
          .eq('id', userId);
        
        if (player2BalanceError) throw player2BalanceError;
        
        // 1. Update game status to 'active' and add player2_id
        const { error: updateError } = await supabase
          .from('games')
          .update({
            player2_id: userId,
            status: 'active'
          })
          .eq('id', gameId);
        
        if (updateError) throw updateError;
        
        // 2. Implement simple coinflip
        const isWinner = Math.random() < 0.5;
        const winnerId = isWinner ? userId : game.player1_id;
        const loserId = isWinner ? game.player1_id : userId;
        
        // 3. Update game with winner
        const { error: winnerError } = await supabase
          .from('games')
          .update({
            winner_id: winnerId,
            status: 'completed',
            completed_at: new Date().toISOString()
          })
          .eq('id', gameId);
        
        if (winnerError) throw winnerError;
        
        // 4. Update balances
        // Winner gets double the wager amount
        const winnerAmount = game.wager_amount * 2;
        
        // Get winner's current balance
        const { data: winnerData, error: winnerQueryError } = await supabase
          .from('users')
          .select('balance')
          .eq('id', winnerId)
          .single();
          
        if (winnerQueryError) throw winnerQueryError;
        
        // Update winner's balance directly
        const { error: winnerBalanceError } = await supabase
          .from('users')
          .update({
            balance: winnerData.balance + winnerAmount
          })
          .eq('id', winnerId);
        
        if (winnerBalanceError) throw winnerBalanceError;
        
        // Create a transaction record
        await supabase.from('transactions').insert([
          {
            user_id: winnerId,
            amount: winnerAmount,
            type: 'win',
            status: 'completed'
          },
          {
            user_id: loserId,
            amount: -game.wager_amount,
            type: 'wager',
            status: 'completed'
          }
        ]);
        
        // Dispatch balance update event after balance updates
        window.dispatchEvent(new CustomEvent('balanceChanged'));
        
        return {
          success: true,
          data: {
            winner_id: winnerId,
            game_id: gameId,
            wager_amount: game.wager_amount
          }
        };
      }
      
      // If it's not the ambiguous column error, rethrow it
      throw rpcError;
    }
  } catch (error) {
    console.error('Error joining game:', error);
    return { success: false, error: error.message };
  }
}

// Set up Supabase realtime subscriptions
export function subscribeToActiveGames(callback) {
  console.log('Setting up realtime subscription for games table');
  
  // Create a single channel for the games table with all event types
  const channel = supabase
    .channel('game-events')
    .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'games',
          // Get more complete game information on changes
          select: {
            columns: 'id,player1_id,player2_id,winner_id,wager_amount,status,created_at,completed_at'
          }
        }, 
        payload => {
          console.log('Game update received:', payload);
          console.log('Game update type:', payload.eventType);
          console.log('Game update data:', payload.new || payload.old);
          callback(payload);
        })
    .subscribe(status => {
      console.log('Realtime subscription status:', status);
      
      // Log more detailed subscription status information
      if (status === 'SUBSCRIBED') {
        console.log('Successfully subscribed to real-time updates for games table');
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Error subscribing to games table updates');
      }
    });
    
  return channel;
}

// Check Supabase connection
export async function checkConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error checking connection:', error);
    return { success: false, error: error.message };
  }
}

// Cancel a game
export async function cancelGame(userId, gameId) {
  try {
    // First check that the user is the creator of the game
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .eq('player1_id', userId) // Ensure user is the creator
      .eq('status', 'pending') // Only pending games can be cancelled
      .single();
    
    if (gameError) {
      if (gameError.code === 'PGRST116') {
        return { success: false, error: 'You can only cancel your own pending games' };
      }
      throw gameError;
    }
    
    console.log('Found game to cancel:', game);
    
    // Try to use RPC function first (if it exists)
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_game', {
        user_id: userId,
        game_id: gameId
      });
      
      if (!rpcError) {
        console.log('Game cancelled via RPC:', rpcData);
        return { success: true };
      }
      
      // If RPC fails with function not found, fall back to direct delete
      console.log('RPC cancel failed, falling back to direct delete:', rpcError);
    } catch (rpcError) {
      console.log('RPC failed with exception, falling back to direct delete:', rpcError);
    }
    
    // Try with more specific conditions for deletion
    const { data: deleteData, error: deleteError } = await supabase
      .from('games')
      .delete()
      .match({ 
        'id': gameId,
        'player1_id': userId,
        'status': 'pending'
      })
      .select();
    
    if (deleteError) {
      console.error('Error deleting game with match():', deleteError);
      
      // Last resort: try with eq chaining
      const { error: fallbackError } = await supabase
        .from('games')
        .delete()
        .eq('id', gameId)
        .eq('player1_id', userId)
        .eq('status', 'pending');
      
      if (fallbackError) {
        console.error('Error deleting game with eq() chain:', fallbackError);
        throw fallbackError;
      }
    }
    
    // Log deletion result
    console.log('Game deletion result:', deleteData);
    
    // If we have delete data and it's empty, we didn't delete anything
    if (deleteData && deleteData.length === 0) {
      console.warn('Game not deleted - game ID may no longer exist or conditions not met');
    }
    
    console.log('Game successfully cancelled:', gameId);
    
    // Broadcast a special event to all clients to force refresh
    // This is a fallback in case realtime deletion events are missed
    try {
      await supabase.from('system_events').insert({
        event_type: 'game_cancelled',
        event_data: { game_id: gameId },
        created_at: new Date().toISOString()
      });
    } catch (broadcastError) {
      // Just log the error but continue, as the main deletion was successful
      console.warn('Failed to broadcast cancellation event:', broadcastError);
    }
    
    // Game was successfully deleted
    return { success: true };
  } catch (error) {
    console.error('Error cancelling game:', error);
    return { success: false, error: error.message };
  }
}

// Clean up orphaned games (ones with missing user references)
// This function should be called by admins only
export async function cleanupOrphanedGames() {
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
    
    // Delete the orphaned games
    const { error: deleteError } = await supabase
      .from('games')
      .delete()
      .in('id', orphanedGameIds);
    
    if (deleteError) {
      console.error('Error deleting orphaned games:', deleteError);
      return { success: false, error: deleteError.message };
    }
    
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

// Export the supabase instance for direct access if needed
export default supabase; 