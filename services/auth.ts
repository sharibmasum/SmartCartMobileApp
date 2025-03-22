import { supabase } from './supabase';
import { LoginCredentials, RegisterData, User } from '../types/auth.types';

// Register a new user
export const register = async (data: RegisterData): Promise<User> => {
  const { email, password, username } = data;
  
  try {
    // Sign up with email and password
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username } // Store username in user metadata
      }
    });
    
    if (signUpError) {
      console.error('Registration error:', signUpError);
      throw new Error(signUpError.message);
    }
    
    if (!authData.user) {
      throw new Error('Registration failed. No user data returned.');
    }

    // Return the user data
    return {
      id: authData.user.id,
      email: authData.user.email || '',
      username,
      created_at: authData.user.created_at || '',
      updated_at: authData.user.last_sign_in_at || '',
    };
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

// Login with email and password
export const login = async (credentials: LoginCredentials): Promise<User> => {
  const { email, password } = credentials;
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      console.error('Login error:', error);
      throw new Error(error.message);
    }
    
    if (!data.user) {
      throw new Error('Login failed. No user data returned.');
    }

    // Extract username from user metadata
    const username = data.user.user_metadata?.username || email.split('@')[0];
    
    // Return the user data
    return {
      id: data.user.id,
      email: data.user.email || '',
      username,
      created_at: data.user.created_at || '',
      updated_at: data.user.last_sign_in_at || '',
    };
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
};

// Logout
export const logout = async (): Promise<void> => {
  try {
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
      throw new Error(error.message);
    }
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

// Get current user
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data.user) {
      return null;
    }
    
    // Extract username from user metadata
    const username = data.user.user_metadata?.username || data.user.email?.split('@')[0] || '';
    
    return {
      id: data.user.id,
      email: data.user.email || '',
      username,
      created_at: data.user.created_at || '',
      updated_at: data.user.last_sign_in_at || '',
    };
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}; 