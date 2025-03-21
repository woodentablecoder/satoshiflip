/**
 * Authentication Module for SatoshiFlip
 * Handles user sign-up, login, and session management
 */

import { signUp, signIn, signOut, getCurrentUser, supabase } from './supabase.js';

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
  
  // Add display name save handler
  const saveButton = document.getElementById('save-display-name');
  if (saveButton) {
    console.log('Adding save display name handler');
    saveButton.addEventListener('click', async () => {
      const displayNameInput = document.getElementById('display-name-input');
      const newDisplayName = displayNameInput.value.trim();
      
      if (!newDisplayName) {
        const authErrorElement = document.getElementById('auth-error');
        authErrorElement.textContent = 'Display name cannot be empty';
        authErrorElement.classList.add('text-red-500');
        authErrorElement.classList.remove('text-green-500');
        return;
      }
      
      try {
        // Disable button and show loading state
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
        
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) throw new Error('No user logged in');
        
        console.log('Updating display name for user:', user.id);
        
        // Get the auth error element directly
        const authErrorElement = document.getElementById('auth-error');
        
        // Check if display name is already taken by another user
        const { data: existingUser, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('display_name', newDisplayName)
          .neq('id', user.id)
          .single();
          
        if (existingUser) {
          throw new Error('This display name is already taken. Please choose another one.');
        }
        
        const { data, error } = await supabase
          .from('users')
          .update({ display_name: newDisplayName })
          .eq('id', user.id)
          .select();

        console.log('Update response:', { data, error });

        if (error) throw error;
        
        authErrorElement.textContent = 'Display name updated successfully!';
        authErrorElement.classList.remove('text-red-500');
        authErrorElement.classList.add('text-green-500');
        
        // Update any UI elements that show the display name
        const userDisplayElements = document.querySelectorAll('.user-display-name');
        userDisplayElements.forEach(el => el.textContent = newDisplayName);
        
      } catch (error) {
        console.error('Error updating display name:', error);
        console.log('Error type:', typeof error);
        console.log('Error stringified:', JSON.stringify(error, null, 2));
        
        // Get the auth error element directly
        const authErrorElement = document.getElementById('auth-error');
        
        // Check for unique constraint violation error - handle multiple error formats
        if (
            // Check for message string format
            (error.message && (
              error.message.includes('duplicate key value violates unique constraint "unique_display_name"') ||
              error.message.includes('violates unique constraint')
            )) || 
            // Check for error code format (409 Conflict)
            (error.code === '23505') ||
            // Check for error object with message property
            (error.error && error.error.message && 
              error.error.message.includes('unique constraint')) ||
            // Check for the specific error format we're seeing in the console
            (error.status === 409) ||
            // Check for the specific error format with code property
            (error.code && error.code === 23505) ||
            // Check for JSON error response
            (typeof error === 'object' && JSON.stringify(error).includes('duplicate key value'))
        ) {
          authErrorElement.textContent = 'Username already taken, please choose another.';
        } else {
          authErrorElement.textContent = 'Failed to update display name: ' + (error.message || 'Unknown error');
        }
        
        authErrorElement.classList.add('text-red-500');
        authErrorElement.classList.remove('text-green-500');
      } finally {
        // Re-enable button and restore text
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
      }
    });
  } else {
    console.error('Save display name button not found');
  }
  
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

    // Get the user data
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (user) {
      // Create unique BTC address
      const timestamp = Date.now();
      const uniqueBtcAddress = `btc-${timestamp}-${user.id.substring(0, 8)}`;
      
      // Create user record in database
      console.log('Creating new user record for:', user.id);
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          display_name: null,
          balance: 0,
          btc_address: uniqueBtcAddress
        });

      if (createError) {
        console.error('Error creating user record:', createError);
      }
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

    // Get the user data
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw new Error('Failed to get user data');
    }

    // Check if user exists in the database
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();

    if (checkError && checkError.code === 'PGRST116') {
      // Create unique BTC address
      const timestamp = Date.now();
      const uniqueBtcAddress = `btc-${timestamp}-${user.id.substring(0, 8)}`;
      
      // User doesn't exist in database, create them
      console.log('Creating new user record for:', user.id);
      const { error: createError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email,
          display_name: null,
          balance: 0,
          btc_address: uniqueBtcAddress
        });

      if (createError) {
        console.error('Error creating user record:', createError);
      }
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
    await updateUIForAuthState(true);
    
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
    await updateUIForAuthState(false);
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
            balance: 0,
            display_name: null
          });
          
          if (insertError) {
            console.error('Error creating user record during state check:', insertError);
          }
        }
      } catch (error) {
        console.error('Failed to create user record during state check:', error);
      }
    }
    
    await updateUIForAuthState(true);
  } else {
    // User is not logged in
    document.getElementById('login-container').classList.remove('hidden');
    userInfo.classList.add('hidden');
    
    await updateUIForAuthState(false);
  }
}

