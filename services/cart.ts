import { supabase } from './supabase';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';

// Get active cart for the current user
export const getActiveCart = async (userId: string): Promise<Cart | null> => {
  if (!userId) {
    console.error('No user ID provided to getActiveCart');
    return null;
  }
  
  // First, check if there's an active cart
  const { data: cartData, error: cartError } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (cartError && cartError.code !== 'PGRST116') { // PGRST116 is "No rows returned" error
    console.error('Error fetching active cart:', cartError);
    return null;
  }
  
  // If no active cart exists, try to create one
  if (!cartData) {
    try {
      // Get current user session first to ensure we're authenticated
      const { data: session } = await supabase.auth.getSession();
      
      // Only proceed if we have a valid session
      if (!session?.session) {
        console.error('Cannot create cart: No authenticated session');
        return null;
      }
      
      const { data: newCart, error: createError } = await supabase
        .from('carts')
        .insert([
          { user_id: userId, status: 'active' }
        ])
        .select()
        .single();
      
      if (createError) {
        // Check if this is an RLS error
        if (createError.code === '42501') {
          console.error('Row-level security prevented cart creation. Make sure the user is authenticated and has proper permissions.');
        } else {
          console.error('Error creating active cart:', createError);
        }
        return null;
      }
      
      return { ...newCart, items: [] } as Cart;
    } catch (error) {
      console.error('Exception creating cart:', error);
      return null;
    }
  }
  
  // Get cart items for the active cart
  const { data: itemsData, error: itemsError } = await supabase
    .from('cart_items_with_products')
    .select('*')
    .eq('cart_id', cartData.id);
  
  if (itemsError) {
    console.error('Error fetching cart items:', itemsError);
    return { ...cartData, items: [] } as Cart;
  }
  
  // Construct and return the complete cart with items
  return {
    ...cartData,
    items: itemsData as CartItem[]
  } as Cart;
};

// Add a product to the cart
export const addToCart = async (userId: string, product: Product, quantity = 1): Promise<CartItem | null> => {
  // Get or create active cart
  const cart = await getActiveCart(userId);
  
  if (!cart) {
    throw new Error('Failed to get or create active cart');
  }
  
  // Check if product already exists in cart
  const existingItemIndex = cart.items.findIndex(item => item.product_id === product.id);
  
  if (existingItemIndex >= 0) {
    // Update quantity of existing item
    const existingItem = cart.items[existingItemIndex];
    const newQuantity = existingItem.quantity + quantity;
    
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity: newQuantity })
      .eq('id', existingItem.id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating cart item quantity:', error);
      return null;
    }
    
    return {
      ...data,
      product
    } as CartItem;
  } else {
    // Add new item to cart
    const { data, error } = await supabase
      .from('cart_items')
      .insert([
        {
          cart_id: cart.id,
          product_id: product.id,
          quantity
        }
      ])
      .select()
      .single();
    
    if (error) {
      console.error('Error adding item to cart:', error);
      return null;
    }
    
    return {
      ...data,
      product
    } as CartItem;
  }
};

// Remove an item from the cart
export const removeCartItem = async (cartItemId: string): Promise<boolean> => {
  const { error } = await supabase
    .from('cart_items')
    .delete()
    .eq('id', cartItemId);
  
  if (error) {
    console.error('Error removing item from cart:', error);
    return false;
  }
  
  return true;
};

// Update quantity of a cart item
export const updateCartItemQuantity = async (cartItemId: string, quantity: number): Promise<CartItem | null> => {
  if (quantity <= 0) {
    // If quantity is 0 or negative, remove the item
    const removed = await removeCartItem(cartItemId);
    return removed ? null : null;
  }
  
  const { data, error } = await supabase
    .from('cart_items')
    .update({ quantity })
    .eq('id', cartItemId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating cart item quantity:', error);
    return null;
  }
  
  // Get the product details for the updated cart item
  const { data: product, error: productError } = await supabase
    .from('products')
    .select('*')
    .eq('id', data.product_id)
    .single();
  
  if (productError) {
    console.error('Error fetching product details:', productError);
    return null;
  }
  
  return {
    ...data,
    product
  } as CartItem;
};

// Complete a cart (checkout)
export const checkoutCart = async (cartId: string, paymentMethod: string): Promise<boolean> => {
  // Start a transaction
  const { error: updateError } = await supabase
    .from('carts')
    .update({
      status: 'completed',
      checkout_at: new Date().toISOString()
    })
    .eq('id', cartId);
  
  if (updateError) {
    console.error('Error updating cart status:', updateError);
    return false;
  }
  
  // Get total amount from cart
  const { data: cartData, error: cartError } = await supabase
    .from('active_carts_summary')
    .select('*')
    .eq('cart_id', cartId)
    .single();
  
  if (cartError) {
    console.error('Error getting cart summary:', cartError);
    return false;
  }
  
  // Create a payment record
  const { error: paymentError } = await supabase
    .from('payments')
    .insert([
      {
        cart_id: cartId,
        amount: cartData.total_price,
        status: 'completed', // In a real app, this would be 'pending' until payment is processed
        payment_method: paymentMethod,
        transaction_id: `txn_${Date.now()}` // In a real app, this would come from payment processor
      }
    ]);
  
  if (paymentError) {
    console.error('Error creating payment record:', paymentError);
    return false;
  }
  
  return true;
};

// Get order history for a user
export const getOrderHistory = async (userId: string): Promise<Cart[]> => {
  const { data, error } = await supabase
    .from('carts')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'completed')
    .order('checkout_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching order history:', error);
    return [];
  }
  
  // Get items for each cart
  const carts: Cart[] = [];
  
  for (const cart of data) {
    const { data: itemsData, error: itemsError } = await supabase
      .from('cart_items_with_products')
      .select('*')
      .eq('cart_id', cart.id);
    
    if (itemsError) {
      console.error(`Error fetching items for cart ${cart.id}:`, itemsError);
      carts.push({ ...cart, items: [] } as Cart);
    } else {
      carts.push({ ...cart, items: itemsData } as Cart);
    }
  }
  
  return carts;
}; 