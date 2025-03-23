import { supabase } from './supabase';
import { Cart, CartItem } from '../types/cart.types';
import { Product } from '../types/product.types';
import { v4 as uuidv4 } from 'uuid';
import { getProductById } from './products';  // Import the getProductById function

// Enable debug logging
const SHOW_DEBUG_ERRORS = true;

// Product cache to prevent repeated fetching
const productCache: Record<string, Product | null> = {};

// Time tracking to prevent excessive requests
const lastCartRefresh: Record<string, number> = {};
const MIN_REFRESH_INTERVAL = 1000; // Minimum time in ms between cart refreshes for the same user

// Time tracking for product fetches
const lastProductFetch: Record<string, number> = {};
const MIN_FETCH_INTERVAL = 500; // Minimum time in ms between fetches for the same product

// Helper function for logging errors
const logError = (message: string, error: any) => {
  if (SHOW_DEBUG_ERRORS) {
    console.error(`[CartService] ${message}`, error);
  }
};

// Helper function for logging debug information
const logDebug = (message: string, data?: any) => {
  if (SHOW_DEBUG_ERRORS) {
    if (data) {
      console.log(`[CartService] ${message}`, data);
    } else {
      console.log(`[CartService] ${message}`);
    }
  }
};

/**
 * Fetch a product by ID and cache it
 */
const fetchAndCacheProduct = async (productId: string): Promise<Product | null> => {
  // Check cache first
  if (productCache[productId] !== undefined) {
    logDebug(`Using cached product: ${productId}`);
    return productCache[productId];
  }
  
  // Check if we recently tried to fetch this product
  const now = Date.now();
  const lastFetch = lastProductFetch[productId] || 0;
  if (now - lastFetch < MIN_FETCH_INTERVAL) {
    logDebug(`Skipping product fetch for ${productId}, too soon since last fetch (${now - lastFetch}ms)`);
    return null;
  }
  
  // Update last fetch time
  lastProductFetch[productId] = now;
  
  try {
    logDebug(`Fetching product from database: ${productId}`);
    const product = await getProductById(productId);
    
    // Cache the result (even if null)
    productCache[productId] = product;
    
    if (product) {
      logDebug(`Successfully cached product: ${product.name}`);
    } else {
      logDebug(`Product not found for ID: ${productId}`);
    }
    
    return product;
  } catch (error) {
    logError(`Error fetching product ${productId}:`, error);
    return null;
  }
};

/**
 * Get the active cart for a user, create one if it doesn't exist
 */