// Update UI based on auth state
async function updateUIForAuthState(isLoggedIn) {
  // Show/hide auth button
  const explicitAuthBtn = document.getElementById('explicit-auth-btn');
  if (explicitAuthBtn) {
    if (isLoggedIn) {
      explicitAuthBtn.innerHTML = '<img src="public/images/smile-mouth-open.svg" alt="Profile" style="filter: brightness(0) invert(1);">';
    } else {
      explicitAuthBtn.innerHTML = '<img src="public/images/smile-mouth-open.svg" alt="Login / Sign Up" style="filter: brightness(0) invert(1);">';
    }
  }
  
  // Show/hide login/signup forms and user info
  const loginContainer = document.getElementById('login-container');
  const signupContainer = document.getElementById('signup-container');
  const userInfo = document.getElementById('user-info');

  if (isLoggedIn) {
    loginContainer.classList.add('hidden');
    signupContainer.classList.add('hidden');
    userInfo.classList.remove('hidden');
    
    // Add display name save handler when user info becomes visible
    const saveButton = document.getElementById('save-display-name');
    if (saveButton) {
      console.log('Adding save display name handler');
      // Remove any existing listeners to prevent duplicates
      const newSaveButton = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(newSaveButton, saveButton);
      
      // Load current display name if it exists
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (user) {
        const { data: userData, error: userDataError } = await supabase
          .from('users')
          .select('display_name')
          .eq('id', user.id)
          .single();
          
        if (!userDataError && userData?.display_name) {
          document.getElementById('display-name-input').value = userData.display_name;
        }
      }
      
      newSaveButton.addEventListener('click', async () => {
        const displayNameInput = document.getElementById('display-name-input');
        const newDisplayName = displayNameInput.value.trim();
        const authErrorElement = document.getElementById('auth-error');
        
        if (!newDisplayName) {
          authErrorElement.textContent = 'Display name cannot be empty';
          authErrorElement.classList.add('text-red-500');
          authErrorElement.classList.remove('text-green-500');
          return;
        }
        
        try {
          // Disable button and show loading state
          newSaveButton.disabled = true;
          newSaveButton.textContent = 'Saving...';
          
          const { data: { user }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !user) throw new Error('No user logged in');
          
          console.log('Updating display name for user:', user.id);
          
          // Get the auth error element directly
          const authErrorElement = document.getElementById('auth-error');
          
          // Check if display name is already taken by another user
          const { data: existingUser, error: checkError } = await supabase
            .from('users')
            .select('id')
            .eq('display_name', newDisplayName)
            .neq('id', user.id)
            .single();
            
          if (existingUser) {
            throw new Error('already taken.');
          }
          
          const { data, error } = await supabase
            .from('users')
            .update({ display_name: newDisplayName })
            .eq('id', user.id)
            .select();

          console.log('Update response:', { data, error });

          if (error) throw error;
          
          authErrorElement.textContent = 'Display name updated successfully!';
          authErrorElement.classList.remove('text-red-500');
          authErrorElement.classList.add('text-green-500');
          
          // Update any UI elements that show the display name
          const userDisplayElements = document.querySelectorAll('.user-display-name');
          userDisplayElements.forEach(el => el.textContent = newDisplayName);
          
        } catch (error) {
          // More detailed error logging
          console.error('Error updating display name:', error);
          console.log('Error type:', typeof error);
          console.log('Error stringified:', JSON.stringify(error, null, 2));
          
          // Get the auth error element directly
          const authErrorElement = document.getElementById('auth-error');
          
          // Check for unique constraint violation error - handle multiple error formats
          if (
              // Check for message string format
              (error.message && (
                error.message.includes('duplicate key value violates unique constraint "unique_display_name"') ||
                error.message.includes('violates unique constraint')
              )) || 
              // Check for error code format (409 Conflict)
              (error.code === '23505') ||
              // Check for error object with message property
              (error.error && error.error.message && 
                error.error.message.includes('unique constraint')) ||
              // Check for the specific error format we're seeing in the console
              (error.status === 409) ||
              // Check for the specific error format with code property
              (error.code && error.code === 23505) ||
              // Check for JSON error response
              (typeof error === 'object' && JSON.stringify(error).includes('duplicate key value'))
          ) {
            authErrorElement.textContent = 'Username already taken, please choose another.';
          } else {
            authErrorElement.textContent = 'Failed to update display name: ' + (error.message || 'Unknown error');
          }
          
          authErrorElement.classList.add('text-red-500');
          authErrorElement.classList.remove('text-green-500');
        } finally {
          // Re-enable button and restore text
          newSaveButton.disabled = false;
          newSaveButton.textContent = 'Save';
        }
      });
    } else {
      console.error('Save display name button not found');
    }
  } else {
    loginContainer.classList.remove('hidden');
    signupContainer.classList.add('hidden');
    userInfo.classList.add('hidden');
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
      wagerInput.placeholder = '₿ 000 000 000';
    }
  }
  
  // Publish auth state change event
  window.dispatchEvent(new CustomEvent('authStateChanged', { 
    detail: { isLoggedIn, user: isLoggedIn ? await getCurrentUser() : null } 
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
          const { data, error } = await supabase.auth.getUser();
          
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