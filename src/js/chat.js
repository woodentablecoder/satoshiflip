import { supabase } from './supabase.js';
import { getCurrentUser, getUserBalance } from './supabase.js';
import { showToast } from './app.js';

class Chat {
    constructor() {
        this.messages = [];
        this.messageContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-message-btn');
        this.tipButton = document.getElementById('tip-btn');
        this.tipAmount = document.getElementById('tip-amount');
        
        this.setupEventListeners();
        this.setupRealtimeSubscription();
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
            const { data, error } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: currentUser.user_metadata.display_name || currentUser.email,
                    message: messageText,
                    timestamp: new Date().toISOString()
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
            
            // Send tip message
            const { error: messageError } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: currentUser.user_metadata.display_name || currentUser.email,
                    message: `Tipped ${amount} satoshis! 🎉`,
                    timestamp: new Date().toISOString(),
                    is_tip: true,
                    tip_amount: amount
                }]);
                
            if (messageError) throw messageError;
            
            // Clear tip amount
            this.tipAmount.value = '';
            showToast('Tip sent successfully!', 'success');
            
        } catch (error) {
            console.error('Error sending tip:', error);
            showToast('Failed to send tip', 'error');
        }
    }
    
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bg-[#161616] rounded p-3';
        
        const timestamp = new Date(message.timestamp).toLocaleTimeString();
        
        if (message.is_tip) {
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
                    <span class="text-yellow-500 font-mono">${message.username}</span>
                    <span class="text-gray-400 text-sm">${timestamp}</span>
                </div>
                <div class="mt-1 text-white">${message.message}</div>
            `;
        }
        
        // Add click handler for username to enable tipping
        const usernameElement = messageElement.querySelector('.text-yellow-500');
        usernameElement.style.cursor = 'pointer';
        usernameElement.addEventListener('click', () => {
            this.selectedUserId = message.user_id;
            this.tipAmount.focus();
            showToast(`Ready to tip ${message.username}`, 'info');
        });
        
        this.messageContainer.appendChild(messageElement);
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }
    
    async loadRecentMessages() {
        try {
            const { data, error } = await supabase
                .from('chat_messages')
                .select('*')
                .order('timestamp', { ascending: false })
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