export const getActiveCart = async (userId: string): Promise<Cart | null> => {
  try {
    logDebug(`Getting active cart for user: ${userId}`);
    
    // Check if we recently fetched this cart
    const now = Date.now();
    const lastRefresh = lastCartRefresh[userId] || 0;
    if (now - lastRefresh < MIN_REFRESH_INTERVAL) {
      logDebug(`Skipping cart refresh for ${userId}, too soon since last refresh (${now - lastRefresh}ms)`);
      return null;
    }
    
    // Update last refresh time
    lastCartRefresh[userId] = now;

    // Check for an active cart first
    const { data: carts, error } = await supabase
      .from('carts')
      .select(`
        id,
        user_id,
        created_at,
        updated_at,
        status,
        completed_at,
        payment_method,
        items:cart_items(
          id,
          cart_id,
          product_id,
          quantity,
          created_at,
          updated_at,
          product:products(*)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      logError('Error fetching cart:', error);
      // Try to create a new cart if error may be due to missing cart
      return createCart(userId);
    }

    if (carts && carts.length > 0) {
      logDebug(`Found active cart: ${carts[0].id} with ${carts[0].items.length} items`);
      
      // Process the cart items to ensure they match our CartItem type
      const processedCart = {
        ...carts[0],
        items: await Promise.all(carts[0].items.map(async (item: any) => {
          // Extract product data from the response or from our cache
          let itemProduct: Product | null = null;
          
          // First check if we got product data from the join
          if (item.product && item.product.length > 0) {
            itemProduct = item.product[0];
            // Update cache with the joined product
            productCache[item.product_id] = itemProduct;
            // Use optional chaining to safely access name
            logDebug(`Using joined product data for ${item.id}: ${itemProduct?.name || 'null'}`);
          } 
          // Then check our cache
          else if (productCache[item.product_id]) {
            itemProduct = productCache[item.product_id];
            logDebug(`Using cached product for ${item.id}: ${itemProduct?.name || 'null'}`);
          } 
          // If still no product, fetch directly
          else {
            logDebug(`Missing product data for item ${item.id}, product_id: ${item.product_id}. Fetching directly.`);
            itemProduct = await fetchAndCacheProduct(item.product_id);
            
            if (itemProduct) {
              logDebug(`Successfully retrieved product ${itemProduct.name} for item ${item.id}`);
            } else {
              // Log the missing product but don't throw
              console.warn(`Invalid product in cart item:`, item);
            }
          }
          
          // Return the processed item with product data
          return {
            ...item,
            product: itemProduct || null
          };
        }))
      } as Cart;
      
      return processedCart;
    }

    // No active cart found, create a new one
    logDebug(`No active cart found for user: ${userId}, creating new cart`);
    return createCart(userId);
  } catch (error) {
    logError('Unexpected error in getActiveCart:', error);
    throw error;
  }
};

/**
 * Create a new cart for a user
 */
export const createCart = async (userId: string): Promise<Cart | null> => {
  try {
    logDebug(`Creating new cart for user: ${userId}`);

    // Insert new cart
    const { data: newCart, error: insertError } = await supabase
      .from('carts')
      .insert([
        { 
          user_id: userId,
          status: 'active',
          completed_at: null,
        }
      ])
      .select();

    if (insertError) {
      logError('Error creating cart:', insertError);
      return null;
    }

    if (!newCart || newCart.length === 0) {
      logDebug('Failed to create new cart, no data returned');
      return null;
    }

    logDebug(`Created new cart with ID: ${newCart[0].id}`);

    // Return the newly created cart with empty items array
    const cart: Cart = {
      ...newCart[0],
      items: []
    };
    
    return cart;
  } catch (error) {
    logError('Unexpected error in createCart:', error);
    throw error;
  }
};

/**
 * Add a product to the user's active cart
 */
export const addToCart = async (
  userId: string, 
  product: Product, 
  quantity: number = 1
): Promise<CartItem | null> => {
  try {
    logDebug(`Adding product to cart - User ID: ${userId}, Product ID: ${product.id}, Quantity: ${quantity}`);

    // Cache the product we're adding
    productCache[product.id] = product;

    // First, ensure we have an active cart
    const cart = await getActiveCart(userId);
    
    if (!cart) {
      logError('Could not get or create active cart', null);
      return null;
    }

    // Check if the product already exists in the cart
    const existingItem = cart.items.find(item => item.product_id === product.id);

    if (existingItem) {
      logDebug(`Product already in cart (Item ID: ${existingItem.id}), updating quantity`);
      
      // Update quantity of existing cart item
      const newQuantity = existingItem.quantity + quantity;
      
      const { data: updatedItem, error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', existingItem.id)
        .select(`
          id,
          cart_id,
          product_id,
          quantity,
          created_at,
          updated_at,
          product:products(*)
        `)
        .single();

      if (updateError) {
        logError('Error updating cart item:', updateError);
        return null;
      }

      logDebug(`Updated cart item - New quantity: ${newQuantity}`);
      
      // Process the returned item to match our CartItem type
      if (updatedItem) {
        let processedProduct: Product | null = null;
        
        // Check if product data is available from the response
        if (updatedItem.product && updatedItem.product.length > 0) {
          processedProduct = updatedItem.product[0];
          // Update cache
          productCache[updatedItem.product_id] = processedProduct;
        } 
        // Check cache
        else if (productCache[updatedItem.product_id]) {
          processedProduct = productCache[updatedItem.product_id];
        }
        // Try to fetch if still missing
        else {
          logDebug(`Missing product data in update response, fetching directly: ${updatedItem.product_id}`);
          processedProduct = await fetchAndCacheProduct(updatedItem.product_id);
        }
        
        const processedItem: CartItem = {
          ...updatedItem,
          product: processedProduct
        };
        return processedItem;
      }
      
      return null;
    } else {
      // Add new cart item
      logDebug(`Adding new item to cart (Cart ID: ${cart.id})`);
      
      const { data: newItem, error: insertError } = await supabase
        .from('cart_items')
        .insert([
          {
            cart_id: cart.id,
            product_id: product.id,
            quantity: quantity
          }
        ])
        .select(`
          id,
          cart_id,
          product_id,
          quantity,
          created_at,
          updated_at,
          product:products(*)
        `)
        .single();

      if (insertError) {
        logError('Error adding item to cart:', insertError);
        
        // If the error contains a foreign key violation, let's check for auth issues
        if (insertError.message && insertError.message.includes('foreign key constraint')) {
          logError('Foreign key constraint violation - possible permissions issue', null);
        }
        
        return null;
      }

      logDebug(`Added new item to cart - Item ID: ${newItem?.id}`);
      
      // Process the returned item to match our CartItem type
      if (newItem) {
        let processedProduct: Product | null = null;
        
        // Check if product data is available from the response
        if (newItem.product && newItem.product.length > 0) {
          processedProduct = newItem.product[0];
          // Update cache
          productCache[newItem.product_id] = processedProduct;
        } 
        // Check cache
        else if (productCache[newItem.product_id]) {
          processedProduct = productCache[newItem.product_id];
        }
        // Try to fetch if still missing
        else {
          logDebug(`Missing product data in insert response, fetching directly: ${newItem.product_id}`);
          processedProduct = await fetchAndCacheProduct(newItem.product_id);
          
          // If still no product, use the original product that was passed in
          if (!processedProduct) {
            processedProduct = product;
            // Update cache with this product
            productCache[product.id] = product;
          }
        }
        
        const processedItem: CartItem = {
          ...newItem,
          product: processedProduct
        };
        return processedItem;
      }
      
      return null;
    }
  } catch (error) {
    logError('Unexpected error in addToCart:', error);
    return null;
  }
};

/**
 * Remove an item from the cart
 */
export const removeCartItem = async (cartItemId: string): Promise<boolean> => {
  try {
    logDebug(`Removing cart item: ${cartItemId}`);
    
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId);

    if (error) {
      logError('Error removing cart item:', error);
      return false;
    }

    logDebug(`Successfully removed cart item: ${cartItemId}`);
    return true;
  } catch (error) {
    logError('Unexpected error in removeCartItem:', error);
    return false;
  }
};

/**
 * Update the quantity of an item in the cart
 */
export const updateCartItemQuantity = async (
  cartItemId: string,
  quantity: number
): Promise<CartItem | null> => {
  try {
    logDebug(`Updating cart item quantity - Item ID: ${cartItemId}, New quantity: ${quantity}`);
    
    // If quantity is zero or negative, remove the item instead
    if (quantity <= 0) {
      const removed = await removeCartItem(cartItemId);
      return removed ? { 
        id: cartItemId, 
        quantity: 0,
        cart_id: '',
        product_id: '',
        product: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } : null;
    }

    // Update the quantity
    const { data, error } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', cartItemId)
      .select(`
        id,
        cart_id,
        product_id,
        quantity,
        created_at,
        updated_at,
        product:products(*)
      `)
      .single();

    if (error) {
      logError('Error updating cart item quantity:', error);
      return null;
    }

    logDebug(`Successfully updated cart item quantity - Item ID: ${cartItemId}`);
    
    // Process the returned item to match our CartItem type
    if (data) {
      let processedProduct: Product | null = null;
      
      // Check if product data is available from the response
      if (data.product && data.product.length > 0) {
        processedProduct = data.product[0];
        // Update cache
        productCache[data.product_id] = processedProduct;
      }
      // Check cache
      else if (productCache[data.product_id]) {
        processedProduct = productCache[data.product_id];
      }
      // Try to fetch if still missing
      else {
        logDebug(`Missing product data after quantity update, fetching directly: ${data.product_id}`);
        processedProduct = await fetchAndCacheProduct(data.product_id);
      }
      
      const processedItem: CartItem = {
        ...data,
        product: processedProduct
      };
      return processedItem;
    }
    
    return null;
  } catch (error) {
    logError('Unexpected error in updateCartItemQuantity:', error);
    return null;
  }
};

/**
 * Mark a cart as completed (checked out)
 */
export const checkoutCart = async (
  cartId: string,
  paymentMethod: string = 'credit_card'
): Promise<boolean> => {
  try {
    logDebug(`Checking out cart - Cart ID: ${cartId}, Payment method: ${paymentMethod}`);
    
    const { error } = await supabase
      .from('carts')
      .update({ 
        status: 'completed',
        payment_method: paymentMethod,
        completed_at: new Date().toISOString()
      })
      .eq('id', cartId);

    if (error) {
      logError('Error checking out cart:', error);
      return false;
    }

    logDebug(`Successfully checked out cart: ${cartId}`);
    return true;
  } catch (error) {
    logError('Unexpected error in checkoutCart:', error);
    return false;
  }
};

/**
 * Get details of a specific cart
 */
export const getCartDetails = async (cartId: string): Promise<Cart | null> => {
  try {
    logDebug(`Getting cart details - Cart ID: ${cartId}`);
    
    const { data, error } = await supabase
      .from('carts')
      .select(`
        id,
        user_id,
        created_at,
        updated_at,
        status,
        completed_at,
        payment_method,
        items:cart_items(
          id,
          cart_id,
          product_id,
          quantity,
          created_at,
          updated_at,
          product:products(*)
        )
      `)
      .eq('id', cartId)
      .single();

    if (error) {
      logError('Error fetching cart details:', error);
      return null;
    }

    logDebug(`Successfully retrieved cart details - Cart ID: ${cartId}`);
    
    // Process the cart items to ensure they match our CartItem type
    if (data) {
      const processedCart: Cart = {
        ...data,
        items: await Promise.all(data.items.map(async (item: any) => {
          // Extract product data from the response or from our cache
          let itemProduct: Product | null = null;
          
          // First check if we got product data from the join
          if (item.product && item.product.length > 0) {
            itemProduct = item.product[0];
            // Update cache with the joined product
            productCache[item.product_id] = itemProduct;
          } 
          // Then check our cache
          else if (productCache[item.product_id]) {
            itemProduct = productCache[item.product_id];
          } 
          // If still no product, fetch directly
          else {
            logDebug(`Missing product data for item ${item.id}, product_id: ${item.product_id}. Fetching directly.`);
            itemProduct = await fetchAndCacheProduct(item.product_id);
            
            if (itemProduct) {
              logDebug(`Successfully retrieved product ${itemProduct.name} for item ${item.id}`);
            } else {
              // Log the missing product but don't throw
              console.warn(`Invalid product in cart item:`, item);
            }
          }
          
          // Return the processed item with product data
          return {
            ...item,
            product: itemProduct || null
          };
        }))
      };
      
      return processedCart;
    }
    
    return null;
  } catch (error) {
    logError('Unexpected error in getCartDetails:', error);
    return null;
  }
};

/**
 * Get cart history for a user
 */
export const getCartHistory = async (userId: string): Promise<Cart[]> => {
  try {
    logDebug(`Getting cart history for user: ${userId}`);
    
    const { data, error } = await supabase
      .from('carts')
      .select(`
        id,
        user_id,
        created_at,
        updated_at,
        status,
        completed_at,
        payment_method,
        items:cart_items(
          id,
          cart_id,
          product_id,
          quantity,
          created_at,
          updated_at,
          product:products(*)
        )
      `)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false });

    if (error) {
      logError('Error fetching cart history:', error);
      return [];
    }

    logDebug(`Retrieved ${data.length} completed carts for user: ${userId}`);
    
    // Process the cart items to ensure they match our CartItem type
    if (data) {
      const processedCarts: Cart[] = await Promise.all(data.map(async (cart: any) => ({
        ...cart,
        items: await Promise.all(cart.items.map(async (item: any) => {
          // Extract product data from the response or from our cache
          let itemProduct: Product | null = null;
          
          // First check if we got product data from the join
          if (item.product && item.product.length > 0) {
            itemProduct = item.product[0];
            // Update cache with the joined product
            productCache[item.product_id] = itemProduct;
          } 
          // Then check our cache
          else if (productCache[item.product_id]) {
            itemProduct = productCache[item.product_id];
          } 
          // If still no product, fetch directly
          else {
            logDebug(`Missing product data for item ${item.id}, product_id: ${item.product_id}. Fetching directly.`);
            itemProduct = await fetchAndCacheProduct(item.product_id);
            
            if (itemProduct) {
              logDebug(`Successfully retrieved product ${itemProduct.name} for item ${item.id}`);
            } else {
              // Log the missing product but don't throw
              console.warn(`Invalid product in cart item:`, item);
            }
          }
          
          // Return the processed item with product data
          return {
            ...item,
            product: itemProduct || null
          };
        }))
      })));
      
      return processedCarts;
    }
    
    return [];
  } catch (error) {
    logError('Unexpected error in getCartHistory:', error);
    return [];
  }
};

/**
 * Preload a product into the cache to ensure it's available
 * This can be called ahead of time to ensure products display properly
 */
export const preloadProduct = async (productId: string): Promise<Product | null> => {
  try {
    if (productCache[productId]) {
      logDebug(`Product ${productId} already in cache`);
      return productCache[productId];
    }
    
    logDebug(`Preloading product: ${productId}`);
    return await fetchAndCacheProduct(productId);
  } catch (error) {
    logError(`Error preloading product ${productId}:`, error);
    return null;
  }
}; 