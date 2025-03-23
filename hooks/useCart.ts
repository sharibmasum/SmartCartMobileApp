import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveCart, addToCart, removeCartItem, updateCartItemQuantity, checkoutCart } from '../services/cart';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';
import { getProductById } from '../services/products';

// Set this to true for debugging
const SHOW_DEBUG_ERRORS = true;

// Custom logger that can be turned on/off
const logError = (message: string, error: any) => {
  if (SHOW_DEBUG_ERRORS) {
    console.error(message, error);
  }
};

// Custom logger for debug information
const logDebug = (message: string, data?: any) => {
  if (SHOW_DEBUG_ERRORS) {
    if (data) {
      console.log(`[CartDebug] ${message}`, data);
    } else {
      console.log(`[CartDebug] ${message}`);
    }
  }
};

// Keys for AsyncStorage
const CART_STORAGE_KEY = (userId: string) => `@SmartCart:cartData:${userId}`;
const CART_LAST_SYNC_KEY = (userId: string) => `@SmartCart:lastSync:${userId}`;

// Helper function to check if a string is a valid UUID
function isValidUUID(uuid: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidPattern.test(uuid);
}

// Helper function to generate a valid UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Hook for managing cart state and operations
export const useCart = (userId: string) => {
  // Check if userId is valid UUID format
  const isValidUser = isValidUUID(userId);
  
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);
  const cartIdRef = useRef<string | null>(null);

  // Save cart to AsyncStorage for offline persistence
  const persistCart = useCallback(async (cartData: Cart | null) => {
    if (!cartData || !isValidUser) return;
    
    try {
      // Store the cartId for reference
      if (cartData.id) {
        cartIdRef.current = cartData.id;
      }
      
      await AsyncStorage.setItem(CART_STORAGE_KEY(userId), JSON.stringify(cartData));
      const now = new Date();
      await AsyncStorage.setItem(CART_LAST_SYNC_KEY(userId), now.toISOString());
      setLastSynced(now);
      logDebug(`Cart saved to storage: ${cartData.items.length} items for user ${userId}`);
    } catch (err) {
      logError('Error saving cart to AsyncStorage:', err);
    }
  }, [userId, isValidUser]);

  // Load cart from AsyncStorage (for offline access)
  const loadPersistedCart = useCallback(async () => {
    if (!isValidUser) return false;
    
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY(userId));
      const lastSync = await AsyncStorage.getItem(CART_LAST_SYNC_KEY(userId));
      
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart) as Cart;
        
        // Ensure the cart has all required properties
        if (!parsedCart.items) {
          parsedCart.items = [];
        }
        
        setCart(parsedCart);
        
        // Store the cartId for reference
        if (parsedCart.id) {
          cartIdRef.current = parsedCart.id;
          logDebug(`Loaded stored cart ID: ${parsedCart.id} for user ${userId}`);
        }
        
        logDebug(`Loaded cart from storage: ${parsedCart.items.length} items for user ${userId}`);
      }
      
      if (lastSync) {
        setLastSynced(new Date(lastSync));
      }
      
      return !!storedCart;
    } catch (err) {
      logError('Error loading cart from AsyncStorage:', err);
      return false;
    }
  }, [userId, isValidUser]);

  // Fix missing product data in cart items
  const fixMissingProducts = useCallback(async () => {
    if (!cart || !cart.items || cart.items.length === 0) return;
    
    logDebug(`Checking for missing product data in ${cart.items.length} cart items`);
    
    // Track if we need to update the cart
    let needsUpdate = false;
    
    // Create a new cart copy with updated items
    const updatedCart = { ...cart };
    
    // Check each item for missing product data
    for (let i = 0; i < updatedCart.items.length; i++) {
      const item = updatedCart.items[i];
      if (!item.product) {
        logDebug(`Missing product for item ${item.id}, product_id: ${item.product_id}. Fetching...`);
        
        try {
          // Try to fetch the product by ID
          const product = await getProductById(item.product_id);
          
          if (product) {
            logDebug(`Found product data for ${item.id}: ${product.name}`);
            
            // Update the item with the product data
            updatedCart.items[i] = {
              ...item,
              product
            };
            
            needsUpdate = true;
          } else {
            logDebug(`Could not find product data for ${item.id}`);
          }
        } catch (err) {
          logError('Error fetching product for item:', err);
        }
      }
    }
    
    // Update the cart state if we found any missing products
    if (needsUpdate) {
      logDebug(`Updating cart with fixed product data`);
      setCart(updatedCart);
      await persistCart(updatedCart);
    }
  }, [cart, persistCart]);

  // Load cart data from backend
  const loadCart = useCallback(async (forceRefresh = false) => {
    if (!userId || !isValidUser) {
      setError("Invalid user ID");
      setLoading(false);
      return;
    }
    
    logDebug(`Loading cart for user ${userId} (force refresh: ${forceRefresh})`);
    
    try {
      setLoading(true);
      
      // Try to load from AsyncStorage first if not forcing refresh
      if (!forceRefresh && !initialLoadDone.current) {
        const hasPersistedCart = await loadPersistedCart();
        
        // If cart was loaded from storage and is recent (last 30 mins), use it
        if (hasPersistedCart && lastSynced) {
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          if (lastSynced > thirtyMinutesAgo) {
            setLoading(false);
            initialLoadDone.current = true;
            logDebug("Using recent cart from AsyncStorage");
            
            // Fix any missing product data in the persisted cart
            await fixMissingProducts();
            return;
          }
        }
      }
      
      // Load from backend
      logDebug("Fetching cart from backend");
      const cartData = await getActiveCart(userId);
      
      if (cartData) {
        logDebug(`Got cart from backend, ID: ${cartData.id}, items: ${cartData.items.length}`);
        setCart(cartData);
        cartIdRef.current = cartData.id;
        // Persist to AsyncStorage
        await persistCart(cartData);
        
        // Check for missing product data and try to fix
        await fixMissingProducts();
      } else {
        logDebug("No cart data returned from backend");
      }
      
      setError(null);
      initialLoadDone.current = true;
    } catch (err) {
      logError('Error loading cart:', err);
      setError('Failed to load cart');
      
      // Fall back to persisted data if backend load fails
      if (!initialLoadDone.current) {
        logDebug("Falling back to persisted cart after backend error");
        await loadPersistedCart();
        
        // Try to fix any missing product data
        await fixMissingProducts();
      }
    } finally {
      setLoading(false);
    }
  }, [userId, persistCart, loadPersistedCart, isValidUser, fixMissingProducts]);

  // Add product to cart
  const addProductToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!userId || !isValidUser) {
      logDebug("Cannot add to cart: Invalid user ID");
      return null;
    }
    
    try {
      setLoading(true);
      logDebug(`Adding product to cart: ${product.name}, quantity: ${quantity}`);
      
      // Try to add to database
      const cartItem = await addToCart(userId, product, quantity);
      
      if (cartItem) {
        logDebug(`Successfully added item to cart, ID: ${cartItem.id}`);
        
        // Also update local cart for resilience
        if (cart) {
          try {
            // Optimistic update to local cart
            const updatedCart = { ...cart };
            const existingItemIndex = updatedCart.items.findIndex(item => 
              item.product_id === product.id
            );
            
            if (existingItemIndex >= 0) {
              // Update existing item
              updatedCart.items[existingItemIndex].quantity += quantity;
              updatedCart.items[existingItemIndex].updated_at = new Date().toISOString();
              logDebug(`Updated existing item in local cart, new quantity: ${updatedCart.items[existingItemIndex].quantity}`);
            } else {
              // Add the new cart item from the database
              updatedCart.items.push(cartItem);
              logDebug(`Added new item to local cart`);
            }
            
            updatedCart.updated_at = new Date().toISOString();
            
            // Update state and storage without waiting for network
            setCart(updatedCart);
            await persistCart(updatedCart);
          } catch (optimisticError) {
            logError('Error in optimistic update:', optimisticError);
          }
        } else {
          logDebug("No local cart to update, will refresh from server");
        }
      } else {
        logDebug("Failed to add item to cart in database, server returned null");
      }
      
      // Refresh cart to get the latest state from the server
      await loadCart(true);
      
      return cartItem;
    } catch (error) {
      logError('Error adding product to cart:', error);
      setError('Failed to add product to cart');
      
      // Try to create a new cart if the error might be due to missing cart
      try {
        logDebug("Attempting to refresh cart after error");
        await loadCart(true);
      } catch (refreshError) {
        logError('Error refreshing cart after add failure:', refreshError);
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, loadCart, cart, persistCart, isValidUser]);

  // Remove item from cart
  const removeItem = useCallback(async (cartItemId: string) => {
    try {
      setLoading(true);
      logDebug(`Removing item from cart: ${cartItemId}`);
      
      const result = await removeCartItem(cartItemId);
      
      if (result) {
        logDebug("Successfully removed item from cart");
        // Optimistic update - remove from local cart before refresh
        if (cart) {
          const updatedCart = { ...cart };
          updatedCart.items = updatedCart.items.filter(item => item.id !== cartItemId);
          updatedCart.updated_at = new Date().toISOString();
          setCart(updatedCart);
          await persistCart(updatedCart);
        }
        
        // Refresh cart after removing item
        await loadCart(true);
        return true;
      }
      
      logDebug("Failed to remove item from cart");
      return false;
    } catch (err) {
      setError('Failed to remove item from cart');
      logError('Error removing item from cart:', err);
      
      // Optimistic update for offline support
      if (cart) {
        const updatedCart = { ...cart };
        updatedCart.items = updatedCart.items.filter(item => item.id !== cartItemId);
        setCart(updatedCart);
        await persistCart(updatedCart);
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadCart, cart, persistCart]);

  // Update item quantity
  const updateItemQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    try {
      setLoading(true);
      logDebug(`Updating item quantity: ${cartItemId}, new quantity: ${quantity}`);
      
      const updatedItem = await updateCartItemQuantity(cartItemId, quantity);
      
      // Update the local state for immediate UI feedback
      if (updatedItem && cart) {
        const updatedCart = { ...cart };
        const itemIndex = updatedCart.items.findIndex(item => item.id === cartItemId);
        
        if (itemIndex >= 0) {
          // Update the quantity in the local cart
          updatedCart.items[itemIndex].quantity = quantity;
          updatedCart.items[itemIndex].updated_at = new Date().toISOString();
          updatedCart.updated_at = new Date().toISOString();
          
          // Update state and persist to storage
          setCart(updatedCart);
          await persistCart(updatedCart);
          logDebug("Updated item quantity in local cart");
        }
      }
      
      // Refresh cart to ensure sync with server
      await loadCart(true);
      
      return updatedItem;
    } catch (err) {
      setError('Failed to update item quantity');
      logError('Error updating item quantity:', err);
      
      // Optimistic update for offline support
      if (cart) {
        const updatedCart = { ...cart };
        const itemIndex = updatedCart.items.findIndex(item => item.id === cartItemId);
        
        if (itemIndex >= 0) {
          if (quantity <= 0) {
            // Remove the item if quantity is 0 or negative
            updatedCart.items = updatedCart.items.filter(item => item.id !== cartItemId);
          } else {
            // Update the quantity
            updatedCart.items[itemIndex].quantity = quantity;
            updatedCart.items[itemIndex].updated_at = new Date().toISOString();
          }
          
          setCart(updatedCart);
          await persistCart(updatedCart);
        }
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadCart, cart, persistCart]);

  // Checkout and complete the cart
  const checkout = useCallback(async (paymentMethod: string = 'credit_card') => {
    if (!cart) {
      logDebug("Cannot checkout: No active cart");
      return false;
    }
    
    try {
      setLoading(true);
      logDebug(`Starting checkout for cart: ${cart.id}`);
      
      const result = await checkoutCart(cart.id, paymentMethod);
      
      if (result) {
        logDebug("Checkout successful");
        // Clear local cart after successful checkout
        setCart(null);
        await AsyncStorage.removeItem(CART_STORAGE_KEY(userId));
        await AsyncStorage.removeItem(CART_LAST_SYNC_KEY(userId));
        
        // Refresh to get a new active cart
        setTimeout(() => loadCart(true), 500);
        
        return true;
      }
      
      logDebug("Checkout failed");
      return false;
    } catch (err) {
      setError('Failed to complete checkout');
      logError('Error during checkout:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cart, loadCart, persistCart, userId]);

  // Calculate cart totals
  const getCartTotals = useCallback(() => {
    if (!cart || !cart.items || cart.items.length === 0) {
      return {
        subtotal: 0,
        tax: 0,
        total: 0,
        itemCount: 0,
      };
    }

    const subtotal = cart.items.reduce((acc, item) => {
      if (!item.product || typeof item.product.price !== 'number') {
        console.warn('Invalid product in cart item:', item);
        // Skip items with missing product data instead of failing
        return acc;
      }
      return acc + (item.product.price * item.quantity);
    }, 0);
    
    const tax = subtotal * 0.08; // Assuming 8% tax rate
    const total = subtotal + tax;
    const itemCount = cart.items.reduce((acc, item) => acc + item.quantity, 0);

    return {
      subtotal,
      tax,
      total,
      itemCount,
    };
  }, [cart]);

  // Clear the entire cart
  const clearCart = useCallback(async () => {
    if (!cart) {
      logDebug("Cannot clear cart: No active cart");
      return false;
    }
    
    try {
      setLoading(true);
      logDebug(`Clearing cart: ${cart.id}`);
      
      // Remove all items one by one from the backend
      const removePromises = cart.items.map(item => removeCartItem(item.id));
      await Promise.all(removePromises);
      
      // Optimistically update local cart
      const updatedCart = { ...cart, items: [], updated_at: new Date().toISOString() };
      setCart(updatedCart);
      await persistCart(updatedCart);
      
      // Refresh cart
      await loadCart(true);
      
      return true;
    } catch (err) {
      setError('Failed to clear cart');
      logError('Error clearing cart:', err);
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [cart, loadCart, persistCart]);

  // Sync cart with backend (can be called manually)
  const syncCart = useCallback(async () => {
    logDebug("Manual sync requested");
    return loadCart(true);
  }, [loadCart]);

  // Initialize cart on component mount - only runs once
  useEffect(() => {
    if (!initialLoadDone.current && isValidUser) {
      logDebug(`Initial cart load for user: ${userId}`);
      loadCart();
    }
  }, [loadCart, isValidUser, userId]); 

  return {
    cart,
    loading,
    error,
    lastSynced,
    loadCart,
    syncCart,
    addProductToCart,
    removeItem,
    updateItemQuantity,
    getCartTotals,
    checkout,
    clearCart,
    fixMissingProducts,
  };
}; 