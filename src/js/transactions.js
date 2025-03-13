/**
 * Transactions Module for SatoshiFlip
 * Handles Bitcoin deposits and withdrawals
 */

import { getCurrentUser } from './supabase.js';

// DOM elements
let transactionModal;
let depositContainer;
let withdrawContainer;
let closeTransactionModalBtn;
let depositBtn;
let withdrawBtn;
let depositAddress;
let withdrawAddress;
let withdrawAmount;
let submitWithdrawBtn;

// Initialize the transactions module
export function initTransactions() {
    // Get references to DOM elements
    transactionModal = document.getElementById('transaction-modal');
    depositContainer = document.getElementById('deposit-container');
    withdrawContainer = document.getElementById('withdraw-container');
    closeTransactionModalBtn = document.getElementById('close-transaction-modal');
    depositBtn = document.getElementById('deposit-btn');
    withdrawBtn = document.getElementById('withdraw-btn');
    depositAddress = document.getElementById('deposit-address');
    withdrawAddress = document.getElementById('withdraw-address');
    withdrawAmount = document.getElementById('withdraw-amount');
    submitWithdrawBtn = document.getElementById('submit-withdraw');
    
    // Set up event listeners
    closeTransactionModalBtn.addEventListener('click', () => {
        transactionModal.classList.add('hidden');
    });
    
    depositBtn.addEventListener('click', showDepositModal);
    withdrawBtn.addEventListener('click', showWithdrawModal);
    submitWithdrawBtn.addEventListener('click', handleWithdraw);
    
    // Disable transaction buttons initially (until logged in)
    depositBtn.disabled = true;
    withdrawBtn.disabled = true;
    depositBtn.classList.add('opacity-50');
    withdrawBtn.classList.add('opacity-50');
    
    // Listen for auth state changes
    window.addEventListener('authStateChanged', (e) => {
        depositBtn.disabled = !e.detail.isLoggedIn;
        withdrawBtn.disabled = !e.detail.isLoggedIn;
        
        if (e.detail.isLoggedIn) {
            depositBtn.classList.remove('opacity-50');
            withdrawBtn.classList.remove('opacity-50');
            
            // Get deposit address for this user
            generateDepositAddress();
        } else {
            depositBtn.classList.add('opacity-50');
            withdrawBtn.classList.add('opacity-50');
        }
    });
}

// Show deposit modal
function showDepositModal() {
    const user = getCurrentUser();
    
    if (!user) {
        alert('You must be logged in to make a deposit');
        return;
    }
    
    // Set modal title
    document.getElementById('transaction-title').textContent = 'Deposit Bitcoin';
    
    // Show deposit container, hide withdraw container
    depositContainer.classList.remove('hidden');
    withdrawContainer.classList.add('hidden');
    
    // Show modal
    transactionModal.classList.remove('hidden');
}

// Show withdraw modal
function showWithdrawModal() {
    const user = getCurrentUser();
    
    if (!user) {
        alert('You must be logged in to make a withdrawal');
        return;
    }
    
    // Set modal title
    document.getElementById('transaction-title').textContent = 'Withdraw Bitcoin';
    
    // Show withdraw container, hide deposit container
    withdrawContainer.classList.remove('hidden');
    depositContainer.classList.add('hidden');
    
    // Reset form
    withdrawAddress.value = '';
    withdrawAmount.value = '';
    
    // Show modal
    transactionModal.classList.remove('hidden');
}

// Generate a deposit address (placeholder)
function generateDepositAddress() {
    // In a real app, we would call an API to get a BTC address for this user
    // For demo purposes, we'll use a placeholder
    depositAddress.textContent = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
}

// Handle withdrawal request
async function handleWithdraw() {
    const user = await getCurrentUser();
    
    if (!user) {
        alert('You must be logged in to make a withdrawal');
        return;
    }
    
    const address = withdrawAddress.value.trim();
    const amount = parseInt(withdrawAmount.value);
    
    if (!address) {
        alert('Please enter a valid Bitcoin address');
        return;
    }
    
    if (isNaN(amount) || amount < 1000) {
        alert('Please enter a valid amount (minimum 1000 satoshis)');
        return;
    }
    
    // Display loading state
    submitWithdrawBtn.disabled = true;
    submitWithdrawBtn.textContent = 'Processing...';
    
    try {
        // In a real app, we would call an API to process the withdrawal
        // For demo purposes, we'll just show a success message
        setTimeout(() => {
            alert('Withdrawal request submitted! It will be processed shortly.');
            
            // Close modal
            transactionModal.classList.add('hidden');
            
            // Reset form
            withdrawAddress.value = '';
            withdrawAmount.value = '';
            
            // Trigger a balance update (which would happen via webhook in a real app)
            window.dispatchEvent(new CustomEvent('balanceChanged'));
        }, 2000);
    } catch (error) {
        alert('Error processing withdrawal: ' + error.message);
    } finally {
        // Reset button
        submitWithdrawBtn.disabled = false;
        submitWithdrawBtn.textContent = 'Withdraw';
    }
}

export default { initTransactions }; 