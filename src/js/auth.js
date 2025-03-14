/**
 * Authentication Module for SatoshiFlip
 * Handles user sign-up, login, and session management
 */

import { signUp, signIn, signOut, getCurrentUser } from './supabase.js';

// DOM elements for auth forms
let authModal;
let signupForm;
let loginForm;
let authError;
let userInfo;
let logoutBtn;

// Initialize the auth module
export function initAuth() {
  console.log('Initializing auth module');
  
  // Get the auth modal (already exists in HTML)
  authModal = document.getElementById('auth-modal');
  
  // Get references to DOM elements
  signupForm = document.getElementById('signup-form');
  loginForm = document.getElementById('login-form');
  authError = document.getElementById('auth-error');
  userInfo = document.getElementById('user-info');
  logoutBtn = document.getElementById('logout-btn');
  
  if (!authModal || !signupForm || !loginForm || !authError || !userInfo || !logoutBtn) {
    console.error('Could not find all required auth elements', {
      authModal: !!authModal,
      signupForm: !!signupForm,
      loginForm: !!loginForm,
      authError: !!authError,
      userInfo: !!userInfo,
      logoutBtn: !!logoutBtn
    });
    return;
  }
  
  console.log('All auth elements found');
  
  // Set up event listeners
  document.getElementById('toggle-signup').addEventListener('click', () => {
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('signup-container').classList.remove('hidden');
    authError.textContent = '';
  });
  
  document.getElementById('toggle-login').addEventListener('click', () => {
    document.getElementById('signup-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
    authError.textContent = '';
  });
  
  document.getElementById('close-auth-modal').addEventListener('click', () => {
    authModal.classList.add('hidden');
  });
  
  // Auth form submissions
  signupForm.addEventListener('submit', handleSignup);
  loginForm.addEventListener('submit', handleLogin);
  logoutBtn.addEventListener('click', handleLogout);
  
  // Connect explicit auth button (already in HTML)
  const explicitAuthBtn = document.getElementById('explicit-auth-btn');
  if (explicitAuthBtn) {
    console.log('Using explicit auth button');
    explicitAuthBtn.addEventListener('click', () => {
      authModal.classList.remove('hidden');
    });
  }
  
  // Check if user is already logged in
  checkAuthState();
  
  console.log('Auth module initialized');
}

// Handle signup form submission
async function handleSignup(e) {
  e.preventDefault();
  
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  
  // Disable form
  const submitBtn = signupForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Creating Account...';
  
  // Clear previous errors
  authError.textContent = '';
  
  try {
    const result = await signUp(email, password);
    
    if (!result.success) {
      authError.textContent = result.error || 'Failed to create account';
      return;
    }
    
    // Show success message
    authError.textContent = 'Account created! Check your email for verification link.';
    authError.className = 'text-green-500 mb-4 text-sm';
    
    // Reset form
    signupForm.reset();
    
    // Show login form after successful signup
    document.getElementById('signup-container').classList.add('hidden');
    document.getElementById('login-container').classList.remove('hidden');
  } catch (error) {
    authError.textContent = error.message || 'An error occurred during signup';
  } finally {
    // Re-enable form
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Sign Up';
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  // Disable form
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Logging In...';
  
  // Clear previous errors
  authError.textContent = '';
  authError.className = 'text-red-500 mb-4 text-sm';
  
  try {
    const result = await signIn(email, password);
    
    if (!result.success) {
      authError.textContent = result.error || 'Failed to log in';
      return;
    }
    
    // Hide auth forms and show user info
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('signup-container').classList.add('hidden');
    userInfo.classList.remove('hidden');
    
    // Set user email
    document.getElementById('user-email').textContent = email;
    
    // Hide modal after successful login
    authModal.classList.add('hidden');
    
    // Update UI for logged in user
    updateUIForAuthState(true);
    
    // Reset form
    loginForm.reset();
  } catch (error) {
    authError.textContent = error.message || 'An error occurred during login';
  } finally {
    // Re-enable form
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Login';
  }
}

// Handle logout
async function handleLogout() {
  try {
    await signOut();
    
    // Show login form and hide user info
    document.getElementById('login-container').classList.remove('hidden');
    userInfo.classList.add('hidden');
    
    // Update UI for logged out user
    updateUIForAuthState(false);
  } catch (error) {
    authError.textContent = error.message || 'An error occurred during logout';
  }
}

// Check authentication state on page load
async function checkAuthState() {
  const user = await getCurrentUser();
  
  if (user) {
    // User is logged in
    document.getElementById('login-container').classList.add('hidden');
    document.getElementById('signup-container').classList.add('hidden');
    userInfo.classList.remove('hidden');
    document.getElementById('user-email').textContent = user.email;
    
    // Get user data from the database
    const supabase = (await import('./supabase.js')).default;
    
    // Check if user exists in the database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (userError && userError.code === 'PGRST116') {
      // User doesn't exist in the database yet, create a record
      console.log('User authenticated but no database record found. Creating record now.');
      
      // Generate a unique BTC address
      const uniqueBtcAddress = `btc-${Date.now()}-${user.id.substring(0, 8)}`;
      
      try {
        // Try using the RPC function first
        const { error: rpcError } = await supabase.rpc('create_user_record', {
          user_id: user.id,
          user_email: user.email,
          user_btc_address: uniqueBtcAddress
        });
        
        if (rpcError) {
          console.error('Error creating user via RPC:', rpcError);
          
          // Fallback to direct insert
          const { error: insertError } = await supabase.from('users').insert({
            id: user.id,
            email: user.email,
            btc_address: uniqueBtcAddress,
            balance: 0
          });
          
          if (insertError) {
            console.error('Error creating user record during state check:', insertError);
          }
        }
      } catch (error) {
        console.error('Failed to create user record during state check:', error);
      }
    }
    
    updateUIForAuthState(true);
  } else {
    // User is not logged in
    document.getElementById('login-container').classList.remove('hidden');
    userInfo.classList.add('hidden');
    
    updateUIForAuthState(false);
  }
}

// Update UI based on auth state
function updateUIForAuthState(isLoggedIn) {
  // Show/hide auth button
  const explicitAuthBtn = document.getElementById('explicit-auth-btn');
  if (explicitAuthBtn) {
    explicitAuthBtn.textContent = isLoggedIn ? 'Account' : 'Login / Sign Up';
  }
  
  // Enable/disable game creation
  const createGameBtn = document.getElementById('create-game-btn');
  const wagerInput = document.getElementById('wager-amount');
  
  if (createGameBtn) {
    createGameBtn.disabled = !isLoggedIn;
    wagerInput.disabled = !isLoggedIn;
    
    if (!isLoggedIn) {
      createGameBtn.classList.add('opacity-50');
      wagerInput.placeholder = 'Login to play';
    } else {
      createGameBtn.classList.remove('opacity-50');
      wagerInput.placeholder = 'Satoshis';
    }
  }
  
  // Publish auth state change event
  window.dispatchEvent(new CustomEvent('authStateChanged', { 
    detail: { isLoggedIn, user: isLoggedIn ? getCurrentUser() : null } 
  }));
}

// Show auth modal function
function showAuthModal() {
  console.log('Showing auth modal');
  if (authModal) {
    authModal.classList.remove('hidden');
  } else {
    console.error('Auth modal not found');
  }
}

function auth() {
  return {
    initAuth,
    showAuthModal,
    getCurrentUser: () => {
      // Return a promise-based version that is more reliable
      return new Promise(async (resolve) => {
        try {
          const { data, error } = await import('./supabase.js').then(
            module => module.default.auth.getUser()
          );
          
          if (error) {
            console.error('Error getting current user:', error);
            resolve(null);
            return;
          }
          
          if (data && data.user) {
            resolve(data.user);
          } else {
            resolve(null);
          }
        } catch (err) {
          console.error('Error in getCurrentUser:', err);
          resolve(null);
        }
      });
    }
  };
}

export default auth(); 