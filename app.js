try {
  console.log('Initializing transactions module');
  if (typeof initTransactions === 'function') {
    const success = initTransactions();
    if (!success) {
      console.log('Transaction initialization deferred');
    }
  } else {
    console.error('initTransactions is not a function');
  }
} catch (error) {
  console.error('Error initializing transactions:', error);
} 