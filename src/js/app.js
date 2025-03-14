/**
 * SatoshiFlip - Bitcoin Coinflip Game
 * Main JavaScript File
 */

// Add debugging
console.log('Loading app.js');

// Import statements must be at the top level
import { 
    getCurrentUser, 
    getUserBalance, 
    createGame, 
    getActiveGames, 
    joinGame, 
    subscribeToActiveGames,
    checkConnection,
    cancelGame
} from './supabase.js';
import auth from './auth.js';
import transactions from './transactions.js';
import chat from './chat.js';

console.log('Imports successful');

// Wrap the rest in a try-catch for error handling
try {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing app');
        
        // DOM elements
        const createGameBtn = document.getElementById('create-game-btn');
        const wagerAmountInput = document.getElementById('wager-amount');
        const wagersContainer = document.getElementById('active-wagers-container');
        const coinflipModal = document.getElementById('coinflip-modal');
        const coin = document.getElementById('coin');
        const resultText = document.getElementById('result');
        const closeModalBtn = document.getElementById('close-modal');
        const userBalanceDisplay = document.getElementById('user-balance');
        const chatMessages = document.getElementById('chat-messages');
        const chatInput = document.getElementById('chat-input');
        const sendMessageBtn = document.getElementById('send-message');
        
        // Initialize auth and transactions
        console.log('Initializing auth module');
        auth.initAuth();
        console.log('Initializing transactions module');
        transactions.initTransactions();
        
        // Active games
        let activeGames = [];
        
        // Format satoshis to readable format with spaces
        const formatSatoshis = (amount) => {
            return '₿ ' + amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
        };
        
        // Format relative time
        const formatRelativeTime = (date) => {
            const seconds = Math.floor((new Date() - date) / 1000);
            
            if (seconds < 60) return `${seconds} sec ago`;
            if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
            if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
            return `${Math.floor(seconds / 86400)} days ago`;
        };
        
        // Format timestamp to local time
        const formatTimestamp = (timestamp) => {
            const date = new Date(timestamp);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        };
        
        // Show toast notification
        const showToast = (message, type = 'info') => {
            // Create toast container if it doesn't exist
            let toastContainer = document.getElementById('toast-container');
            if (!toastContainer) {
                toastContainer = document.createElement('div');
                toastContainer.id = 'toast-container';
                toastContainer.className = 'fixed bottom-4 right-4 z-50 flex flex-col gap-2';
                document.body.appendChild(toastContainer);
            }
            
            // Create toast element
            const toast = document.createElement('div');
            toast.className = `p-3 rounded shadow-lg text-white flex items-center justify-between ${
                type === 'success' ? 'bg-green-600' : 
                type === 'error' ? 'bg-red-600' : 
                'bg-blue-600'
            }`;
            
            toast.innerHTML = `
                <span>${message}</span>
                <button class="ml-3 text-white hover:text-gray-200">&times;</button>
            `;
            
            // Add to container
            toastContainer.appendChild(toast);
            
            // Auto-remove after 3 seconds
            const timeout = setTimeout(() => {
                if (toast.parentElement) {
                    toast.remove();
                }
            }, 3000);
            
            // Close button
            const closeBtn = toast.querySelector('button');
            closeBtn.addEventListener('click', () => {
                clearTimeout(timeout);
                toast.remove();
            });
        };
        
        // Render active games
        const renderGames = async () => {
            wagersContainer.innerHTML = '';
            
            // Get current user to identify their games
            const currentUser = await getCurrentUser();
            
            activeGames.forEach(game => {
                const gameCard = document.createElement('div');
                gameCard.className = 'bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-yellow-500 transition';
                
                // Check if the current user is the creator of this game
                const isCreator = currentUser && game.playerId === currentUser.id;
                
                // Show different styling for the user's own games
                if (isCreator) {
                    gameCard.classList.add('border-yellow-500');
                }
                
                gameCard.innerHTML = `
                    <div class="flex justify-between mb-2">
                        <span class="text-gray-400">Player</span>
                        <span class="text-white font-mono">${game.playerName}</span>
                    </div>
                    <div class="flex justify-between mb-4">
                        <span class="text-gray-400">Wager</span>
                        <span class="text-yellow-500 font-mono">${formatSatoshis(game.wagerAmount)}</span>
                    </div>
                    <div class="flex justify-between mb-2">
                        <span class="text-gray-400">Created</span>
                        <span class="text-gray-300">${formatRelativeTime(game.createdAt)}</span>
                    </div>
                `;
                
                // Add either a cancel button (for creator) or join button (for others)
                const buttonContainer = document.createElement('div');
                
                if (isCreator) {
                    buttonContainer.innerHTML = `
                        <button class="cancel-game-btn w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded transition mt-2" data-game-id="${game.id}">
                            Cancel Wager
                        </button>
                    `;
                } else {
                    buttonContainer.innerHTML = `
                        <button class="join-game-btn w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition mt-2" data-game-id="${game.id}">
                            Join Game
                        </button>
                    `;
                }
                
                gameCard.appendChild(buttonContainer);
                wagersContainer.appendChild(gameCard);
            });
            
            // Remove individual event listeners - we now use event delegation in setupEventListeners
        };
        
        // Load active games from Supabase
        const loadActiveGames = async () => {
            try {
                // For polling updates, we'll check if the list has changed before showing the refresh indicator
                const isPoll = !wagersContainer.innerHTML.includes('Refreshing');
                
                const games = await getActiveGames();
                
                // Check if the games list has actually changed before updating the UI
                const hasChanged = isPoll && (
                    // Different number of games
                    activeGames.length !== games.length ||
                    // Or different game IDs
                    JSON.stringify(activeGames.map(g => g.id).sort()) !== 
                    JSON.stringify(games.map(g => g.id).sort())
                );
                
                // Only update the UI if this is not a poll or if data has changed
                if (!isPoll || hasChanged) {
                    console.log('Games list changed, updating UI');
                    activeGames = games;
                    await renderGames();
                    
                    // Only add the flash effect if there was an actual change
                    if (hasChanged) {
                        // Add a subtle flash effect to the container to highlight the update
                        wagersContainer.classList.add('bg-cyan-900', 'bg-opacity-10');
                        setTimeout(() => {
                            wagersContainer.classList.remove('bg-cyan-900', 'bg-opacity-10');
                        }, 500);
                    }
                } else if (isPoll) {
                    // Silent update of the data if polling didn't detect changes
                    activeGames = games;
                    console.log('Polling detected no changes in games list');
                }
            } catch (error) {
                console.error('Failed to load active games:', error);
                wagersContainer.innerHTML = '<p class="text-red-400">Error loading wagers. Please try again later.</p>';
            }
        };
        
        // Update user balance display
        const updateBalanceDisplay = async () => {
            const user = await getCurrentUser();
            if (user) {
                const balance = await getUserBalance(user.id);
                userBalanceDisplay.textContent = formatSatoshis(balance);
            } else {
                userBalanceDisplay.textContent = '₿ 0';
            }
        };
        
        // Set up real-time subscription for game updates
        const setupRealTimeUpdates = async () => {
            console.log('Setting up real-time updates');
            
            try {
                // Initialize Supabase listener for games
                const gameChannel = subscribeToActiveGames(handleGameUpdate);
                console.log('Supabase games subscription set up:', gameChannel);
                
                // Initialize Supabase listener for chat messages
                const chatChannel = chat.subscribeToChatMessages(handleNewChatMessage);
                console.log('Supabase chat subscription set up:', chatChannel);
                
                // Set up periodic check to ensure chat subscription is active
                const chatSubscriptionCheck = setInterval(() => {
                    if (chatChannel?.subscription?.state !== 'SUBSCRIBED') {
                        console.log('Chat subscription not active, resubscribing...');
                        try {
                            chatChannel?.subscribe();
                        } catch (e) {
                            console.error('Error resubscribing to chat:', e);
                        }
                    }
                }, 30000); // Check every 30 seconds
                
                // Store interval ID in window to clean up later if needed
                window.chatSubscriptionCheckInterval = chatSubscriptionCheck;
                
                return true;
            } catch (error) {
                console.error('Error setting up real-time updates:', error);
                showToast('Failed to connect to real-time updates. Try refreshing.', 'error');
                return false;
            }
        };
        
        // Handle real-time game updates
        const handleGameUpdate = async (payload) => {
            console.log('Game update received:', payload);
            
            // Special handling for completed games first
            if (payload.eventType === 'UPDATE' && 
                payload.new && 
                payload.new.status === 'completed') {
                
                const gameId = payload.new.id;
                console.log('✅ COMPLETED GAME DETECTED - ID:', gameId);
                
                // Get current user
                const user = await getCurrentUser();
                if (user) {
                    // Check if current user is involved in this game
                    const currentUserId = String(user.id);
                    const player1Id = String(payload.new.player1_id || '');
                    const player2Id = String(payload.new.player2_id || '');
                    const winnerId = String(payload.new.winner_id || '');
                    
                    console.log(`Game participants:
                        Current user ID: ${currentUserId}
                        Player1 ID: ${player1Id}
                        Player2 ID: ${player2Id}
                        Winner ID: ${winnerId}`);
                    
                    const isUserInGame = (currentUserId === player1Id || currentUserId === player2Id);
                    
                    if (isUserInGame) {
                        const isWinner = (currentUserId === winnerId);
                        console.log('User is in game! Is winner?', isWinner);
                        
                        // Show the coinflip animation
                        showCoinflip(isWinner);
                        
                        // Update balance after game completes
                        updateBalanceDisplay();
                    }
                }
            } else if (payload.eventType === 'UPDATE' && 
                       payload.new && 
                       payload.new.status === 'active' && 
                       payload.new.player2_id) {
                
                // Handle newly joined games for creator
                const user = await getCurrentUser();
                if (user) {
                    const currentUserId = String(user.id);
                    const player1Id = String(payload.new.player1_id || '');
                    
                    // If current user is the creator (player1) and this is a new join
                    if (currentUserId === player1Id) {
                        showToast('Another player has joined your game! Coinflip starting...', 'success');
                    }
                }
            }
            
            // Always refresh the game list on updates
            await loadActiveGames();
        };
        
        // Handle join game
        const handleJoinGame = async (e) => {
            // Check if this is triggered by a game button
            if (!e.target.classList.contains('join-game-btn')) {
                return;
            }

            const user = await getCurrentUser();
            if (!user) {
                alert('You must be logged in to join a game');
                return;
            }
            
            const gameId = e.target.getAttribute('data-game-id');
            console.log('Joining game with ID:', gameId);
            
            // Show loading state
            e.target.disabled = true;
            e.target.innerHTML = 'Joining...';
            
            try {
                console.log('About to call joinGame API with user:', user.id, 'and game:', gameId);
                const result = await joinGame(user.id, gameId);
                console.log('Join game result:', result);
                
                if (!result.success) {
                    const errorMessage = result.error || 'Failed to join game';
                    // Display a more user-friendly error
                    if (errorMessage.includes('Insufficient balance')) {
                        alert('You do not have enough balance to join this game. Please deposit more bitcoin.');
                    } else if (errorMessage.includes('ambiguous')) {
                        alert('There was a technical issue with the game. Please try again later.');
                    } else {
                        alert(errorMessage);
                    }
                    return;
                }
                
                // Show success message and update balance
                showToast('Game joined successfully! Preparing coinflip...', 'success');
                updateBalanceDisplay();
                
                // Check if we have winner data to directly show animation
                if (result.data && result.data.winner_id) {
                    console.log('Game was completed immediately, showing animation for joiner.');
                    console.log('Winner data:', result.data.winner_id, 'Current user:', user.id);
                    
                    // Convert to strings for safer comparison
                    const isWinner = String(result.data.winner_id) === String(user.id);
                    console.log('Is joining player winner?', isWinner);
                    
                    // Force animation display with slight delay to ensure UI is ready
                    setTimeout(() => {
                        showCoinflip(isWinner);
                    }, 300); // Slightly longer delay to ensure UI readiness
                } else {
                    // No winner data immediately available, but game is joined
                    // Set a fallback to check for updates in case real-time doesn't work
                    console.log('No immediate winner data, setting fallback check');
                    setTimeout(async () => {
                        console.log('Fallback: Checking if game completed after joining');
                        // Force refresh games to get latest state
                        await loadActiveGames();
                        
                        // Look for this game in the active games list
                        const joinedGame = activeGames.find(g => g.id === gameId);
                        
                        // If game is no longer in active list, it likely completed
                        if (!joinedGame) {
                            console.log('Game not found in active list, likely completed');
                            // Try to retrieve result from API (this would be an API call in a real app)
                            // For now, just show toast to check results
                            showToast('Game may be completed. Check your balance for results.', 'info');
                        }
                    }, 2000);
                }
                
                // Refresh games list
                await loadActiveGames();
                
            } catch (error) {
                console.error('Error joining game:', error);
                alert('An unexpected error occurred. Please try again later.');
            } finally {
                // Reset button state
                e.target.disabled = false;
                e.target.innerHTML = 'Join Game';
            }
        };
        
        // Handle create game
        const handleCreateGame = async () => {
            const user = await getCurrentUser();
            if (!user) {
                alert('You must be logged in to create a game');
                return;
            }
            
            const wagerAmount = parseInt(wagerAmountInput.value);
            
            if (isNaN(wagerAmount) || wagerAmount < 100 || wagerAmount > 100000000) {
                alert('Please enter a valid wager amount (between 100 and 100,000,000 satoshis)');
                return;
            }
            
            // Show loading state
            if (createGameBtn) {
                createGameBtn.disabled = true;
                createGameBtn.innerHTML = 'Creating...';
            }
            
            try {
                const result = await createGame(user.id, wagerAmount);
                
                if (!result.success) {
                    if (result.error.includes('one game at a time')) {
                        // User already has an active game
                        showToast('You can only have one active game at a time. Cancel your existing game to create a new one.', 'error');
                    } else if (result.error.includes('Maximum number of active games')) {
                        // System already has 10 active games
                        showToast('Maximum number of active games reached (10). Please try again later or join an existing game.', 'error');
                    } else {
                        // Other errors
                        alert(result.error || 'Failed to create game');
                    }
                    return;
                }
                
                // Update balance
                updateBalanceDisplay();
                
                // Clear input
                wagerAmountInput.value = '';
                
                // Show a success message
                showToast('Game created! Refreshing list...', 'success');
                
                // Manually update the game list since real-time events may not be reliable
                await loadActiveGames();
                
            } catch (error) {
                console.error('Error creating game:', error);
                alert('Error creating game: ' + error.message);
            } finally {
                // Reset button state
                if (createGameBtn) {
                    createGameBtn.disabled = false;
                    createGameBtn.innerHTML = 'Create Game';
                }
            }
        };
        
        // Show coinflip animation
        const showCoinflip = (isWinner) => {
            console.log('SHOWING COINFLIP ANIMATION - Winner:', isWinner);
            
            try {
                // Get modal element
                const modal = document.getElementById('coinflip-modal');
                if (!modal) {
                    console.error('ERROR: coinflip-modal not found');
                    alert(isWinner ? 'You won the flip!' : 'You lost the flip!');
                    return;
                }
                
                // Get result text element
                const resultElement = document.getElementById('result');
                if (!resultElement) {
                    console.error('ERROR: result element not found');
                    alert(isWinner ? 'You won the flip!' : 'You lost the flip!');
                    return;
                }
                
                // Get coin inner element
                const coinInnerElement = document.querySelector('.coin-inner');
                if (!coinInnerElement) {
                    console.error('ERROR: coin-inner element not found');
                    alert(isWinner ? 'You won the flip!' : 'You lost the flip!');
                    return;
                }
                
                // Reset the animation state
                coinInnerElement.classList.remove('flipping');
                coinInnerElement.style.transform = '';
                resultElement.textContent = 'Flipping...';
                resultElement.className = 'text-center mt-4 text-white text-2xl mb-8';
                
                // Show the modal - fix display conflicts
                modal.style.display = 'flex';
                modal.classList.remove('hidden');
                
                // Force reflow
                void modal.offsetHeight;
                void coinInnerElement.offsetWidth;
                
                // Start the flip animation
                setTimeout(() => {
                    coinInnerElement.classList.add('flipping');
                    
                    // Show the result after animation
                    setTimeout(() => {
                        if (isWinner) {
                            resultElement.textContent = 'Heads! You win!';
                            resultElement.className = 'text-center mt-4 text-green-500 text-2xl mb-8';
                        } else {
                            coinInnerElement.style.transform = 'rotateY(990deg)';
                            resultElement.textContent = 'Tails! You lose!';
                            resultElement.className = 'text-center mt-4 text-red-500 text-2xl mb-8';
                        }
                    }, 3000);
                }, 50);
                
            } catch (error) {
                console.error('ERROR in showCoinflip:', error);
                // Fallback to simple alert
                alert(isWinner ? 'You won the flip!' : 'You lost the flip!');
            }
        };
        
        // Close modal
        const closeModal = () => {
            console.log('Closing coinflip modal');
            const modal = document.getElementById('coinflip-modal');
            if (!modal) {
                console.error('coinflip-modal not found in DOM!');
                return;
            }
            
            modal.classList.add('hidden');
            modal.style.display = 'none';
            
            // Reset result text
            const result = document.getElementById('result');
            if (result) {
                result.className = 'text-center mt-4 text-white text-2xl mb-8';
            }
            
            // Reset coin inner transform style
            const coinInner = document.querySelector('.coin-inner');
            if (coinInner) {
                coinInner.style.transform = '';
                coinInner.classList.remove('flipping');
            }
        };
        
        // Handle cancel game
        const handleCancelGame = async (e) => {
            // Check if this is triggered by a cancel button
            if (!e.target.classList.contains('cancel-game-btn')) {
                return;
            }

            const user = await getCurrentUser();
            if (!user) {
                alert('You must be logged in to cancel a game');
                return;
            }
            
            const gameId = e.target.getAttribute('data-game-id');
            
            // Confirm cancellation
            if (!confirm('Are you sure you want to cancel this wager?')) {
                return;
            }
            
            // Show loading state
            e.target.disabled = true;
            e.target.innerHTML = 'Cancelling...';
            
            try {
                const result = await cancelGame(user.id, gameId);
                if (!result.success) {
                    alert(result.error || 'Failed to cancel game');
                    return;
                }
                
                console.log(`Game successfully cancelled: ${gameId}`);
                
                // Show a success message
                showToast('Game successfully cancelled! Refreshing list...', 'success');
                
                // Manually update the game list since real-time events may not be reliable for DELETE operations
                await loadActiveGames();
                
            } catch (error) {
                console.error('Error cancelling game:', error);
                alert('An unexpected error occurred. Please try again later.');
            } finally {
                // Reset button state in case the element still exists
                if (!e.target.isConnected) return;
                e.target.disabled = false;
                e.target.innerHTML = 'Cancel Wager';
            }
        };
        
        // Event listeners
        const setupEventListeners = () => {
            // Set up event listeners for UI buttons
            if (createGameBtn) {
                createGameBtn.addEventListener('click', handleCreateGame);
            } else {
                console.error('Create game button not found in the DOM');
            }
            
            // Change these global event listeners to more specific ones to avoid conflicts
            // Instead of adding the event listeners to the entire document
            // Add them only to the wagers container
            if (wagersContainer) {
                wagersContainer.addEventListener('click', (e) => {
                    // For joining games
                    if (e.target.classList.contains('join-game-btn')) {
                        handleJoinGame(e);
                    }
                    
                    // For cancelling games
                    if (e.target.classList.contains('cancel-game-btn')) {
                        handleCancelGame(e);
                    }
                });
            }
            
            // Set up refresh button
            const refreshBtn = document.getElementById('refresh-games-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', loadActiveGames);
            }
            
            // Set up deposit/withdraw buttons
            const depositBtn = document.getElementById('deposit-btn');
            const withdrawBtn = document.getElementById('withdraw-btn');
            
            if (depositBtn) depositBtn.addEventListener('click', transactions.handleDeposit);
            if (withdrawBtn) withdrawBtn.addEventListener('click', transactions.handleWithdraw);
            
            // Set up auth button
            const authBtn = document.getElementById('explicit-auth-btn');
            if (authBtn) {
                authBtn.addEventListener('click', auth.showAuthModal);
            }
            
            // Chat event listeners
            if (sendMessageBtn) {
                sendMessageBtn.addEventListener('click', sendMessage);
            }
            
            if (chatInput) {
                chatInput.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        sendMessage();
                    }
                });
            }

            // Modal close button
            if (closeModalBtn) {
                closeModalBtn.addEventListener('click', closeModal);
            } else {
                console.error('Close modal button not found in the DOM');
            }
        };
        
        // Listen for auth state changes
        window.addEventListener('authStateChanged', async (e) => {
            if (e.detail.isLoggedIn) {
                // User logged in
                updateBalanceDisplay();
                
                // Store user ID for message styling
                if (e.detail.user && e.detail.user.id) {
                    localStorage.setItem('currentUserId', e.detail.user.id);
                }
            } else {
                // User logged out, remove stored ID
                localStorage.removeItem('currentUserId');
            }
        });
        
        // Listen for balance changes
        window.addEventListener('balanceChanged', () => {
            updateBalanceDisplay();
        });
        
        // Chat functions
        const loadChatMessages = async () => {
            try {
                const { success, data, error } = await chat.getChatMessages();
                
                if (!success) {
                    console.error('Error loading chat messages:', error);
                    return;
                }
                
                renderChatMessages(data);
            } catch (error) {
                console.error('Failed to load chat messages:', error);
            }
        };
        
        const renderChatMessages = (messages) => {
            if (!chatMessages) return;
            
            // Clear existing messages if refreshing all
            if (messages.length > 1) {
                chatMessages.innerHTML = '';
            }
            
            // Process each message
            messages.forEach(message => {
                addMessageToChat(message);
            });
            
            // Scroll to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };
        
        const addMessageToChat = (message) => {
            // Check if message already exists (avoid duplicates)
            if (document.getElementById(`msg-${message.id}`)) {
                return;
            }
            
            const messageEl = document.createElement('div');
            messageEl.id = `msg-${message.id}`;
            messageEl.className = 'mb-2';
            
            // Get display name
            let displayName = 'Guest';
            if (message.username) {
                displayName = message.username;
            } else if (message.users?.email) {
                displayName = message.users.email.split('@')[0]; // Just use the part before @ in email
            }
            
            // Format timestamp
            const time = formatTimestamp(message.created_at);
            
            // Don't rely on immediate user checking for UI display
            // This will just color the message based on the user_id
            const isCurrentUserMessage = message.user_id && 
                localStorage.getItem('currentUserId') === message.user_id;
            
            messageEl.innerHTML = `
                <div class="flex items-start space-x-1">
                    <span class="text-xs text-gray-500">[${time}]</span>
                    <span class="font-bold ${isCurrentUserMessage ? 'text-green-400' : 'text-blue-400'}">${displayName}:</span>
                    <span class="break-words">${escapeHTML(message.message)}</span>
                </div>
            `;
            
            chatMessages.appendChild(messageEl);
            
            // Scroll to bottom on new messages
            chatMessages.scrollTop = chatMessages.scrollHeight;
        };
        
        const handleNewChatMessage = (message) => {
            console.log('New chat message received:', message);
            
            // If it's a valid message with an id, add it to the chat
            if (message && message.id) {
                // All we need is the message data to display it
                addMessageToChat(message);
                
                // Optionally notify user about new message with a toast
                const currentUserId = localStorage.getItem('currentUserId');
                const isFromCurrentUser = message.user_id && currentUserId === message.user_id;
                
                // Only show notification for messages from others
                if (!isFromCurrentUser) {
                    const username = message.username || 'Someone';
                    showToast(`${username} sent a new message`, 'info');
                }
            } else {
                console.error('Received invalid chat message data:', message);
            }
        };
        
        const sendMessage = async () => {
            const messageText = chatInput.value.trim();
            
            if (!messageText) return;
            
            try {
                // Get current user information more reliably
                const user = await getCurrentUser();
                let username = null;
                let userId = null;
                
                // If user is authenticated, use their ID
                if (user && user.id) {
                    userId = user.id;
                    console.log('Sending message as authenticated user:', userId);
                } else {
                    // Use guest username for non-authenticated users
                    username = localStorage.getItem('guestUsername');
                    
                    if (!username) {
                        username = prompt('Enter a display name for chat:');
                        
                        if (!username) {
                            // Use default if they cancel
                            username = 'Guest' + Math.floor(Math.random() * 1000);
                        }
                        
                        localStorage.setItem('guestUsername', username);
                    }
                    console.log('Sending message as guest:', username);
                }
                
                const { success, error } = await chat.sendChatMessage(
                    messageText,
                    userId,
                    username
                );
                
                if (!success) {
                    console.error('Error sending message:', error);
                    showToast('Failed to send message. Try again.', 'error');
                    return;
                }
                
                // Clear input after sending
                chatInput.value = '';
            } catch (error) {
                console.error('Failed to send chat message:', error);
                showToast('Failed to send message. Try again.', 'error');
            }
        };
        
        // Utility function to escape HTML
        const escapeHTML = (str) => {
            return str
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
        
        // Initialize
        const init = async () => {
            console.log('Initializing app...');
            
            try {
                // First, check if Supabase is reachable
                const { success, error } = await checkConnection();
                
                if (!success) {
                    console.error('Database connection check failed:', error);
                    showToast('Database connection failed. Please try again later.', 'error');
                    return;
                }
                
                console.log('Database connection successful');
                
                // Load initial data
                const gamesLoaded = await loadActiveGames();
                console.log('Games loaded:', gamesLoaded);
                
                // Load chat messages
                await loadChatMessages();
                
                // Set up real-time updates after confirming connection
                const realtimeSuccess = await setupRealTimeUpdates();
                console.log('Real-time updates set up:', realtimeSuccess);
                
                // Check user authentication status
                const user = await getCurrentUser();
                if (user) {
                    console.log('User is authenticated:', user);
                    await updateBalanceDisplay();
                } else {
                    console.log('No authenticated user');
                }
                
                // Set up event listeners after everything is loaded
                setupEventListeners();
                
                console.log('App initialization complete!');
                
            } catch (error) {
                console.error('Error during app initialization:', error);
                showToast('An error occurred during app initialization. Please refresh.', 'error');
            }
        };
        
        // Start the app
        init();
    });
    
} catch (error) {
    console.error('Error in application:', error);
    // Create a visible error message on the page
    document.addEventListener('DOMContentLoaded', () => {
        const errorDiv = document.createElement('div');
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '10px';
        errorDiv.style.right = '10px';
        errorDiv.style.padding = '20px';
        errorDiv.style.backgroundColor = 'red';
        errorDiv.style.color = 'white';
        errorDiv.style.zIndex = '9999';
        errorDiv.textContent = 'Error loading application: ' + error.message;
        document.body.appendChild(errorDiv);
    });
} 