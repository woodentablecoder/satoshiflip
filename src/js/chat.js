import { supabase } from './supabase.js';
import { getCurrentUser, getUserBalance } from './supabase.js';
import { showToast } from './utils.js';

class Chat {
    constructor() {
        this.messages = [];
        this.messageContainer = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-message-btn');
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
        
        // Setup tip modal event listeners
        this.setupTipModalListeners();
    }
    
    setupTipModalListeners() {
        // Get tip modal elements
        const tipModal = document.getElementById('tip-modal');
        const closeTipModal = document.getElementById('close-tip-modal');
        const cancelTipBtn = document.getElementById('cancel-tip-btn');
        const confirmTipBtn = document.getElementById('confirm-tip-btn');
        const tipAmount = document.getElementById('tip-amount');
        
        // Close modal handlers
        const closeModal = () => {
            tipModal.classList.add('hidden');
            this.selectedUserId = null;
            this.selectedUsername = null;
            tipAmount.value = '';
            document.getElementById('tip-error').classList.add('hidden');
            document.getElementById('tip-error').textContent = '';
        };
        
        closeTipModal.addEventListener('click', closeModal);
        cancelTipBtn.addEventListener('click', closeModal);
        
        // Confirm tip handler
        confirmTipBtn.addEventListener('click', () => this.sendTip());
        
        // Enter key in amount field
        tipAmount.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.sendTip();
            }
        });
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
            // Get a valid username from user metadata or email
            let username = 'Anonymous';
            
            if (currentUser.user_metadata && currentUser.user_metadata.display_name) {
                username = currentUser.user_metadata.display_name;
            } else if (currentUser.email) {
                // Use email as fallback but remove domain for privacy
                username = currentUser.email.split('@')[0];
            }
            
            // Use the basic insert without timestamp field (it will use the default created_at)
            const { data, error } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: username,
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
        const tipModal = document.getElementById('tip-modal');
        const tipAmount = document.getElementById('tip-amount');
        const tipError = document.getElementById('tip-error');
        
        const amount = parseInt(tipAmount.value);
        if (!amount || amount <= 0) {
            tipError.textContent = 'Tip amount must be greater than 0 satoshis';
            tipError.classList.remove('hidden');
            return;
        }
        
        const currentUser = await getCurrentUser();
        if (!currentUser) {
            tipError.textContent = 'Please log in to tip';
            tipError.classList.remove('hidden');
            return;
        }
        
        // Don't allow tipping yourself
        if (currentUser.id === this.selectedUserId) {
            tipError.textContent = 'You cannot tip yourself';
            tipError.classList.remove('hidden');
            return;
        }
        
        const balance = await getUserBalance(currentUser.id);
        if (balance < amount) {
            tipError.textContent = 'Insufficient balance for tip';
            tipError.classList.remove('hidden');
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
            
            // Get a valid username from user metadata or email
            let username = 'Anonymous';
            
            if (currentUser.user_metadata && currentUser.user_metadata.display_name) {
                username = currentUser.user_metadata.display_name;
            } else if (currentUser.email) {
                // Use email as fallback but remove domain for privacy
                username = currentUser.email.split('@')[0];
            }
            
            // Send tip message as a regular message
            const tipMessage = `Tipped ${this.selectedUsername} ${amount} satoshis! 🎉`;
            
            // Use the basic insert without timestamp field
            const { data, error } = await supabase
                .from('chat_messages')
                .insert([{
                    user_id: currentUser.id,
                    username: username,
                    message: tipMessage
                }]);
                
            if (error) throw error;
            
            // Close the tip modal
            tipModal.classList.add('hidden');
            
            // Clear tip amount and selected user
            tipAmount.value = '';
            this.selectedUserId = null;
            this.selectedUsername = null;
            showToast('Tip sent successfully!', 'success');
            
        } catch (error) {
            console.error('Error sending tip:', error);
            tipError.textContent = 'Failed to send tip: ' + (error.message || 'Unknown error');
            tipError.classList.remove('hidden');
        }
    }
    
    addMessageToUI(message) {
        const messageElement = document.createElement('div');
        messageElement.className = 'message bg-[#161616] rounded p-3 mb-2';
        
        // Use created_at instead of timestamp
        const timestamp = new Date(message.created_at).toLocaleTimeString();
        
        // Extract email username if the username is an email
        let displayUsername = message.username || 'Anonymous';
        if (displayUsername.includes('@')) {
            // If it's an email address, just use the part before the @
            displayUsername = displayUsername.split('@')[0];
        }
        
        // Check if this is a tip message by looking for the message text
        const isTipMessage = message.message && message.message.includes('Tipped') && message.message.includes('satoshis');
        
        if (isTipMessage) {
            messageElement.innerHTML = `
                <div class="mb-1">
                    <span class="text-yellow-500 font-mono font-bold">${displayUsername}</span>
                </div>
                <div class="flex justify-between items-start">
                    <div class="text-green-400">${message.message}</div>
                </div>
            `;
        } else {
            messageElement.innerHTML = `
                <div class="mb-1 flex items-center justify-between">
                    <span class="text-yellow-500 font-mono font-bold">${displayUsername}</span>
                    <button class="tip-user-btn" data-user-id="${message.user_id}" data-username="${displayUsername}">
                        <span class="text-[#F7931A] hover:text-yellow-300 transition-colors text-sm">₿</span>
                    </button>
                </div>
                <div class="text-white">${message.message}</div>
            `;
            
            // Add click handler for the BTC icon to enable tipping
            const tipBtn = messageElement.querySelector('.tip-user-btn');
            if (tipBtn) {
                tipBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent triggering the username click
                    this.selectedUserId = tipBtn.dataset.userId;
                    this.selectedUsername = tipBtn.dataset.username;
                    
                    // Show the tip modal
                    const tipModal = document.getElementById('tip-modal');
                    const tipRecipient = document.getElementById('tip-recipient');
                    
                    // Set the recipient name in the modal
                    tipRecipient.textContent = this.selectedUsername;
                    
                    // Show the modal
                    tipModal.classList.remove('hidden');
                    
                    // Focus the amount input
                    document.getElementById('tip-amount').focus();
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
                
                // Show the tip modal
                const tipModal = document.getElementById('tip-modal');
                const tipRecipient = document.getElementById('tip-recipient');
                
                // Set the recipient name in the modal
                tipRecipient.textContent = this.selectedUsername;
                
                // Show the modal
                tipModal.classList.remove('hidden');
                
                // Focus the amount input
                document.getElementById('tip-amount').focus();
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