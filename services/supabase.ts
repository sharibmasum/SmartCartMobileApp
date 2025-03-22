import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Constants for storage
const SECURE_STORE_MAX_SIZE = 2000; // Slightly under the 2048 byte limit to be safe
const STORAGE_KEY_PREFIX = 'supabase.auth.';

// Custom storage adapter that handles large data
const CustomStorageAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      // Try to get from SecureStore first
      const secureValue = await SecureStore.getItemAsync(key);
      
      // Debug storage
      console.log(`getItem: Trying to retrieve key "${key}" from SecureStore:`, secureValue ? 'Found' : 'Not found');
      
      if (secureValue) {
        // If the value is a flag indicating it's in AsyncStorage, get from there
        if (secureValue === 'STORED_IN_ASYNC_STORAGE') {
          const asyncStorageKey = `${STORAGE_KEY_PREFIX}${key}`;
          const asyncValue = await AsyncStorage.getItem(asyncStorageKey);
          console.log(`getItem: Value for "${key}" is in AsyncStorage (${asyncStorageKey}):`, asyncValue ? 'Found' : 'Not found');
          return asyncValue;
        }
        return secureValue;
      }
      
      // If not in SecureStore, try AsyncStorage
      const asyncStorageKey = `${STORAGE_KEY_PREFIX}${key}`;
      const asyncValue = await AsyncStorage.getItem(asyncStorageKey);
      console.log(`getItem: Trying to retrieve key "${asyncStorageKey}" from AsyncStorage:`, asyncValue ? 'Found' : 'Not found');
      return asyncValue;
    } catch (error) {
      console.error('getItem: Error retrieving data from storage:', error);
      return null;
    }
  },
  
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      console.log(`setItem: Storing "${key}" (${value.length} bytes)`);
      
      // Check if the value is too large for SecureStore
      if (value.length > SECURE_STORE_MAX_SIZE) {
        // Store in AsyncStorage for large values
        const asyncStorageKey = `${STORAGE_KEY_PREFIX}${key}`;
        await AsyncStorage.setItem(asyncStorageKey, value);
        
        // Keep a flag in SecureStore to indicate this item is stored in AsyncStorage
        await SecureStore.setItemAsync(key, 'STORED_IN_ASYNC_STORAGE');
        
        console.log(`setItem: Value for key "${key}" was too large for SecureStore (${value.length} bytes), stored in AsyncStorage with key "${asyncStorageKey}"`);
      } else {
        // Value fits in SecureStore, store it there
        await SecureStore.setItemAsync(key, value);
        console.log(`setItem: Stored "${key}" in SecureStore (${value.length} bytes)`);
        
        // Remove any previous version from AsyncStorage if it exists
        const asyncStorageKey = `${STORAGE_KEY_PREFIX}${key}`;
        await AsyncStorage.removeItem(asyncStorageKey);
      }
    } catch (error) {
      console.error('setItem: Error storing data:', error);
    }
  },
  
  removeItem: async (key: string): Promise<void> => {
    try {
      console.log(`removeItem: Removing "${key}" from storage`);
      // Remove from both storage systems to be safe
      await SecureStore.deleteItemAsync(key);
      
      const asyncStorageKey = `${STORAGE_KEY_PREFIX}${key}`;
      await AsyncStorage.removeItem(asyncStorageKey);
      console.log(`removeItem: Removed "${key}" from SecureStore and "${asyncStorageKey}" from AsyncStorage`);
    } catch (error) {
      console.error('removeItem: Error removing data:', error);
    }
  },
};

// Supabase URL and anon key from .env file
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Validate that environment variables are set
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:', { 
    url: supabaseUrl ? 'set' : 'missing', 
    key: supabaseAnonKey ? 'set' : 'missing' 
  });
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('Initializing Supabase client with URL:', supabaseUrl);

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: CustomStorageAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Helper function to get authenticated user
export const getCurrentUser = async () => {
  try {
    console.log('getCurrentUser: Checking if user is authenticated...');
    const { data, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error('getCurrentUser: Error getting user:', error.message);
      return null;
    }
    
    console.log('getCurrentUser: User data received:', data.user ? {
      id: data.user.id,
      email: data.user.email,
      hasSession: !!data.user.id
    } : 'No user found');
    
    return data.user;
  } catch (error) {
    console.error('getCurrentUser: Unexpected error:', error);
    return null;
  }
};

// Helper function to check if user is authenticated
export const isAuthenticated = async () => {
  try {
    console.log('isAuthenticated: Checking authentication status...');
    const user = await getCurrentUser();
    const isAuth = user !== null;
    console.log('isAuthenticated: Authentication result:', isAuth);
    
    // Debug session tokens
    await debugSessionTokens();
    
    return isAuth;
  } catch (error) {
    console.error('isAuthenticated: Error checking authentication:', error);
    return false;
  }
};

// Debug function to examine tokens in storage
async function debugSessionTokens() {
  console.log('=== DEBUG SESSION TOKENS ===');
  const storageKeys = [
    'access-token',
    'refresh-token',
    'supabase-auth-token'
  ];
  
  for (const key of storageKeys) {
    try {
      const secureValue = await SecureStore.getItemAsync(key);
      console.log(`SecureStore: ${key} = ${secureValue ? 'exists' : 'not found'}`);
      
      const asyncKey = `${STORAGE_KEY_PREFIX}${key}`;
      const asyncValue = await AsyncStorage.getItem(asyncKey);
      console.log(`AsyncStorage: ${asyncKey} = ${asyncValue ? 'exists' : 'not found'}`);
    } catch (err) {
      console.error(`Error checking storage for ${key}:`, err);
    }
  }
  console.log('=== END DEBUG SESSION TOKENS ===');
}

// Function to clear all auth tokens
export const clearAllAuthTokens = async () => {
  console.log('Clearing all auth tokens to force login...');
  
  try {
    // Extract project reference from URL to create the token key dynamically
    const projectRef = supabaseUrl ? supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] : '';
    const tokenKey = projectRef ? `sb-${projectRef}-auth-token` : 'supabase-auth-token';
    
    // Clear the token directly
    console.log(`Deleting token: ${tokenKey}`);
    await SecureStore.deleteItemAsync(tokenKey);
    await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${tokenKey}`);

    // Also check alternative formats
    const keysToDelete = [
      'access-token', 
      'refresh-token', 
      'supabase-auth-token'
    ];
    
    for (const key of keysToDelete) {
      await SecureStore.deleteItemAsync(key);
      await AsyncStorage.removeItem(`${STORAGE_KEY_PREFIX}${key}`);
    }
    
    // Force sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error.message);
    } else {
      console.log('Successfully signed out from Supabase');
    }
    
    console.log('All auth tokens cleared');
    return true;
  } catch (error) {
    console.error('Error clearing auth tokens:', error);
    return false;
  }
}; 