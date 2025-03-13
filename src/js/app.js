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
    subscribeToActiveGames 
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
        const wagersContainer = document.getElementById('wagers-container');
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
        
        // Render active games
        const renderGames = () => {
            wagersContainer.innerHTML = '';
            
            if (activeGames.length === 0) {
                wagersContainer.innerHTML = '<p class="text-gray-400">No active wagers available. Create one!</p>';
                return;
            }
            
            activeGames.forEach(game => {
                const gameCard = document.createElement('div');
                gameCard.className = 'bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-yellow-500 transition';
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
                    <button class="join-game-btn w-full px-4 py-2 bg-green-600 hover:bg-green-700 rounded transition mt-2" data-game-id="${game.id}">
                        Join Game
                    </button>
                `;
                wagersContainer.appendChild(gameCard);
            });
            
            // Add event listeners to join buttons
            document.querySelectorAll('.join-game-btn').forEach(btn => {
                btn.addEventListener('click', handleJoinGame);
            });
        };
        
        // Load active games from Supabase
        const loadActiveGames = async () => {
            const games = await getActiveGames();
            activeGames = games;
            renderGames();
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
                    alert(result.error || 'Failed to join game');
                    return;
                }
                
                // Show coinflip animation
                const isWinner = result.data.winner_id === user.id;
                showCoinflip(isWinner);
                
                // Update balance
                updateBalanceDisplay();
                
                // Remove game from list
                activeGames = activeGames.filter(g => g.id !== gameId);
                renderGames();
            } catch (error) {
                console.error('Error joining game:', error);
                alert('Error joining game: ' + error.message);
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
        
        // Set up real-time subscription for game updates
        const setupRealTimeUpdates = () => {
            const subscription = subscribeToActiveGames(payload => {
                // Handle different events
                if (payload.eventType === 'INSERT') {
                    // New game created
                    loadActiveGames();
                } else if (payload.eventType === 'DELETE' || 
                           (payload.eventType === 'UPDATE' && 
                            payload.new.status === 'completed')) {
                    // Game removed or completed
                    loadActiveGames();
                }
            });
            
            return subscription;
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
            // Load active games
            await loadActiveGames();
            
            // Set up real-time updates
            const subscription = setupRealTimeUpdates();
            
            // Update balance if user is logged in
            updateBalanceDisplay();
            
            console.log('App initialization complete');
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