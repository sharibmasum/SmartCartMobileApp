import { supabase } from '../lib/supabase';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';
import { searchProducts, getProductById } from './products';

// Demo user UUID that matches across the app
const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// Check if a string is a valid UUID
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

/**
 * Get active cart for a user
 * For demo users, this will try to use database cart but fall back to a mock cart
 */
export async function getActiveCart(userId: string): Promise<Cart | null> {
  // Validation
  if (!userId) {
    console.error('getActiveCart: No userId provided');
    return null;
  }

  try {
    // Get active cart
    const { data: cartData, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Handle specific error cases
    if (cartError) {
      // For demo user, we'll create a mock cart to avoid authentication issues
      if (userId === DEMO_USER_ID) {
        console.log('Using client-side cart for demo user');
        return createMockCartForDemoUser();
      }
      
      // For regular users with no cart, create one
      if (cartError.code === 'PGRST116') {
        // No active cart found, create one
        return await createCart(userId);
      } else {
        // For other errors, log and rethrow
        console.error('Error fetching cart:', cartError);
        throw new Error(cartError.message);
      }
    }

    if (!cartData) {
      // No active cart found, create one
      if (userId === DEMO_USER_ID) {
        return createMockCartForDemoUser();
      }
      return await createCart(userId);
    }

    // Get cart items with product details
    const { data: itemsData, error: itemsError } = await supabase
      .from('cart_items')
      .select(`
        *,
        product:products (*)
      `)
      .eq('cart_id', cartData.id);

    if (itemsError) {
      // For demo user, return mock cart on error
      if (userId === DEMO_USER_ID) {
        return createMockCartForDemoUser();
      }
      console.error('Error fetching cart items:', itemsError);
      throw new Error(itemsError.message);
    }

    // Assemble complete cart object
    const cart: Cart = {
      ...cartData,
      items: itemsData || [],
    };

    return cart;
  } catch (error) {
    // For demo user, return mock cart on any error
    if (userId === DEMO_USER_ID) {
      return createMockCartForDemoUser();
    }
    console.error('Error in getActiveCart:', error);
    throw error;
  }
}

/**
 * Create a mock cart for demo users to use when database operations fail
 */
function createMockCartForDemoUser(): Cart {
  return {
    id: 'demo-cart-id',
    user_id: DEMO_USER_ID,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    checkout_at: null,
    items: []
  };
}

/**
 * Create a new cart for a user
 */
async function createCart(userId: string): Promise<Cart> {
  if (!userId) {
    throw new Error('No userId provided');
  }

  // Create cart
  const { data: cartData, error: cartError } = await supabase
    .from('carts')
    .insert({
      user_id: userId,
      status: 'active',
    })
    .select()
    .single();

  if (cartError) {
    console.error('Error creating cart:', cartError);
    throw new Error(cartError.message);
  }

  // Return new empty cart
  return {
    ...cartData,
    items: [],
  };
}

/**
 * Add a product to cart
 * For demo users, this just validates the product and returns a mock cart item
 */
export async function addToCart(
  userId: string,
  product: Product,
  quantity: number = 1
): Promise<CartItem | null> {
  // Validation
  if (!userId || !product || !product.id) {
    console.error('Invalid input to addToCart');
    return null;
  }

  // For demo users, return a mock cart item (real cart is managed by the hook)
  if (userId === DEMO_USER_ID) {
    // Try to find the product in the database to make sure it's valid
    try {
      const products = await searchProducts(product.name, 1);
      if (products && products.length > 0) {
        const validProduct = products[0];
        // Create a mock cart item that the hook will use
        const mockCartItem: CartItem = {
          id: generateUUID(),
          cart_id: 'demo-cart-id',
          product_id: validProduct.id,
          quantity: quantity,
          product: validProduct,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        return mockCartItem;
      }
    } catch (error) {
      console.error('Error validating product for demo user:', error);
    }

    // If we couldn't validate or find the product, create a cart item with the provided data
    return {
      id: generateUUID(),
      cart_id: 'demo-cart-id',
      product_id: product.id,
      quantity: quantity,
      product: product,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    // Get active cart (or create one)
    const cart = await getActiveCart(userId);
    
    if (!cart) {
      throw new Error('Failed to get or create cart');
    }

    // Check if product already in cart
    const existingItem = cart.items.find(item => item.product_id === product.id);

    if (existingItem) {
      // Update existing item quantity
      return await updateCartItemQuantity(
        existingItem.id,
        existingItem.quantity + quantity
      );
    } else {
      // Add new item
      const { data: itemData, error: itemError } = await supabase
        .from('cart_items')
        .insert({
          cart_id: cart.id,
          product_id: product.id,
          quantity: quantity,
        })
        .select(`
          *,
          product:products (*)
        `)
        .single();

      if (itemError) {
        console.error('Error adding item to cart:', itemError);
        throw new Error(itemError.message);
      }

      return itemData;
    }
  } catch (error) {
    console.error('Error in addToCart:', error);
    throw error;
  }
}

/**
 * Remove an item from the cart
 * For demo users, this always returns true (actual removal is handled by the hook)
 */
export async function removeCartItem(cartItemId: string): Promise<boolean> {
  if (!cartItemId) {
    return false;
  }

  // For demo users, return success (the actual removal is handled by the hook)
  if (cartItemId.includes('demo') || !isValidUUID(cartItemId)) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (error) {
      console.error('Error removing item from cart:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (error) {
    console.error('Error in removeCartItem:', error);
    return false;
  }
}

/**
 * Update cart item quantity
 * For demo users, this returns a mock updated cart item (actual update is handled by the hook)
 */
export async function updateCartItemQuantity(
  cartItemId: string,
  quantity: number
): Promise<CartItem | null> {
  if (!cartItemId || quantity < 0) {
    return null;
  }

  // For demo users, return a mock updated cart item (the actual update is handled by the hook)
  if (cartItemId.includes('demo') || !isValidUUID(cartItemId)) {
    // Create a mock response with the new quantity
    const dummyProduct: Product = {
      id: 'demo-product-id',
      name: 'Demo Product',
      description: '',
      price: 0,
      image_url: '',
      barcode: '',
      category: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      id: cartItemId,
      cart_id: 'demo-cart-id',
      product_id: 'demo-product-id',
      quantity: quantity,
      product: dummyProduct,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  try {
    // If quantity is 0, remove the item
    if (quantity === 0) {
      const removed = await removeCartItem(cartItemId);
      return removed ? null : null;
    }

    // Update the item quantity
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .select(`
        *,
        product:products (*)
      `)
      .single();

    if (error) {
      console.error('Error updating item quantity:', error);
      throw new Error(error.message);
    }

    return data;
  } catch (error) {
    console.error('Error in updateCartItemQuantity:', error);
    return null;
  }
}

/**
 * Mark a cart as completed (checkout)
 * For demo users, this always returns true (actual checkout is handled by the hook)
 */
export async function checkoutCart(
  cartId: string,
  paymentMethod: string = 'credit_card'
): Promise<boolean> {
  if (!cartId) {
    return false;
  }

  // For demo users, return success (the actual checkout is handled by the hook)
  if (cartId.includes('demo') || !isValidUUID(cartId)) {
    return true;
  }

  try {
    const { error } = await supabase
      .from('carts')
      .update({
        status: 'completed',
        checkout_at: new Date().toISOString(),
        payment_method: paymentMethod,
      })
      .eq('id', cartId);

    if (error) {
      console.error('Error checking out cart:', error);
      throw new Error(error.message);
    }

    return true;
  } catch (error) {
    console.error('Error in checkoutCart:', error);
    return false;
  }
}

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