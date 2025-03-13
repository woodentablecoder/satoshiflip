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

console.log('Imports successful');

// Wrap the rest in a try-catch for error handling
try {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('DOM loaded, initializing app');
        
        // DOM elements
        const createGameBtn = document.getElementById('create-game');
        const wagerAmountInput = document.getElementById('wager-amount');
        const wagersContainer = document.getElementById('active-wagers-container');
        const coinflipModal = document.getElementById('coinflip-modal');
        const coin = document.getElementById('coin');
        const resultText = document.getElementById('result');
        const closeModalBtn = document.getElementById('close-modal');
        const userBalanceDisplay = document.getElementById('user-balance');
        
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
            
            if (activeGames.length === 0) {
                wagersContainer.innerHTML = '<p class="text-gray-400">No active wagers available. Create one!</p>';
                return;
            }
            
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
            
            // Add event listeners to join buttons
            document.querySelectorAll('.join-game-btn').forEach(btn => {
                btn.addEventListener('click', handleJoinGame);
            });
            
            // Add event listeners to cancel buttons
            document.querySelectorAll('.cancel-game-btn').forEach(btn => {
                btn.addEventListener('click', handleCancelGame);
            });
        };
        
        // Load active games from Supabase
        const loadActiveGames = async () => {
            try {
                // For polling updates, we'll check if the list has changed before showing the refresh indicator
                const isPoll = !wagersContainer.innerHTML.includes('Refreshing');
                
                // Only show the refreshing indicator if this is not a background poll or if container is empty
                if (!isPoll || activeGames.length === 0) {
                    wagersContainer.innerHTML = '<p class="text-cyan-400 animate-pulse">Refreshing wagers list...</p>';
                    
                    // Small delay to ensure the refreshing message is visible
                    await new Promise(resolve => setTimeout(resolve, 300));
                }
                
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
            // Get current user to check for creator role
            const currentUser = await getCurrentUser();
            
            // Track if this is the initial subscription to avoid duplicates
            let isInitialUpdate = true;
            
            const subscription = subscribeToActiveGames(async payload => {
                console.log('Realtime update received:', payload);
                
                // Skip the initial automatic updates from subscription setup
                if (isInitialUpdate) {
                    isInitialUpdate = false;
                    console.log('Ignoring initial subscription update');
                    return;
                }
                
                // Handle different events
                if (payload.eventType === 'INSERT') {
                    // New game created - reload games
                    console.log('New game created, refreshing list');
                    await loadActiveGames();
                } else if (payload.eventType === 'DELETE') {
                    // Game removed - reload games
                    console.log('Game removed, refreshing list');
                    await loadActiveGames();
                } else if (payload.eventType === 'UPDATE') {
                    // Game was updated - always refresh the list
                    console.log('Game updated, refreshing list');
                    await loadActiveGames();
                    
                    // Additional specific handling for completed games
                    if (payload.new && payload.new.status === 'completed') {
                        // Show coinflip to game creator if that's the current user
                        if (currentUser && payload.new.player1_id === currentUser.id) {
                            console.log('Your game was joined and completed!');
                            
                            // Show coinflip animation for the creator
                            const isWinner = payload.new.winner_id === currentUser.id;
                            showCoinflip(isWinner);
                            
                            // Update balance since there's a change
                            updateBalanceDisplay();
                        }
                    }
                } else if (payload.eventType === 'REFRESH') {
                    // Manual refresh triggered
                    console.log('Manual refresh triggered');
                    await loadActiveGames();
                }
            });
            
            return subscription;
        };
        
        // Handle join game
        const handleJoinGame = async (e) => {
            const user = await getCurrentUser();
            if (!user) {
                alert('You must be logged in to join a game');
                return;
            }
            
            const gameId = e.target.getAttribute('data-game-id');
            
            // Show loading state
            e.target.disabled = true;
            e.target.innerHTML = 'Joining...';
            
            try {
                const result = await joinGame(user.id, gameId);
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
                
                // Show coinflip animation
                const isWinner = result.data.winner_id === user.id;
                showCoinflip(isWinner);
                
                // Update balance
                updateBalanceDisplay();
                
                // Show a success message
                showToast('Game joined! Refreshing list...', 'success');
                
                // Manually update the game list since real-time events may not be reliable
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
            createGameBtn.disabled = true;
            createGameBtn.innerHTML = 'Creating...';
            
            try {
                const result = await createGame(user.id, wagerAmount);
                
                if (!result.success) {
                    alert(result.error || 'Failed to create game');
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
                createGameBtn.disabled = false;
                createGameBtn.innerHTML = 'Create Game';
            }
        };
        
        // Show coinflip animation
        const showCoinflip = (isWinner) => {
            coinflipModal.classList.remove('hidden');
            resultText.textContent = 'Flipping...';
            
            // Get the coin inner element
            const coinInner = document.querySelector('.coin-inner');
            
            // Reset coin state
            coinInner.classList.remove('flipping');
            
            // Trigger reflow
            void coinInner.offsetWidth;
            
            // Start animation
            coinInner.classList.add('flipping');
            
            // Show result after animation
            setTimeout(() => {
                // Calculate final rotation based on result
                // If winner, end with heads showing (900 degrees)
                // If loser, end with tails showing (rotate to 990 degrees - extra 90 degrees to show tails)
                if (isWinner) {
                    // Keep default animation (ends with heads showing)
                    resultText.textContent = 'Heads! You win!';
                    resultText.className = 'text-center mt-4 text-green-500 text-2xl mb-8';
                } else {
                    // Make sure tails is showing
                    coinInner.style.transform = 'rotateY(990deg)';
                    resultText.textContent = 'Tails! You lose!';
                    resultText.className = 'text-center mt-4 text-red-500 text-2xl mb-8';
                }
            }, 3000);
        };
        
        // Close modal
        const closeModal = () => {
            coinflipModal.classList.add('hidden');
            resultText.className = 'text-center mt-4 text-white text-2xl mb-8';
            // Reset coin inner transform style
            const coinInner = document.querySelector('.coin-inner');
            coinInner.style.transform = '';
        };
        
        // Handle cancel game
        const handleCancelGame = async (e) => {
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
        createGameBtn.addEventListener('click', handleCreateGame);
        closeModalBtn.addEventListener('click', closeModal);
        
        // Listen for auth state changes
        window.addEventListener('authStateChanged', async (e) => {
            if (e.detail.isLoggedIn) {
                // User logged in
                updateBalanceDisplay();
            }
        });
        
        // Listen for balance changes
        window.addEventListener('balanceChanged', () => {
            updateBalanceDisplay();
        });
        
        // Initialize
        const init = async () => {
            try {
                console.log('Initializing app...');
                
                // Check Supabase connection
                const connectionCheck = await checkConnection();
                if (!connectionCheck.success) {
                    console.error('Failed to connect to Supabase:', connectionCheck.error);
                    wagersContainer.innerHTML = '<p class="text-red-400">Unable to connect to the server. Please try again later.</p>';
                    return;
                }
                
                // Load active games
                await loadActiveGames();
                
                // Set up real-time updates
                const subscription = await setupRealTimeUpdates();
                
                // Set up periodic polling as a backup for real-time updates
                // Refresh the list every 5 seconds to ensure all clients stay in sync
                const pollingInterval = setInterval(() => {
                    console.log('Polling for game updates...');
                    loadActiveGames();
                }, 5000);
                
                // Clean up on page unload
                window.addEventListener('beforeunload', () => {
                    console.log('Cleaning up subscriptions and intervals');
                    if (subscription && typeof subscription === 'object' && subscription.unsubscribe) {
                        subscription.unsubscribe();
                    }
                    clearInterval(pollingInterval);
                });
                
                // Update balance if user is logged in
                updateBalanceDisplay();
                
                console.log('App initialization complete');
            } catch (error) {
                console.error('Error during app initialization:', error);
                wagersContainer.innerHTML = '<p class="text-red-400">An error occurred during initialization. Please refresh the page.</p>';
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