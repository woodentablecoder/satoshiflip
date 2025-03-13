/**
 * Chat Module for SatoshiFlip
 * Handles all chat-related functionalities
 */

import supabase from './supabase.js';

// Send a chat message
export async function sendChatMessage(message, userId = null, username = null) {
  try {
    const messageData = {
      message: message.trim()
    };
    
    // Only add user_id if it's a valid non-null value
    if (userId && userId !== 'null' && userId !== undefined) {
      messageData.user_id = userId;
    }
    
    // Add username for non-authenticated users or if provided
    if (username) {
      messageData.username = username;
    } else if (!userId || userId === 'null' || userId === undefined) {
      // If no username is provided and user is not authenticated, use a default
      messageData.username = 'Guest' + Math.floor(Math.random() * 1000);
    }
    
    console.log('Sending chat message data:', messageData);
    
    const { data, error } = await supabase
      .from('chat_messages')
      .insert([messageData])
      .select();
      
    if (error) throw error;
    
    return { success: true, data };
  } catch (error) {
    console.error('Error sending chat message:', error);
    return { success: false, error: error.message };
  }
}

// Get chat messages
export async function getChatMessages(limit = 50) {
  try {
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id, 
        message, 
        created_at, 
        user_id, 
        username,
        users(email)
      `)
      .order('created_at', { ascending: false })
      .limit(limit);
      
    if (error) throw error;
    
    return { 
      success: true, 
      data: data.reverse() // Return in chronological order
    };
  } catch (error) {
    console.error('Error getting chat messages:', error);
    return { success: false, error: error.message };
  }
}

// Set up real-time subscription to chat messages
export function subscribeToChatMessages(callback) {
  console.log('Setting up realtime subscription for chat messages');
  
  try {
    const channel = supabase
      .channel('chat-events')
      .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'chat_messages',
            select: {
              columns: 'id,user_id,username,message,created_at'
            }
          }, 
          payload => {
            console.log('Chat message received via realtime:', payload);
            if (payload && payload.new) {
              callback(payload.new);
            }
          })
      .subscribe(status => {
        console.log('Chat subscription status:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to chat messages');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Error subscribing to chat messages');
          // Try to resubscribe after 3 seconds on error
          setTimeout(() => {
            console.log('Attempting to resubscribe to chat...');
            channel.subscribe();
          }, 3000);
        }
      });
    
    return channel;
  } catch (error) {
    console.error('Error setting up chat subscription:', error);
    throw error;
  }
}

// Module exports
const chat = {
  sendChatMessage,
  getChatMessages,
  subscribeToChatMessages
};

export default chat; 