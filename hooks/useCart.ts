import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveCart, addToCart, removeCartItem, updateCartItemQuantity, checkoutCart } from '../services/cart';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';

// Set this to false to suppress console errors in production
const SHOW_DEBUG_ERRORS = false;

// Custom logger that can be turned off in production
const logError = (message: string, error: any) => {
  if (SHOW_DEBUG_ERRORS) {
    console.error(message, error);
  }
};

// Keys for AsyncStorage
const CART_STORAGE_KEY = '@SmartCart:cartData';
const CART_LAST_SYNC_KEY = '@SmartCart:lastSync';

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
  // Check if userId is valid UUID format, if not use a default one
  const safeUserId = isValidUUID(userId) ? userId : '550e8400-e29b-41d4-a716-446655440000';
  
  // Check if we're using the demo user ID
  const isDemoUser = safeUserId === '550e8400-e29b-41d4-a716-446655440000';
  
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);
  const cartIdRef = useRef<string | null>(null);

  // Save cart to AsyncStorage for offline persistence
  const persistCart = useCallback(async (cartData: Cart | null) => {
    if (!cartData) return;
    
    try {
      // Store the cartId for reference
      if (cartData.id) {
        cartIdRef.current = cartData.id;
      }
      
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
      const now = new Date();
      await AsyncStorage.setItem(CART_LAST_SYNC_KEY, now.toISOString());
      setLastSynced(now);
      console.log(`Cart saved to storage: ${cartData.items.length} items`);
    } catch (err) {
      logError('Error saving cart to AsyncStorage:', err);
    }
  }, []);

  // Load cart from AsyncStorage (for offline access)
  const loadPersistedCart = useCallback(async () => {
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      const lastSync = await AsyncStorage.getItem(CART_LAST_SYNC_KEY);
      
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart) as Cart;
        setCart(parsedCart);
        
        // Store the cartId for reference
        if (parsedCart.id) {
          cartIdRef.current = parsedCart.id;
        }
        
        console.log(`Loaded cart from storage: ${parsedCart.items.length} items`);
      }
      
      if (lastSync) {
        setLastSynced(new Date(lastSync));
      }
      
      return !!storedCart;
    } catch (err) {
      logError('Error loading cart from AsyncStorage:', err);
      return false;
    }
  }, []);

  // Load cart data from backend
  const loadCart = useCallback(async (forceRefresh = false) => {
    if (!safeUserId) return;
    
    try {
      setLoading(true);
      
      // For demo user, always prefer storage first
      if (isDemoUser) {
        const hasPersistedCart = await loadPersistedCart();
        
        if (!hasPersistedCart) {
          // Create a new empty cart for demo user
          const demoCart: Cart = {
            id: generateUUID(),
            user_id: safeUserId,
            status: 'active',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            checkout_at: null,
            items: []
          };
          
          setCart(demoCart);
          cartIdRef.current = demoCart.id;
          await persistCart(demoCart);
        }
        
        setError(null);
        initialLoadDone.current = true;
        setLoading(false);
        return;
      }
      
      // Try to load from AsyncStorage first if not forcing refresh
      if (!forceRefresh && !initialLoadDone.current) {
        const hasPersistedCart = await loadPersistedCart();
        
        // If cart was loaded from storage and is recent (last 30 mins), use it
        if (hasPersistedCart && lastSynced) {
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
          if (lastSynced > thirtyMinutesAgo) {
            setLoading(false);
            initialLoadDone.current = true;
            return;
          }
        }
      }
      
      // Load from backend for authenticated users
      const cartData = await getActiveCart(safeUserId);
      
      if (cartData) {
        setCart(cartData);
        cartIdRef.current = cartData.id;
        // Persist to AsyncStorage
        await persistCart(cartData);
      }
      
      setError(null);
      initialLoadDone.current = true;
    } catch (err) {
      logError('Error loading cart:', err);
      setError(isDemoUser ? null : 'Failed to load cart');
      
      // Fall back to persisted data if backend load fails
      if (!initialLoadDone.current) {
        await loadPersistedCart();
      }
    } finally {
      setLoading(false);
    }
  }, [safeUserId, persistCart, loadPersistedCart, isDemoUser]);

  // Add product to cart
  const addProductToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!safeUserId) return null;
    
    try {
      setLoading(true);
      
      // Validate product data and provide defaults for required fields
      const validatedProduct: Product = {
        id: isValidUUID(product.id) ? product.id : generateUUID(),
        name: product.name || 'Unknown Product',
        description: product.description || '',
        price: typeof product.price === 'number' ? product.price : 0,
        image_url: product.image_url || '',
        barcode: product.barcode || '',
        category: product.category || 'Uncategorized',
        created_at: product.created_at || new Date().toISOString(),
        updated_at: product.updated_at || new Date().toISOString()
      };
      
      // For demo user, handle cart locally
      if (isDemoUser) {
        // Make sure we have a cart
        if (!cart) {
          await loadCart();
          if (!cart) {
            // If still no cart, create one
            const newCart: Cart = {
              id: generateUUID(),
              user_id: safeUserId,
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              checkout_at: null,
              items: []
            };
            setCart(newCart);
            cartIdRef.current = newCart.id;
          }
        }
        
        if (cart) {
          // Check if product is already in cart
          const existingItemIndex = cart.items.findIndex(item => 
            item.product_id === validatedProduct.id
          );
          
          const updatedCart = { ...cart };
          
          if (existingItemIndex >= 0) {
            // Update existing item
            updatedCart.items[existingItemIndex].quantity += quantity;
            updatedCart.items[existingItemIndex].updated_at = new Date().toISOString();
            updatedCart.updated_at = new Date().toISOString();
          } else {
            // Add new item
            const newItem: CartItem = {
              id: generateUUID(),
              product_id: validatedProduct.id,
              cart_id: cart.id,
              quantity,
              product: validatedProduct,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            updatedCart.items.push(newItem);
            updatedCart.updated_at = new Date().toISOString();
          }
          
          // Update state and storage
          setCart(updatedCart);
          await persistCart(updatedCart);
          
          // Return the added/updated item
          const itemIndex = existingItemIndex >= 0 ? existingItemIndex : updatedCart.items.length - 1;
          return updatedCart.items[itemIndex];
        }
        
        return null;
      }
      
      // Regular flow for authenticated users - add to database AND local cart for resilience
      try {
        // Try to add to database
        const cartItem = await addToCart(safeUserId, validatedProduct, quantity);
        
        // Also update local cart for resilience regardless of whether database operation succeeds
        if (cart) {
          try {
            // Optimistic update to local cart
            const updatedCart = { ...cart };
            const existingItemIndex = updatedCart.items.findIndex(item => 
              item.product_id === validatedProduct.id
            );
            
            if (existingItemIndex >= 0) {
              // Update existing item
              updatedCart.items[existingItemIndex].quantity += quantity;
              updatedCart.items[existingItemIndex].updated_at = new Date().toISOString();
            } else {
              // Add new item (use the returned cart item if available, otherwise create a new one)
              const newItem: CartItem = cartItem || {
                id: generateUUID(),
                product_id: validatedProduct.id,
                cart_id: cart.id,
                quantity,
                product: validatedProduct,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              };
              updatedCart.items.push(newItem);
            }
            
            updatedCart.updated_at = new Date().toISOString();
            
            // Update state and storage without waiting for network
            setCart(updatedCart);
            await persistCart(updatedCart);
            
            // Return either the database item or our local item
            return cartItem || (existingItemIndex >= 0 
              ? updatedCart.items[existingItemIndex] 
              : updatedCart.items[updatedCart.items.length - 1]);
          } catch (optimisticError) {
            logError('Error in optimistic update:', optimisticError);
            return cartItem; // Still return the item if we got one from the database
          }
        } else {
          return cartItem;
        }
      } catch (databaseError) {
        logError('Error adding to database cart:', databaseError);
        
        // Database operation failed, but we'll still add to local cart
        if (cart) {
          // Fallback to local cart
          const updatedCart = { ...cart };
          const existingItemIndex = updatedCart.items.findIndex(item => 
            item.product_id === validatedProduct.id
          );
          
          if (existingItemIndex >= 0) {
            // Update existing item
            updatedCart.items[existingItemIndex].quantity += quantity;
            updatedCart.items[existingItemIndex].updated_at = new Date().toISOString();
            updatedCart.updated_at = new Date().toISOString();
            
            // Update state and storage
            setCart(updatedCart);
            await persistCart(updatedCart);
            
            return updatedCart.items[existingItemIndex];
          } else {
            // Add new item
            const newItem: CartItem = {
              id: generateUUID(),
              product_id: validatedProduct.id,
              cart_id: cart.id,
              quantity,
              product: validatedProduct,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            
            updatedCart.items.push(newItem);
            updatedCart.updated_at = new Date().toISOString();
            
            // Update state and storage
            setCart(updatedCart);
            await persistCart(updatedCart);
            
            return newItem;
          }
        }
        
        // If we don't have a local cart, create one with this item
        const newCart: Cart = {
          id: generateUUID(),
          user_id: safeUserId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          checkout_at: null,
          items: [{
            id: generateUUID(),
            product_id: validatedProduct.id,
            cart_id: generateUUID(),
            quantity,
            product: validatedProduct,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }]
        };
        
        setCart(newCart);
        cartIdRef.current = newCart.id;
        await persistCart(newCart);
        
        return newCart.items[0];
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [safeUserId, loadCart, cart, persistCart, isDemoUser]);

  // Remove item from cart
  const removeItem = useCallback(async (cartItemId: string) => {
    try {
      setLoading(true);
      
      // For demo user, handle locally
      if (isDemoUser && cart) {
        const updatedCart = { ...cart };
        updatedCart.items = updatedCart.items.filter(item => item.id !== cartItemId);
        updatedCart.updated_at = new Date().toISOString();
        
        setCart(updatedCart);
        await persistCart(updatedCart);
        return true;
      }
      
      // Regular flow for authenticated users
      const result = await removeCartItem(cartItemId);
      
      if (result) {
        // Refresh cart after removing item
        await loadCart(true);
        return true;
      }
      
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
  }, [loadCart, cart, persistCart, isDemoUser]);

  // Update item quantity
  const updateItemQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    try {
      setLoading(true);
      
      // For demo user, handle locally
      if (isDemoUser && cart) {
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
          
          updatedCart.updated_at = new Date().toISOString();
          setCart(updatedCart);
          await persistCart(updatedCart);
          
          // Return the updated item or null if removed
          return quantity <= 0 ? null : updatedCart.items[itemIndex];
        }
        
        return null;
      }
      
      // Regular flow for authenticated users
      const updatedItem = await updateCartItemQuantity(cartItemId, quantity);
      
      // Refresh cart after updating item
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
          }
          
          setCart(updatedCart);
          await persistCart(updatedCart);
        }
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadCart, cart, persistCart, isDemoUser]);

  // Checkout and complete the cart
  const checkout = useCallback(async (paymentMethod: string = 'credit_card') => {
    if (!cart) return false;
    
    try {
      setLoading(true);
      
      // For demo user, simulate checkout locally
      if (isDemoUser) {
        const completedCart: Cart = {
          ...cart,
          status: 'completed',
          checkout_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Clear cart storage
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
        await AsyncStorage.removeItem(CART_LAST_SYNC_KEY);
        
        // Create new empty cart
        const newCart: Cart = {
          id: generateUUID(),
          user_id: safeUserId,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          checkout_at: null,
          items: []
        };
        
        setCart(newCart);
        cartIdRef.current = newCart.id;
        await persistCart(newCart);
        
        return true;
      }
      
      // Regular flow for authenticated users
      const result = await checkoutCart(cart.id, paymentMethod);
      
      if (result) {
        // Clear local cart after successful checkout
        setCart(null);
        await AsyncStorage.removeItem(CART_STORAGE_KEY);
        await AsyncStorage.removeItem(CART_LAST_SYNC_KEY);
        
        // Refresh to get a new active cart
        setTimeout(() => loadCart(true), 500);
        
        return true;
      }
      
      return false;
    } catch (err) {
      setError('Failed to complete checkout');
      logError('Error during checkout:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cart, loadCart, persistCart, safeUserId, isDemoUser]);

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
    if (!cart) return false;
    
    try {
      setLoading(true);
      
      // For demo user, just clear locally
      if (isDemoUser) {
        const updatedCart = { 
          ...cart, 
          items: [],
          updated_at: new Date().toISOString()
        };
        
        setCart(updatedCart);
        await persistCart(updatedCart);
        return true;
      }
      
      // Regular flow for authenticated users
      // Remove all items one by one from the backend
      const removePromises = cart.items.map(item => removeCartItem(item.id));
      await Promise.all(removePromises);
      
      // Refresh cart
      await loadCart(true);
      
      return true;
    } catch (err) {
      setError('Failed to clear cart');
      logError('Error clearing cart:', err);
      
      // Optimistic update for offline support
      if (cart) {
        const updatedCart = { ...cart, items: [] };
        setCart(updatedCart);
        await persistCart(updatedCart);
      }
      
      return false;
    } finally {
      setLoading(false);
    }
  }, [cart, loadCart, persistCart, isDemoUser]);

  // Sync cart with backend (can be called manually)
  const syncCart = useCallback(async () => {
    return loadCart(true);
  }, [loadCart]);

  // Initialize cart on component mount - only runs once
  useEffect(() => {
    if (!initialLoadDone.current) {
      loadCart();
    }
  }, []); // Empty dependency array ensures this only runs once

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
  };
}; 