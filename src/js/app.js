/**
 * SatoshiFlip - Bitcoin Coinflip Game
 * Main JavaScript File
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
    const createGameBtn = document.getElementById('create-game');
    const wagerAmountInput = document.getElementById('wager-amount');
    const wagersContainer = document.getElementById('wagers-container');
    const coinflipModal = document.getElementById('coinflip-modal');
    const coin = document.getElementById('coin');
    const resultText = document.getElementById('result');
    const closeModalBtn = document.getElementById('close-modal');
    
    // Placeholder for active games
    let activeGames = [
        {
            id: 'game1',
            playerId: 'user123',
            playerName: 'User123',
            wagerAmount: 10000,
            createdAt: new Date(Date.now() - 120000) // 2 minutes ago
        },
        {
            id: 'game2',
            playerId: 'user456',
            playerName: 'User456',
            wagerAmount: 50000,
            createdAt: new Date(Date.now() - 300000) // 5 minutes ago
        },
        {
            id: 'game3',
            playerId: 'user789',
            playerName: 'User789',
            wagerAmount: 100000,
            createdAt: new Date(Date.now() - 60000) // 1 minute ago
        }
    ];
    
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
    
    // Handle join game
    const handleJoinGame = (e) => {
        const gameId = e.target.getAttribute('data-game-id');
        // In a real app, we would call an API here
        console.log(`Joining game ${gameId}`);
        
        // Show coinflip animation
        showCoinflip();
    };
    
    // Handle create game
    const handleCreateGame = () => {
        const wagerAmount = parseInt(wagerAmountInput.value);
        
        if (isNaN(wagerAmount) || wagerAmount < 100 || wagerAmount > 100000000) {
            alert('Please enter a valid wager amount (between 100 and 100,000,000 satoshis)');
            return;
        }
        
        // In a real app, we would call an API here
        console.log(`Creating game with wager amount: ${wagerAmount}`);
        
        // For demo purposes, add a new game to the list
        const newGame = {
            id: 'game' + (activeGames.length + 1),
            playerId: 'currentUser',
            playerName: 'You',
            wagerAmount: wagerAmount,
            createdAt: new Date()
        };
        
        activeGames.unshift(newGame);
        renderGames();
        wagerAmountInput.value = '';
    };
    
    // Show coinflip animation
    const showCoinflip = () => {
        coinflipModal.classList.remove('hidden');
        resultText.textContent = 'Flipping...';
        
        // Reset coin state
        coin.classList.remove('coin-flip');
        document.querySelector('.heads').classList.remove('hidden');
        document.querySelector('.tails').classList.add('hidden');
        
        // Trigger reflow
        void coin.offsetWidth;
        
        // Start animation
        coin.classList.add('coin-flip');
        
        // Determine result (random for demo)
        const isHeads = Math.random() < 0.5;
        
        // Show result after animation
        setTimeout(() => {
            if (isHeads) {
                document.querySelector('.heads').classList.remove('hidden');
                document.querySelector('.tails').classList.add('hidden');
                resultText.textContent = 'Heads! You win!';
            } else {
                document.querySelector('.heads').classList.add('hidden');
                document.querySelector('.tails').classList.remove('hidden');
                resultText.textContent = 'Tails! You lose!';
            }
        }, 3000);
    };
    
    // Close modal
    const closeModal = () => {
        coinflipModal.classList.add('hidden');
    };
    
    // Event listeners
    createGameBtn.addEventListener('click', handleCreateGame);
    closeModalBtn.addEventListener('click', closeModal);
    
    // Initial render
    renderGames();
    
    // For demo: Update relative times every minute
    setInterval(() => {
        document.querySelectorAll('.join-game-btn').forEach(btn => {
            const gameId = btn.getAttribute('data-game-id');
            const game = activeGames.find(g => g.id === gameId);
            if (game) {
                const timeElem = btn.parentElement.querySelector('span:last-of-type');
                timeElem.textContent = formatRelativeTime(game.createdAt);
            }
        });
    }, 60000);
}); 