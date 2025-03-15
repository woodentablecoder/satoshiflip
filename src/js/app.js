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
import { chat } from './chat.js';
import { showToast } from './utils.js';

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
        
        // Initialize auth and transactions
        console.log('Initializing auth module');
        auth.initAuth();
        console.log('Initializing transactions module');
        transactions.initTransactions();
        
        // Make showToast available globally
        window.showToast = showToast;
        
        // Active games
        let activeGames = [];
        
        // Format satoshis to readable format with spaces
        const formatSatoshis = (amount) => {
            return `<span id="btc-logo" style="color: #F7931A">₿</span> <span style="color: white">${amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}</span>`;
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
        
        // Render active games
        const renderGames = async () => {
            // Clear the container first
            wagersContainer.innerHTML = '';
            
            // Check if there are any games to display
            if (!activeGames || activeGames.length === 0) {
                wagersContainer.innerHTML = '<p class="text-gray-300">No active wagers available. Create one!</p>';
                return;
            }
            
            // Get current user to identify their games
            const currentUser = await getCurrentUser();
            
            activeGames.forEach(game => {
                // Skip any null entries that might have sneaked in
                if (!game) return;
                
                const gameCard = document.createElement('div');
                gameCard.className = 'bg-[#1D1D1D] rounded-lg p-4 hover:border-yellow-500 transition';
                
                // Check if the current user is the creator of this game
                const isCreator = currentUser && game.playerId === currentUser.id;
                
                // Show different styling for the user's own games
                // Creator's games have no special styling
                
                gameCard.innerHTML = `
                    <div class="flex items-start gap-4 mb-4" style="min-width: 250px; background-color: rgb(22, 22, 22); padding: 20px; border-radius: 10px; border: 2px solid #ffffff1f">
                        <div class="flex flex-col items-center gap-2">
                            <img src="public/images/Untitled-3.jpg" alt="User profile" class="w-16 h-16 bg-white rounded-[10px] p-2" />
                            <span class="text-[rgba(255,255,255,1)] font-mono text-sm">${game.playerName || 'Unknown'}</span>
                        </div>
                        <div class="flex flex-col items-end flex-grow">
                            <div class="text-right">
                                <span class="text-[rgba(255,255,255,0.8)]">
                                    ${game.teamChoice === 'heads' 
                                        ? `<img src="public/images/bitcoin heads.png" alt="Heads" class="w-5 h-5 inline-block mr-1" style="vertical-align: middle;"> Heads` 
                                        : `<img src="public/images/bitcoin.svg" alt="Tails" class="w-5 h-5 inline-block mr-1" style="vertical-align: middle;"> Tails`}
                                </span>
                            </div>
                            <div class="flex items-center justify-end mt-9" style="border-radius: 4px; min-width: 80px; min-height: 28px;">
                                <span style="font-family: 'GohuFont', monospace; font-size: calc(0.875rem + 9px);"><span style="color: #F7931A; margin-right: 3px;">₿</span><span class="text-white">${game.wagerAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")}</span></span>
                            </div>
                        </div>
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
        };
        
        // Load active games from Supabase
        const loadActiveGames = async () => {
            try {
                if (!wagersContainer) {
                    console.error('Cannot load games: wagers container not found in DOM');
                    return false;
                }
                
                // Add loading indicator if not a background poll
                const isBackgroundPoll = !wagersContainer.innerHTML.includes('Refreshing') && 
                                        activeGames.length > 0;
                
                if (!isBackgroundPoll) {
                    wagersContainer.innerHTML = '<p class="text-gray-400">Refreshing wagers...</p>';
                }
                
                // Get games from API
                const games = await getActiveGames();
                
                // Log detailed game information for debugging
                console.log(`Received ${games ? games.length : 0} games from API after filtering out invalid entries`);
                
                if (!games || !Array.isArray(games)) {
                    console.error('Invalid response from getActiveGames:', games);
                    wagersContainer.innerHTML = '<p class="text-red-400">Error loading wagers. Please refresh the page.</p>';
                    return false;
                }
                
                // Check if the games list has actually changed before updating the UI
                const hasChanged = isBackgroundPoll && (
                    // Different number of games
                    activeGames.length !== games.length ||
                    // Or different game IDs
                    JSON.stringify(activeGames.map(g => g.id).sort()) !== 
                    JSON.stringify(games.map(g => g.id).sort())
                );
                
                // Always update the internal data
                activeGames = games;
                
                // Only update the UI if this is not a background poll or if data has changed
                if (!isBackgroundPoll || hasChanged) {
                    console.log('Games list changed, updating UI with', games.length, 'games');
                    
                    // Empty the container first
                    wagersContainer.innerHTML = '';
                    
                    if (games.length === 0) {
                        // No games to display
                        wagersContainer.innerHTML = '<p class="text-gray-300">No active wagers available. Create one!</p>';
                    } else {
                        // Render the games
                        await renderGames();
                    }
                    
                    // Only add the flash effect if there was an actual change in a background poll
                    if (hasChanged) {
                        // Add a subtle flash effect to the container to highlight the update
                        wagersContainer.classList.add('bg-cyan-900', 'bg-opacity-10');
                        setTimeout(() => {
                            wagersContainer.classList.remove('bg-cyan-900', 'bg-opacity-10');
                        }, 500);
                        
                        // Show a notification for updated list
                        showToast('Wager list has been updated', 'info');
                    }
                } else if (isBackgroundPoll) {
                    // Silent update of the data if polling didn't detect changes
                    console.log('Polling detected no changes in games list');
                }
                
                return true;
            } catch (error) {
                console.error('Failed to load active games:', error);
                
                // Only update UI if it's not a background poll
                if (wagersContainer && !wagersContainer.innerHTML.includes('Refreshing')) {
                    wagersContainer.innerHTML = '<p class="text-red-400">Error loading wagers. Please try again later.</p>';
                }
                
                return false;
            }
        };
        
        // Update user balance display
        const updateBalanceDisplay = async () => {
            try {
                const user = await getCurrentUser();
                if (!user) {
                    userBalanceDisplay.innerHTML = `<span id="btc-logo" style="color: #F7931A">₿</span> <span style="color: white">0</span>`;
                    return;
                }
                const balance = await getUserBalance(user.id);
                userBalanceDisplay.innerHTML = formatSatoshis(balance);
            } catch (error) {
                console.error('Error updating balance:', error);
                userBalanceDisplay.innerHTML = `<span id="btc-logo" style="color: #F7931A">₿</span> <span style="color: white">0</span>`;
            }
        };
        
        // Set up real-time subscription for game updates
        const setupRealTimeUpdates = async () => {
            console.log('Setting up real-time updates');
            
            try {
                // Initialize Supabase listener for games
                const gameChannel = subscribeToActiveGames(handleGameUpdate);
                console.log('Supabase games subscription set up:', gameChannel);
                
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
            
            try {
                // Validate payload data to avoid issues with incomplete data
                if (!payload || !payload.eventType) {
                    console.error('Invalid payload received in handleGameUpdate:', payload);
                    return;
                }
                
                // Check if this is a game with missing user data (foreign key issue)
                const hasForeignKeyIssue = payload.new && 
                                           payload.new.player1_id && 
                                           typeof payload.new.player1_id === 'string' &&
                                           payload.new.player1_id.includes('deleted');
                
                if (hasForeignKeyIssue) {
                    console.warn(`Skipping update for game with foreign key issue: ${payload.new?.id}`);
                    // Still refresh the list to ensure UI consistency
                    await loadActiveGames();
                    return;
                }
                
                // Always refresh the games list on any update to ensure UI consistency
                await loadActiveGames();
                
                // Special handling for completed games
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
                            
                            // Show the coinflip animation with the actual result
                            showCoinflip(isWinner, payload.new.flip_result);
                            
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
                } else if (payload.eventType === 'INSERT') {
                    // New game created
                    showToast('New wager available!', 'info');
                } else if (payload.eventType === 'DELETE') {
                    // Game deleted/cancelled
                    showToast('A wager was cancelled', 'info');
                }
            } catch (error) {
                console.error('Error handling game update:', error);
                // Fallback - always try to refresh the games list
                try {
                    await loadActiveGames();
                } catch (e) {
                    console.error('Failed to refresh games after error:', e);
                }
            }
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
                        showCoinflip(isWinner, result.data.flip_result);
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
        const handleCreateGame = async (teamChoice) => {
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
                const result = await createGame(user.id, wagerAmount, teamChoice);
                
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
        const showCoinflip = (isWinner, flipResult) => {
            console.log('SHOWING COINFLIP ANIMATION - Winner:', isWinner, 'Flip:', flipResult);
            
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
                
                // Show the modal
                modal.classList.remove('hidden');
                modal.style.display = 'flex';
                
                // Force reflow
                void modal.offsetHeight;
                void coinInnerElement.offsetWidth;
                
                // Start the flip animation
                setTimeout(() => {
                    coinInnerElement.classList.add('flipping');
                    
                    // Show the result after animation
                    setTimeout(() => {
                        if (flipResult === 'heads') {
                            resultElement.textContent = `${isWinner ? 'You win!' : 'You lose!'} (Heads)`;
                            resultElement.className = `text-center mt-4 ${isWinner ? 'text-green-500' : 'text-red-500'} text-2xl mb-8`;
                        } else {
                            coinInnerElement.style.transform = 'rotateY(990deg)';
                            resultElement.textContent = `${isWinner ? 'You win!' : 'You lose!'} (Tails)`;
                            resultElement.className = `text-center mt-4 ${isWinner ? 'text-green-500' : 'text-red-500'} text-2xl mb-8`;
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
            try {
                console.log('Setting up event listeners');
                
                // Set up team choice buttons
                const headsBtn = document.getElementById('heads-btn');
                const tailsBtn = document.getElementById('tails-btn');
                let selectedTeam = 'heads'; // Default choice
                
                if (headsBtn && tailsBtn) {
                    const updateTeamButtons = () => {
                        // Apply pulsating effect to the selected button
                        if (selectedTeam === 'heads') {
                            headsBtn.style.backgroundColor = '#363636';
                            headsBtn.style.animation = 'pulse 0.5s infinite alternate';
                            tailsBtn.style.backgroundColor = '#1D1D1D';
                            tailsBtn.style.animation = 'none';
                        } else {
                            tailsBtn.style.backgroundColor = '#363636';
                            tailsBtn.style.animation = 'pulse 0.5s infinite alternate';
                            headsBtn.style.backgroundColor = '#1D1D1D';
                            headsBtn.style.animation = 'none';
                        }
                        
                        // Add the keyframe animation if it doesn't exist
                        if (!document.getElementById('pulse-animation')) {
                            const style = document.createElement('style');
                            style.id = 'pulse-animation';
                            style.textContent = `
                                @keyframes pulse {
                                    from { background-color: #363636; }
                                    to { background-color: #666666; }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                    };
                    
                    headsBtn.addEventListener('click', () => {
                        selectedTeam = 'heads';
                        updateTeamButtons();
                    });
                    
                    tailsBtn.addEventListener('click', () => {
                        selectedTeam = 'tails';
                        updateTeamButtons();
                    });
                    
                    // Set initial state
                    updateTeamButtons();
                }
                
                // Set up event listeners for UI buttons
                if (createGameBtn) {
                    createGameBtn.addEventListener('click', () => handleCreateGame(selectedTeam));
                    console.log('✓ Create game button listener attached');
                } else {
                    console.error('Create game button not found in the DOM');
                }
                
                // Change these global event listeners to more specific ones to avoid conflicts
                // Instead of adding the event listeners to the entire document
                // Add them only to the wagers container
                if (wagersContainer) {
                    wagersContainer.addEventListener('click', (e) => {
                        // Only handle clicks on join-game-btn elements
                        if (e.target.classList.contains('join-game-btn') || 
                            e.target.closest('.join-game-btn')) {
                            handleJoinGame(e);
                        }
                        
                        // Handle cancel game clicks
                        if (e.target.classList.contains('cancel-game-btn') || 
                            e.target.closest('.cancel-game-btn')) {
                            handleCancelGame(e);
                        }
                    });
                    console.log('✓ Wagers container delegated listener attached');
                } else {
                    console.error('Wagers container not found in the DOM');
                }
                
                // Set up refresh button
                const refreshBtn = document.getElementById('refresh-games-btn');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', loadActiveGames);
                    console.log('✓ Refresh button listener attached');
                } else {
                    console.error('Refresh button not found in the DOM');
                }
                
                // Set up deposit/withdraw buttons
                const depositBtn = document.getElementById('deposit-btn');
                const withdrawBtn = document.getElementById('withdraw-btn');
                
                if (depositBtn) {
                    depositBtn.addEventListener('click', transactions.showDepositModal);
                    console.log('✓ Deposit button listener attached');
                } else {
                    console.error('Deposit button not found in the DOM');
                }
                
                if (withdrawBtn) {
                    withdrawBtn.addEventListener('click', transactions.showWithdrawModal);
                    console.log('✓ Withdraw button listener attached');
                } else {
                    console.error('Withdraw button not found in the DOM');
                }
                
                // Set up auth button
                const authBtn = document.getElementById('explicit-auth-btn');
                if (authBtn) {
                    authBtn.addEventListener('click', auth.showAuthModal);
                    console.log('✓ Auth button listener attached');
                } else {
                    console.error('Auth button not found in the DOM');
                }
                
                // Modal close button
                if (closeModalBtn) {
                    closeModalBtn.addEventListener('click', closeModal);
                    console.log('✓ Close modal button listener attached');
                } else {
                    console.error('Close modal button not found in the DOM');
                }
                
                console.log('All event listeners setup complete!');
            } catch (error) {
                console.error('Error setting up event listeners:', error);
                showToast('There was an error initializing the application. Please refresh the page.', 'error');
            }
        };
        
        // Listen for auth state changes
        window.addEventListener('authStateChanged', async (e) => {
            if (e.detail.isLoggedIn) {
                // User logged in
                updateBalanceDisplay();
            } else {
                // User logged out
            }
        });
        
        // Listen for balance changes
        window.addEventListener('balanceChanged', () => {
            updateBalanceDisplay();
        });
        
        // Initialize the app
        const init = async () => {
            console.log('Initializing app...');
            
            try {
                // Check database connection
                const connectionResult = await checkConnection();
                console.log('Database connection check result:', connectionResult);
                
                if (!connectionResult) {
                    showToast('Unable to connect to the server. Please check your connection.', 'error');
                    return;
                }
                
                console.log('Database connection successful');
                
                // Load active games
                await loadActiveGames();
                console.log('Active games loaded successfully');
                
                // Set up real-time updates after confirming connection
                try {
                    const realtimeSuccess = await setupRealTimeUpdates();
                    console.log('Real-time updates set up:', realtimeSuccess);
                    
                    if (!realtimeSuccess) {
                        showToast('Real-time updates may not work. You might need to refresh manually to see changes.', 'warning');
                    }
                } catch (realtimeError) {
                    console.error('Failed to set up real-time updates:', realtimeError);
                    showToast('Real-time updates could not be set up. You might need to refresh manually.', 'error');
                }
                
                // Check user authentication status
                try {
                    const user = await getCurrentUser();
                    if (user) {
                        console.log('User is authenticated:', user);
                        await updateBalanceDisplay();
                    } else {
                        console.log('No authenticated user');
                    }
                } catch (authError) {
                    console.error('Error checking authentication status:', authError);
                }
                
                // Set up event listeners after everything is loaded
                setupEventListeners();
                
                console.log('App initialization complete!');
            } catch (error) {
                console.error('Error initializing app:', error);
                showToast('There was an error initializing the application. Please refresh the page.', 'error');
            }
        };
        
        // Initialize the app when DOM is loaded
        init();
    });
} catch (error) {
    console.error('Fatal error in app.js:', error);
    // Try to show error on page if possible
    document.addEventListener('DOMContentLoaded', () => {
        const errorElement = document.createElement('div');
        errorElement.className = 'fixed inset-0 bg-red-900 bg-opacity-90 flex items-center justify-center z-50 p-4';
        errorElement.innerHTML = `
            <div class="bg-gray-800 p-6 rounded-lg max-w-xl w-full">
                <h2 class="text-xl text-white font-bold mb-4">Critical Error</h2>
                <p class="text-gray-300 mb-4">There was a critical error loading the application:</p>
                <div class="bg-gray-900 p-4 rounded mb-4 font-mono text-red-400 text-sm overflow-auto max-h-64">
                    ${error.toString()}
                </div>
                <button class="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded transition" onclick="location.reload()">
                    Refresh Page
                </button>
            </div>
        `;
        document.body.appendChild(errorElement);
    });
} 