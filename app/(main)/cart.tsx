import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../../lib/supabase';
import { router, useLocalSearchParams } from 'expo-router';
import { useCart } from '../../hooks/useCart';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Theme } from '../../theme';
import CartItem from '../../components/cart/CartItem';
import Button from '../../components/ui/Button';

// Default demo user ID used across the app
const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

const CartPage = () => {
  const [userId, setUserId] = useState<string>(DEMO_USER_ID);
  const isDemoUser = userId === DEMO_USER_ID;
  const { refresh } = useLocalSearchParams<{ refresh?: string }>();
  
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Get the current user's ID when component mounts
  useEffect(() => {
    const getUserId = async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || DEMO_USER_ID);
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
  } = useCart(userId);

  // Load cart when component mounts or when userId changes or when refresh param is present
  useEffect(() => {
    // Force refresh the cart to get the latest data
    loadCart(true);
    
    // For debugging - log the cart items
    console.log('Cart page mounted with refresh param:', refresh);
  }, [userId, loadCart, refresh]);
  
  // Add another effect to force refresh when focusing the screen
  useEffect(() => {
    // This will run when the component mounts
    const loadLatestCart = async () => {
      await loadCart(true);
    };
    
    loadLatestCart();
  }, []);

  // Calculate cart totals
  const { subtotal, tax, total, itemCount } = getCartTotals();

  // Handle quantity changes
  const handleQuantityChange = useCallback(async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      return handleRemoveItem(itemId);
    }
    await updateItemQuantity(itemId, newQuantity);
  }, [updateItemQuantity]);

  // Handle remove item
  const handleRemoveItem = useCallback(async (itemId: string) => {
    try {
      await removeItem(itemId);
    } catch (error) {
      console.error('Failed to remove item:', error);
      Alert.alert('Error', 'Could not remove item from cart');
    }
  }, [removeItem]);

  // Handle checkout
  const handleCheckout = useCallback(async () => {
    try {
      const success = await checkout();
      if (success) {
        Alert.alert('Success', 'Checkout completed successfully');
        router.push('/');
      } else {
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
      await loadCart(true);
    } catch (error) {
      console.error('Error refreshing cart:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadCart]);

  // Render error state
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Unable to load cart</Text>
          <Text style={styles.errorText}>{error}</Text>
          {isDemoUser && (
            <Text style={styles.errorDetail}>
              For demo users, carts are stored locally on your device.
            </Text>
          )}
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
        <View style={styles.centeredContainer}>
          <ActivityIndicator size="large" color={Theme.colors.primary} />
          <Text style={styles.loadingText}>Loading your cart...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render empty cart
  if (!cart || cart.items.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="dark" />
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
            onPress={() => router.push('/')}
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
        <Text style={styles.headerTitle}>Shopping Cart</Text>
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
          onPress={() => router.push('/')}
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
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 24,
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
});

export default CartPage; 