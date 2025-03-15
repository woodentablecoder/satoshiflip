import { supabase } from './supabase.js';
import { getCurrentUser, getUserBalance } from './supabase.js';
import { showToast } from './utils.js';

class Chat {
    constructor() {
        this.messages = [];
        this.messageContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-message-btn');
        this.tipButton = document.getElementById('tip-btn');
        this.tipAmount = document.getElementById('tip-amount');
        this.selectedUserId = null;
        this.selectedUsername = null;
        
        this.setupEventListeners();
        this.setupRealtimeSubscription();
        
        // Load recent messages when chat is initialized
        this.loadRecentMessages();
    }
    
    setupEventListeners() {
        // Send message on button click
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Send message on Enter key
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        // Handle tipping
        this.tipButton.addEventListener('click', () => this.sendTip());
    }
    
    async setupRealtimeSubscription() {
        // Subscribe to new messages
        const subscription = supabase
            .channel('chat_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            }, (payload) => {
                this.addMessageToUI(payload.new);
            })
            .subscribe();
    }
    
    async sendMessage() {
        const messageText = this.chatInput.value.trim();
        if (!messageText) return;
        
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            showToast('Please log in to chat', 'error');
            return;
        }
        
        try {
            // Use the basic insert without timestamp field (it will use the default created_at)
            const { data, error } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: currentUser.user_metadata.display_name || currentUser.email,
                    message: messageText
                }]);
                
            if (error) throw error;
            
            // Clear input after successful send
            this.chatInput.value = '';
            
        } catch (error) {
            console.error('Error sending message:', error);
            showToast('Failed to send message', 'error');
        }
    }
    
    async sendTip() {
        if (!this.selectedUserId || !this.selectedUsername) {
            showToast('Please select a user to tip by clicking their name', 'error');
            return;
        }
        
        const amount = parseInt(this.tipAmount.value);
        if (!amount || amount < 100) {
            showToast('Minimum tip amount is 100 satoshis', 'error');
            return;
        }
        
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            showToast('Please log in to tip', 'error');
            return;
        }
        
        // Don't allow tipping yourself
        if (currentUser.id === this.selectedUserId) {
            showToast('You cannot tip yourself', 'error');
            return;
        }
        
        const balance = await getUserBalance(currentUser.id);
        if (balance < amount) {
            showToast('Insufficient balance for tip', 'error');
            return;
        }
        
        try {
            // Deduct tip amount from sender
            const { error: deductError } = await supabase.rpc('deduct_balance', {
                user_id: currentUser.id,
                amount: amount
            });
            
            if (deductError) throw deductError;
            
            // Add tip amount to recipient
            const { error: addError } = await supabase.rpc('add_balance', {
                user_id: this.selectedUserId,
                amount: amount
            });
            
            if (addError) throw addError;
            
            // Send tip message as a regular message
            const tipMessage = `Tipped ${this.selectedUsername} ${amount} satoshis! 🎉`;
            
            // Use the basic insert without timestamp field
            const { data, error } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: currentUser.user_metadata.display_name || currentUser.email,
                    message: tipMessage
                }]);
                
            if (error) throw error;
            
            // Clear tip amount and selected user
            this.tipAmount.value = '';
            this.selectedUserId = null;
            this.selectedUsername = null;
            showToast('Tip sent successfully!', 'success');
            
        } catch (error) {
            console.error('Error sending tip:', error);
            showToast('Failed to send tip', 'error');
        }
    }
    
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bg-[#161616] rounded p-3 mb-2';
        
        // Use created_at instead of timestamp
        const timestamp = new Date(message.created_at).toLocaleTimeString();
        
        // Check if this is a tip message by looking for the message text
        const isTipMessage = message.message && message.message.includes('Tipped') && message.message.includes('satoshis');
        
        if (isTipMessage) {
            messageElement.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-yellow-500 font-mono">${message.username}</span>
                    <span class="text-gray-400 text-sm">${timestamp}</span>
                </div>
                <div class="mt-1 text-green-400">${message.message}</div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="flex items-center gap-2">
                    <span class="text-yellow-500 font-mono flex items-center">
                        ${message.username}
                        <button class="tip-user-btn ml-1" data-user-id="${message.user_id}" data-username="${message.username}">
                            <span class="text-[#F7931A] hover:text-yellow-300 transition-colors">₿</span>
                        </button>
                    </span>
                    <span class="text-gray-400 text-sm">${timestamp}</span>
                </div>
                <div class="mt-1 text-white">${message.message}</div>
            `;
            
            // Add click handler for the BTC icon to enable tipping
            const tipBtn = messageElement.querySelector('.tip-user-btn');
            if (tipBtn) {
                tipBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the username click
                    this.selectedUserId = tipBtn.dataset.userId;
                    this.selectedUsername = tipBtn.dataset.username;
                    this.tipAmount.focus();
                    showToast(`Ready to tip ${this.selectedUsername}`, 'info');
                });
            }
        }
        
        // Add click handler for username to enable tipping (as a fallback)
        const usernameElement = messageElement.querySelector('.text-yellow-500');
        usernameElement.style.cursor = 'pointer';
        usernameElement.addEventListener('click', () => {
            const userId = messageElement.querySelector('.tip-user-btn')?.dataset.userId;
            const username = messageElement.querySelector('.tip-user-btn')?.dataset.username;
            if (userId && username) {
                this.selectedUserId = userId;
                this.selectedUsername = username;
                this.tipAmount.focus();
                showToast(`Ready to tip ${username}`, 'info');
            }
        });
        
        this.messageContainer.appendChild(messageElement);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
    
    async loadRecentMessages() {
        try {
            // Use direct query instead of the helper function
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
                
            if (error) throw error;
            
            // Clear existing messages
            this.messageContainer.innerHTML = '';
            
            // Add messages in reverse order (oldest first)
            data.reverse().forEach(message => this.addMessageToUI(message));
            
        } catch (error) {
            console.error('Error loading messages:', error);
            showToast('Failed to load chat messages', 'error');
        }
    }
}

// Export a singleton instance
export const chat = new Chat();

// Initialize chat when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // The chat singleton is already initialized when imported
    console.log('Chat module initialized');
}); 