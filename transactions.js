const initTransactions = function() {
  // Wrap all DOM-dependent code in a function
  function initializeTransactionElements() {
    const closeButton = document.getElementById('close-transaction-modal');
    if (!closeButton) {
      console.warn('Transaction modal close button not found, will retry in 500ms');
      // Try again in 500ms
      setTimeout(initializeTransactionElements, 500);
      return false; // Initialization failed
    }
    
    // Attach event listener
    closeButton.addEventListener('click', function() {
      // Close modal logic here
    });
    
    // Add other transaction-related initialization here
    
    console.log('Transaction module fully initialized');
    return true; // Initialization succeeded
  }
  
  // Start the initialization process
  return initializeTransactionElements();
};

// Make sure it's properly exported
export { initTransactions }; 