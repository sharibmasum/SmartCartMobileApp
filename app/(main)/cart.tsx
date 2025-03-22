import React, { useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { useCart } from '../../hooks/useCart';
import CartItem from '../../components/cart/CartItem';

// Mock user ID for demo
const DEMO_USER_ID = '123456';

export default function Cart() {
  const router = useRouter();
  const { 
    cart, 
    loading, 
    error, 
    loadCart, 
    removeItem, 
    updateItemQuantity,
    getCartTotals 
  } = useCart(DEMO_USER_ID);

  // Manual refresh function if we need explicit refresh
  const refreshCart = useCallback(() => {
    loadCart(true); // Force refresh
  }, [loadCart]);

  const { subtotal, tax, total, itemCount } = getCartTotals();

  // Handle checkout
  const handleCheckout = () => {
    if (itemCount === 0) {
      return;
    }
    
    // In a real app, this would navigate to a checkout screen
    alert('Proceeding to checkout...');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shopping Cart</Text>
        <View style={styles.placeholder} />
      </View>
      
      {/* Cart Items */}
      {loading ? (
        <View style={styles.centeredContainer}>
          <Text>Loading cart...</Text>
        </View>
      ) : error ? (
        <View style={styles.centeredContainer}>
          <Text>Error loading cart: {error}</Text>
          <TouchableOpacity onPress={refreshCart} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : cart?.items && cart.items.length > 0 ? (
        <FlatList
          data={cart.items}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <CartItem
              item={item}
              onRemove={() => removeItem(item.id)}
              onUpdateQuantity={(quantity: number) => updateItemQuantity(item.id, quantity)}
            />
          )}
          style={styles.cartList}
        />
      ) : (
        <View style={styles.centeredContainer}>
          <Text>Your cart is empty</Text>
          <Link href="/(main)/scanner" asChild>
            <TouchableOpacity style={styles.continueShoppingButton}>
              <Text style={styles.continueShoppingText}>Continue Shopping</Text>
            </TouchableOpacity>
          </Link>
        </View>
      )}
      
      {/* Cart Summary */}
      {cart?.items && cart.items.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal</Text>
            <Text style={styles.summaryValue}>${subtotal.toFixed(2)}</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tax</Text>
            <Text style={styles.summaryValue}>${tax.toFixed(2)}</Text>
          </View>
          
          <View style={[styles.summaryRow, styles.totalRow]}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.checkoutButton, itemCount === 0 && styles.disabledButton]}
            onPress={handleCheckout}
            disabled={itemCount === 0}
          >
            <Text style={styles.checkoutButtonText}>Checkout</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  placeholder: {
    width: 34, // Same width as back button for centered title
  },
  centeredContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  retryButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#53B175',
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  continueShoppingButton: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#53B175',
    borderRadius: 10,
  },
  continueShoppingText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  cartList: {
    flex: 1,
  },
  summaryContainer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    fontSize: 16,
    color: '#666',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
  },
  totalRow: {
    marginTop: 5,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#53B175',
  },
  checkoutButton: {
    backgroundColor: '#53B175',
    marginTop: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
}); 