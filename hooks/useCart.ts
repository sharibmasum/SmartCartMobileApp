import { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { getActiveCart, addToCart, removeCartItem, updateCartItemQuantity } from '../services/cart';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';

// Hook for managing cart state and operations
export const useCart = (userId: string) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load cart data
  const loadCart = useCallback(async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      const cartData = await getActiveCart(userId);
      setCart(cartData);
      setError(null);
    } catch (err) {
      setError('Failed to load cart');
      console.error('Error loading cart:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // Add product to cart
  const addProductToCart = useCallback(async (product: Product, quantity = 1) => {
    if (!userId) return null;
    
    try {
      setLoading(true);
      const item = await addToCart(userId, product, quantity);
      
      // Refresh cart after adding item
      await loadCart();
      
      return item;
    } catch (err) {
      setError('Failed to add product to cart');
      console.error('Error adding product to cart:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [userId, loadCart]);

  // Remove item from cart
  const removeItem = useCallback(async (cartItemId: string) => {
    try {
      setLoading(true);
      const result = await removeCartItem(cartItemId);
      
      if (result) {
        // Refresh cart after removing item
        await loadCart();
        return true;
      }
      return false;
    } catch (err) {
      setError('Failed to remove item from cart');
      console.error('Error removing item from cart:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [loadCart]);

  // Update item quantity
  const updateItemQuantity = useCallback(async (cartItemId: string, quantity: number) => {
    try {
      setLoading(true);
      const updatedItem = await updateCartItemQuantity(cartItemId, quantity);
      
      // Refresh cart after updating item
      await loadCart();
      
      return updatedItem;
    } catch (err) {
      setError('Failed to update item quantity');
      console.error('Error updating item quantity:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [loadCart]);

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

  // Initialize cart on component mount
  useEffect(() => {
    loadCart();
  }, [loadCart]);

  return {
    cart,
    loading,
    error,
    loadCart,
    addProductToCart,
    removeItem,
    updateItemQuantity,
    getCartTotals,
  };
}; 