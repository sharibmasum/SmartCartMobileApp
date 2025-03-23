import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../services/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../hooks/useCart';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Theme } from '../../theme';
import CartItem from '../../components/cart/CartItem';
import Button from '../../components/ui/Button';
import { MaterialIcons } from '@expo/vector-icons';
import { getCurrentUser } from '../../services/auth';
import { preloadProduct } from '../../services/cart';

// Enable debug logging
const SHOW_DEBUG_LOGS = true;

// Helper function for logging debug information
const logDebug = (message: string, data?: any) => {
  if (SHOW_DEBUG_LOGS) {
    if (data) {
      console.log(`[CartPage] ${message}`, data);
    } else {
      console.log(`[CartPage] ${message}`);
    }
  }
};

const CartPage = () => {
  const [userId, setUserId] = useState<string | null>(null);
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [userLoading, setUserLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);
  const productsPreloaded = useRef(false);
  
  // Get the current user's ID when component mounts
  useEffect(() => {
    const getUserId = async () => {
      try {
        setUserLoading(true);
        logDebug('Getting current user');
        const user = await getCurrentUser();
        if (user) {
          logDebug(`User authenticated: ${user.id}`);
          setUserId(user.id);
        } else {
          // If no user is authenticated, redirect to login
          logDebug('No authenticated user, redirecting to login');
          Alert.alert("Authentication Required", "Please login to view your cart.", 
            [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
          );
        }
      } catch (error) {
        console.error('Error getting user:', error);
        Alert.alert("Authentication Error", "Unable to verify your login. Please try again.",
          [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
        );
      } finally {
        setUserLoading(false);
      }
    };
    
    getUserId();
  }, []);
  
  const {
    cart,
    loading,
    error,
    loadCart,
    getCartTotals,
    updateItemQuantity,
    removeItem,
    checkout,
    fixMissingProducts,
  } = useCart(userId || '');

  // Load cart when component mounts or when userId changes or when refresh param is present
  useEffect(() => {
    if (userId) {
      logDebug(`Loading cart for user: ${userId}, refresh: ${refresh}`);
      // Load the cart once when userId is available or refresh param changes
      loadCart(true).then(() => {
        // After loading the cart, mark products as not preloaded so they can be preloaded once
        productsPreloaded.current = false;
      });
    }
  }, [userId, loadCart, refresh]);
  
  // This is a separate useEffect just for debugging
  useEffect(() => {
    if (cart) {
      logDebug(`Cart updated - ID: ${cart.id}, Items: ${cart.items.length}`);
      if (cart.items.length > 0) {
        logDebug('Cart items:', cart.items.map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product?.name || 'Missing product',
          quantity: item.quantity,
          has_product: !!item.product
        })));
        
        // Check for missing products and attempt to fix them
        const missingProducts = cart.items.filter(item => !item.product);
        if (missingProducts.length > 0) {
          logDebug(`Found ${missingProducts.length} items with missing product data, attempting to fix...`);
          fixMissingProducts();
        }
        
        // Only preload products once to avoid infinite loading loops
        if (!productsPreloaded.current) {
          const preloadProducts = async () => {
            logDebug('Preloading all product data for cart items');
            
            // Create a set of unique product IDs to avoid duplicate fetches
            const productIds = new Set(cart.items.map(item => item.product_id));
            
            // Preload each product in parallel
            const preloadPromises = Array.from(productIds).map(async (productId) => {
              try {
                const product = await preloadProduct(productId);
                if (product) {
                  logDebug(`Successfully preloaded product: ${product.name}`);
                } else {
                  logDebug(`Failed to preload product: ${productId}`);
                }
              } catch (error) {
                console.error(`Error preloading product ${productId}:`, error);
              }
            });
            
            await Promise.all(preloadPromises);
            logDebug('Finished preloading products');
            
            // Mark preloading as complete - don't load cart again to avoid infinite loop
            productsPreloaded.current = true;
          };
          
          preloadProducts();
        }
      }
    } else {
      logDebug('Cart is null or undefined');
    }
  }, [cart, fixMissingProducts]);

  // Calculate cart totals with useMemo to avoid unnecessary recalculations
  const { subtotal, tax, total, itemCount } = useMemo(() => {
    return getCartTotals();
  }, [cart, getCartTotals]);

  // Handle quantity changes
  const handleQuantityChange = useCallback(async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      return handleRemoveItem(itemId);
    }

    try {
      setIsRefreshing(true);
      logDebug(`Updating quantity - Item ID: ${itemId}, New quantity: ${newQuantity}`);
      
      // Perform the actual update
      await updateItemQuantity(itemId, newQuantity);
      
      // Explicitly refresh the cart to ensure latest data
      await loadCart(true);
    } catch (error) {
      console.error('Failed to update quantity:', error);
      // If there was an error, reload the cart to get the correct state
      await loadCart(true);
    } finally {
      setIsRefreshing(false);
    }
  }, [updateItemQuantity, loadCart]);

  // Handle remove item
  const handleRemoveItem = useCallback(async (itemId: string) => {
    try {
      setIsRefreshing(true);
      logDebug(`Removing item - Item ID: ${itemId}`);
      
      await removeItem(itemId);
      
      // Refresh cart after removing
      await loadCart(true);
    } catch (error) {
      console.error('Failed to remove item:', error);
      Alert.alert('Error', 'Could not remove item from cart');
    } finally {
      setIsRefreshing(false);
    }
  }, [removeItem, loadCart]);

  // Handle checkout
  const handleCheckout = useCallback(async () => {
    try {
      logDebug('Starting checkout process');
      const success = await checkout();
      if (success) {
        logDebug('Checkout completed successfully');
        Alert.alert('Success', 'Checkout completed successfully');
        router.push('/');
      } else {
        logDebug('Checkout failed');
        Alert.alert('Error', 'There was an issue with checkout');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      Alert.alert('Error', 'Failed to complete checkout');
    }
  }, [checkout]);

  // Handle manual refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      logDebug('Manually refreshing cart');
      // Reset the preloaded flag to allow preloading again when refreshing manually
      productsPreloaded.current = false; 
      await loadCart(true);
    } catch (error) {
      console.error('Error refreshing cart:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCart]);

  // If still loading user, show loading screen
  if (userLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Checking authentication...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // If no userId yet, show loading
  if (!userId) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.centeredContainer}>
          <Text style={styles.errorTitle}>Authentication Required</Text>
          <Button
            title="Go to Login"
            onPress={() => router.replace('/(auth)/login')}
            style={styles.loginButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.push('/(main)/scanner')}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load cart</Text>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator color={Theme.colors.primary} />
            ) : (
              <Text style={styles.retryText}>Try Again</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Render loading state
  if (loading && !cart) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.push('/(main)/scanner')}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render empty cart
  if (!cart || !cart.items || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.emptyHeader}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.push('/(main)/scanner')}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
        </View>
        <View style={styles.centeredContainer}>
          <View style={styles.emptyStateImagePlaceholder}>
            <Text style={styles.emptyStateIcon}>🛒</Text>
          </View>
          <Text style={styles.emptyCartTitle}>Your cart is empty</Text>
          <Text style={styles.emptyCartText}>
            Start shopping to add items to your cart
          </Text>
          <Button
            title="Start Shopping"
            onPress={() => router.push('/(main)/scanner')}
            style={styles.shopButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  // Render cart with items
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.push('/(main)/scanner')}
          >
            <MaterialIcons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Shopping Cart</Text>
        </View>
        <Text style={styles.itemCount}>{itemCount} {itemCount === 1 ? 'item' : 'items'}</Text>
      </View>

      {isRefreshing && (
        <View style={styles.refreshingIndicator}>
          <ActivityIndicator size="small" color={Theme.colors.primary} />
          <Text style={styles.refreshingText}>Refreshing...</Text>
        </View>
      )}

      <ScrollView 
        style={styles.cartItemsContainer}
        contentContainerStyle={styles.cartItemsContent}
        showsVerticalScrollIndicator={false}
      >
        {cart.items.map((item) => (
          <CartItem
            key={item.id}
            item={item}
            onUpdateQuantity={handleQuantityChange}
            onRemove={handleRemoveItem}
          />
        ))}

        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>Order Summary</Text>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax (8%)</Text>
            <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.checkoutContainer}>
        <Button
          title="Proceed to Checkout"
          onPress={handleCheckout}
          style={styles.checkoutButton}
          textStyle={styles.checkoutButtonText}
        />
        <TouchableOpacity
          style={styles.continueShoppingButton}
          onPress={() => router.push('/(main)/scanner')}
        >
          <Text style={styles.continueShoppingText}>Continue Shopping</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 6,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  itemCount: {
    fontSize: 16,
    color: '#666',
  },
  refreshingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    backgroundColor: '#f0eeff',
  },
  refreshingText: {
    marginLeft: 8,
    color: '#474472',
    fontSize: 14,
  },
  cartItemsContainer: {
    flex: 1,
  },
  cartItemsContent: {
    padding: 16,
    paddingBottom: 32,
  },
  summaryContainer: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  totalRow: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#474472',
  },
  checkoutContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingBottom: 40,
  },
  checkoutButton: {
    paddingVertical: 14,
    backgroundColor: '#b9b1f0',
  },
  checkoutButtonText: {
    color: 'black',
    fontWeight: '600',
  },
  continueShoppingButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 8,
  },
  continueShoppingText: {
    color: '#b9b1f0',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyStateImagePlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#f0eeff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyStateIcon: {
    fontSize: 80,
  },
  emptyCartTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 8,
    color: '#333',
  },
  emptyCartText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    minWidth: 200,
    backgroundColor: '#474472',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ff6b6b',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 28,
  },
  retryButton: {
    backgroundColor: '#f0eeff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#b9b1f0',
  },
  retryText: {
    color: '#474472',
    fontSize: 16,
    fontWeight: '500',
  },
  emptyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  loginButton: {
    backgroundColor: '#474472',
    marginTop: 16,
  },
});

export default CartPage; 