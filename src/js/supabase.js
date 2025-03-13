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
export async function createGame(userId, wagerAmount) {
  try {
    // Check user balance
    const balance = await getUserBalance(userId);
    if (balance < wagerAmount) {
      return { success: false, error: 'Insufficient balance' };
    }
    
    // Create game in transaction
    const { data, error } = await supabase.rpc('create_game', {
      user_id: userId,
      amount: wagerAmount
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
    
    // First try to get user information using a join, but if that fails, try without the join
    try {
      const { data, error } = await supabase
        .from('games')
        .select(`
          id,
          wager_amount,
          created_at,
          player1_id,
          users!games_player1_id_fkey (email)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        throw error;
      }
      
      console.log('Games data with user join successful:', data);
      
      if (!data || data.length === 0) {
        console.log('No active games found');
        return [];
      }
      
      // Format the returned data
      return data.map(game => {
        // Check if users object exists and has email property
        if (!game.users) {
          console.warn(`Game ${game.id} has no associated user data. This may indicate a foreign key issue.`);
        }
        
        const email = game.users?.email || 'anonymous@example.com';
        const username = email.split('@')[0];
        
        return {
          id: game.id,
          playerId: game.player1_id,
          playerName: username,
          wagerAmount: game.wager_amount,
          createdAt: new Date(game.created_at)
        };
      });
    } catch (joinError) {
      console.warn('Error fetching games with user join, trying without join:', joinError);
      
      // Fallback to a simpler query without the join
      const { data, error } = await supabase
        .from('games')
        .select('id, wager_amount, created_at, player1_id')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error in fallback query:', error);
        throw error;
      }
      
      console.log('Games data without user join:', data);
      
      if (!data || data.length === 0) {
        console.log('No active games found in fallback query');
        return [];
      }
      
      // Format the returned data with generic user info
      return data.map(game => {
        return {
          id: game.id,
          playerId: game.player1_id,
          playerName: 'User ' + game.player1_id.substring(0, 4),
          wagerAmount: game.wager_amount,
          createdAt: new Date(game.created_at)
        };
      });
    }
  } catch (error) {
    console.error('Error getting active games:', error);
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
    
    // Execute coinflip via RPC
    const { data, error } = await supabase.rpc('join_game', {
      user_id: userId,
      game_id: gameId
    });
    
    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Error joining game:', error);
    return { success: false, error: error.message };
  }
}

// Set up Supabase realtime subscriptions
export function subscribeToActiveGames(callback) {
  return supabase
    .channel('public:games')
    .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'games' }, 
        callback)
    .subscribe();
}

// Check Supabase connection
export async function checkConnection() {
  try {
    // Use a simpler query that doesn't use aggregate functions
    const { data, error } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection check failed:', error);
      return { success: false, error: error.message };
    }
    
    console.log('Supabase connection successful');
    return { success: true };
  } catch (error) {
    console.error('Error checking Supabase connection:', error);
    return { success: false, error: error.message };
  }
}

export default supabase; 