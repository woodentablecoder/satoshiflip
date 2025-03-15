/**
 * Utility functions for SatoshiFlip
 */

// Show toast notification
export const showToast = (message, type = 'info') => {
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