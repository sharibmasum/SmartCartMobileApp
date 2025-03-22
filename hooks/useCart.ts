import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getActiveCart, addToCart, removeCartItem, updateCartItemQuantity, checkoutCart } from '../services/cart';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';

// Keys for AsyncStorage
const CART_STORAGE_KEY = '@SmartCart:cartData';
const CART_LAST_SYNC_KEY = '@SmartCart:lastSync';

// Hook for managing cart state and operations
export const useCart = (userId: string) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const initialLoadDone = useRef(false);

  // Save cart to AsyncStorage for offline persistence
  const persistCart = useCallback(async (cartData: Cart | null) => {
    if (!cartData) return;
    
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
      const now = new Date();
      await AsyncStorage.setItem(CART_LAST_SYNC_KEY, now.toISOString());
      setLastSynced(now);
    } catch (err) {
      console.error('Error saving cart to AsyncStorage:', err);
    }
  }, []);

  // Load cart from AsyncStorage (for offline access)
  const loadPersistedCart = useCallback(async () => {
    try {
      const storedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
      const lastSync = await AsyncStorage.getItem(CART_LAST_SYNC_KEY);
      
      if (storedCart) {
        setCart(JSON.parse(storedCart));
      }
      
      if (lastSync) {
        setLastSynced(new Date(lastSync));
      }
      
      return !!storedCart;
    } catch (err) {
      console.error('Error loading cart from AsyncStorage:', err);
      return false;
    }
  }, []);

  // Load cart data from backend
  const loadCart = useCallback(async (forceRefresh = false) => {
    if (!userId) return;
    
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
            return;
          }
        }
      }
      
      // Load from backend
      const cartData = await getActiveCart(userId);
      
      if (cartData) {
        setCart(cartData);
        // Persist to AsyncStorage
        await persistCart(cartData);
      }
      
      setError(null);
      initialLoadDone.current = true;
    } catch (err) {
      setError('Failed to load cart');
      console.error('Error loading cart:', err);
      
      // Fall back to persisted data if backend load fails
      if (!initialLoadDone.current) {
        await loadPersistedCart();
      }
    } finally {
      setLoading(false);
    }
  }, [userId, persistCart, loadPersistedCart]);

  // Add product to cart
  const addProductToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!userId) return null;
    
    try {
      setLoading(true);
      
      // Validate product data and provide defaults for required fields
      const validatedProduct: Product = {
        id: product.id || `temp_${Date.now()}`,
        name: product.name || 'Unknown Product',
        description: product.description || '',
        price: typeof product.price === 'number' ? product.price : 0,
        image_url: product.image_url || '',
        barcode: product.barcode || '',
        category: product.category || 'Uncategorized',
        created_at: product.created_at || new Date().toISOString(),
        updated_at: product.updated_at || new Date().toISOString()
      };
      
      const item = await addToCart(userId, validatedProduct, quantity);
      
      // Refresh cart after adding item
      await loadCart(true);
      
      return item;
    } catch (err) {
      setError('Failed to add product to cart');
      console.error('Error adding product to cart:', err);
      
      // Optimistic update for offline support
      if (cart) {
        try {
          const updatedCart = { ...cart };
          const validatedProduct: Product = {
            id: product.id || `temp_${Date.now()}`,
            name: product.name || 'Unknown Product', 
            description: product.description || '',
            price: typeof product.price === 'number' ? product.price : 0,
            image_url: product.image_url || '',
            barcode: product.barcode || '',
            category: product.category || 'Uncategorized',
            created_at: product.created_at || new Date().toISOString(),
            updated_at: product.updated_at || new Date().toISOString()
          };
          
          const existingItemIndex = updatedCart.items.findIndex(item => 
            item.product_id === validatedProduct.id
          );
          
          if (existingItemIndex >= 0) {
            // Update existing item
            updatedCart.items[existingItemIndex].quantity += quantity;
          } else {
            // Add new item
            const newItem: CartItem = {
              id: `temp_${Date.now()}`,
              product_id: validatedProduct.id,
              cart_id: updatedCart.id,
              quantity,
              product: validatedProduct,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            };
            updatedCart.items.push(newItem);
          }
          
          setCart(updatedCart);
          await persistCart(updatedCart);
        } catch (optimisticError) {
          console.error('Error in optimistic update:', optimisticError);
        }
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, loadCart, cart, persistCart]);

  // Remove item from cart
  const removeItem = useCallback(async (cartItemId: string) => {
    try {
      setLoading(true);
      const result = await removeCartItem(cartItemId);
      
      if (result) {
        // Refresh cart after removing item
        await loadCart(true);
        return true;
      }
      
      return false;
    } catch (err) {
      setError('Failed to remove item from cart');
      console.error('Error removing item from cart:', err);
      
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
      const updatedItem = await updateCartItemQuantity(cartItemId, quantity);
      
      // Refresh cart after updating item
      await loadCart(true);
      
      return updatedItem;
    } catch (err) {
      setError('Failed to update item quantity');
      console.error('Error updating item quantity:', err);
      
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
  }, [loadCart, cart, persistCart]);

  // Checkout and complete the cart
  const checkout = useCallback(async (paymentMethod: string = 'credit_card') => {
    if (!cart) return false;
    
    try {
      setLoading(true);
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
      console.error('Error during checkout:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [cart, loadCart]);

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
      
      // Remove all items one by one from the backend
      const removePromises = cart.items.map(item => removeCartItem(item.id));
      await Promise.all(removePromises);
      
      // Refresh cart
      await loadCart(true);
      
      return true;
    } catch (err) {
      setError('Failed to clear cart');
      console.error('Error clearing cart:', err);
      
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
  }, [cart, loadCart, persistCart]);

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