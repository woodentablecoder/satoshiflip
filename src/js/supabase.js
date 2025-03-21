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
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
            balance: 0,
            display_name: null
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
              balance: 0,
              display_name: null
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
        team_choice,
        player1:player1_id (email, display_name)
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
      // Use display_name if available, otherwise use email username
      const username = game.player1.display_name || email.split('@')[0];
      
      return {
        id: game.id,
        playerId: game.player1_id,
        playerName: username,
        wagerAmount: game.wager_amount,
        teamChoice: game.team_choice,
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
        const isHeads = Math.random() < 0.5;
        const flipResult = isHeads ? 'heads' : 'tails';
        const isWinner = (flipResult === game.team_choice) ? false : true; // Creator wins if flip matches their choice
        const winnerId = isWinner ? userId : game.player1_id;
        const loserId = isWinner ? game.player1_id : userId;
        
        console.log(`Client-side fallback coinflip: 
          Result: ${flipResult}
          Creator chose: ${game.team_choice}
          Winner is: ${winnerId === userId ? 'Joiner' : 'Creator'}`);
        
        // 3. Update game with winner and flip result
        const { error: winnerError } = await supabase
          .from('games')
          .update({
            winner_id: winnerId,
            status: 'completed',
            flip_result: flipResult,
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
            amount: winnerAmount,
            flip_result: flipResult
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
    
    // Get the wager amount to refund
    const wagerAmount = game.wager_amount;
    
    // Before deleting the game, get current user balance
    let userData;
    try {
      const { data, error: userError } = await supabase
        .from('users')
        .select('balance')
        .eq('id', userId)
        .single();
        
      if (userError) throw userError;
      userData = data;
      console.log('Current user balance before refund:', userData.balance);
    } catch (balanceError) {
      console.error('Error getting user balance for refund:', balanceError);
      // Continue with deletion even if balance fetch fails
    }
    
    // Try to use RPC function first (if it exists)
    let gameDeleted = false;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('cancel_game', {
        user_id: userId,
        game_id: gameId
      });
      
      if (!rpcError) {
        console.log('Game cancelled via RPC:', rpcData);
        gameDeleted = true;
      } else {
        // If RPC fails with function not found, fall back to direct delete
        console.log('RPC cancel failed, falling back to direct delete:', rpcError);
      }
    } catch (rpcError) {
      console.log('RPC failed with exception, falling back to direct delete:', rpcError);
    }
    
    // If game was not deleted through RPC, try direct deletion
    if (!gameDeleted) {
      try {
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
        
        // Check if we actually deleted the game
        if (deleteData && deleteData.length > 0) {
          gameDeleted = true;
        } else {
          console.warn('Game not deleted - game ID may no longer exist or conditions not met');
          return { success: false, error: 'Game could not be deleted' };
        }
      } catch (deleteError) {
        console.error('Error during direct game deletion:', deleteError);
        return { success: false, error: 'Failed to delete game' };
      }
    }
    
    // If game was successfully deleted, perform refund
    if (gameDeleted && userData) {
      try {
        console.log('Refunding wager amount:', wagerAmount);
        
        // Calculate new balance
        const newBalance = userData.balance + wagerAmount;
        console.log('New balance will be:', newBalance);
        
        // Update user balance by adding back the wager amount
        const { error: updateError } = await supabase
          .from('users')
          .update({ balance: newBalance })
          .eq('id', userId);
          
        if (updateError) {
          console.error('Error updating user balance:', updateError);
          throw updateError;
        }
        
        console.log('Balance successfully updated to:', newBalance);
        
        // Create a transaction record for the refund
        try {
          const { error: transactionError } = await supabase
            .from('transactions')
            .insert({
              user_id: userId,
              amount: wagerAmount,
              type: 'wager',
              status: 'completed'
            });
            
          if (transactionError) {
            console.error('Error creating refund transaction record:', transactionError);
            // Continue even if transaction record fails
          } else {
            console.log('Refund transaction record created successfully');
          }
        } catch (transactionError) {
          console.error('Exception creating transaction record:', transactionError);
          // Continue even if transaction record fails
        }
        
        // Trigger balance update event
        window.dispatchEvent(new CustomEvent('balanceChanged'));
      } catch (refundError) {
        console.error('Error refunding wager amount:', refundError);
        // Return partial success - game deleted but refund failed
        return { 
          success: true, 
          partial: true, 
          message: 'Game cancelled but there was an error refunding your balance. Please contact support.'
        };
      }
    }
    
    console.log('Game successfully cancelled:', gameId);
    
    // Try to broadcast a special event, but don't fail if it doesn't work
    try {
      const { error: eventError } = await supabase
        .from('system_events')
        .insert({
          event_type: 'game_cancelled',
          event_data: { game_id: gameId },
          created_at: new Date().toISOString()
        });
        
      if (eventError) {
        console.warn('Failed to broadcast cancellation event:', eventError);
        // Continue anyway
      }
    } catch (broadcastError) {
      console.warn('Exception broadcasting cancellation event:', broadcastError);
      // Just log the error but continue, as the main operation was successful
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

/**
 * Chat functions
 */

// These functions are no longer used, but we'll keep them commented out for reference
/*
// Get recent chat messages
export async function getRecentChatMessages(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    return data.reverse(); // Return in chronological order (oldest first)
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return [];
  }
}

// Send a chat message
export async function sendChatMessage(userId, username, message, isTip = false, tipAmount = null, tipRecipientId = null) {
  try {
    // Basic message data without is_tip field
    const messageData = {
      user_id: userId,
      username: username,
      message: message,
      timestamp: new Date().toISOString()
    };
    
    // Only add tip-related fields if this is a tip message and the fields exist in the database
    if (isTip && tipAmount && tipRecipientId) {
      // For tip messages, we'll use a different approach
      // First check if the table has the required columns
      try {
        const { data: tipData, error: tipError } = await supabase
          .from('chat_messages')
          .insert([{
            user_id: userId,
            username: username,
            message: message,
            timestamp: new Date().toISOString(),
            tip_amount: tipAmount,
            tip_recipient_id: tipRecipientId
          }]);
          
        if (tipError) throw tipError;
        return { success: true, data: tipData };
      } catch (tipError) {
        console.error('Error sending tip message with tip fields:', tipError);
        // Fall back to sending a regular message without tip fields
        console.log('Falling back to regular message for tip');
      }
    }
    
    // Regular message insert without tip fields
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData]);
      
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error sending chat message:', error);
    return { success: false, error: error.message };
  }
}
*/

// Export the supabase instance for direct access if needed
export default supabase; 