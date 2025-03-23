import React, { useState, useEffect, useCallback, memo } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { CartItem as CartItemType } from '../../types/cart.types';
import { Feather } from '@expo/vector-icons';
import { getProductById } from '../../services/products'; // Import the products service
import { preloadProduct } from '../../services/cart';  // Import the preload function

// Enable debug logging
const SHOW_DEBUG_LOGS = true;

// Helper function for logging debug information
const logDebug = (message: string, data?: any) => {
  if (SHOW_DEBUG_LOGS) {
    if (data) {
      console.log(`[CartItem] ${message}`, data);
    } else {
      console.log(`[CartItem] ${message}`);
    }
  }
};

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

const CartItem: React.FC<CartItemProps> = memo(({ item, onUpdateQuantity, onRemove }) => {
  const { product, quantity } = item;
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [localQuantity, setLocalQuantity] = useState(quantity);
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [localProduct, setLocalProduct] = useState(product);
  const [loadAttempted, setLoadAttempted] = useState(false);
  
  // Update local quantity whenever the prop changes
  useEffect(() => {
    if (localQuantity !== quantity) {
      logDebug(`Quantity updated: ${localQuantity} → ${quantity} for item ${item.id}`);
      setLocalQuantity(quantity);
    }
  }, [quantity, item.id, localQuantity]);

  // Update local product when product prop changes
  useEffect(() => {
    if (product && (!localProduct || product.id !== localProduct.id)) {
      setLocalProduct(product);
    }
  }, [product, localProduct]);

  // DEBUG: Log item data when rendered
  useEffect(() => {
    if (!loadAttempted) {
      logDebug(`Rendered with ID: ${item.id}, product_id: ${item.product_id}, quantity: ${quantity}`);
      if (product) {
        logDebug(`Product details: ${product.name}, $${product.price}`);
      } else {
        logDebug(`No product found for item ${item.id}`);
      }
    }
  }, [item.id, item.product_id, product, quantity, loadAttempted]);

  // Attempt to load missing product data
  const fetchProductData = useCallback(async () => {
    if (isLoadingProduct || localProduct) return;
    
    setIsLoadingProduct(true);
    setLoadAttempted(true);
    logDebug(`Attempting to fetch product data for item ${item.id}, product_id: ${item.product_id}`);
    
    try {
      // Use the preloadProduct function for better caching
      const productData = await preloadProduct(item.product_id);
      
      if (productData) {
        logDebug(`Successfully loaded product data: ${productData.name}`);
        setLocalProduct(productData);
      } else {
        logDebug(`Could not find product with ID: ${item.product_id}`);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
    } finally {
      setIsLoadingProduct(false);
    }
  }, [isLoadingProduct, localProduct, item.id, item.product_id]);

  // Try to fetch product data if missing - only once
  useEffect(() => {
    if (!product && !isLoadingProduct && !localProduct && !loadAttempted) {
      fetchProductData();
    }
  }, [product, fetchProductData, isLoadingProduct, localProduct, loadAttempted]);

  // Handle missing product data
  if (!localProduct) {
    return (
      <View style={[styles.container, styles.missingProductContainer]}>
        <View style={styles.contentContainer}>
          <View style={[styles.image, styles.placeholderImage]}>
            <Feather name="alert-circle" size={24} color="#ff6b6b" />
          </View>
          <View style={styles.infoContainer}>
            <Text style={styles.errorText}>Product Information Missing</Text>
            <Text style={styles.productPrice}>ID: {item.product_id}</Text>
            <Text style={styles.productPrice}>Quantity: {quantity}</Text>
            {isLoadingProduct ? (
              <View style={styles.retryButtonContainer}>
                <ActivityIndicator size="small" color="#474472" />
                <Text style={styles.loadingText}>Loading...</Text>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.retryButtonContainer} 
                onPress={fetchProductData}
              >
                <Feather name="refresh-cw" size={14} color="#474472" />
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => onRemove(item.id)}
        >
          <Feather name="trash-2" size={18} color="#ff6b6b" />
        </TouchableOpacity>
      </View>
    );
  }

  // Calculate item total price using local product if available
  const itemTotal = localProduct.price * localQuantity;
  
  const incrementQuantity = useCallback(async () => {
    const newQuantity = localQuantity + 1;
    setIsUpdating(true);
    // Optimistically update local state first
    setLocalQuantity(newQuantity);
    try {
      logDebug(`Incrementing quantity to ${newQuantity} for item ${item.id}`);
      await onUpdateQuantity(item.id, newQuantity);
    } catch (error) {
      // If there's an error, revert to the original quantity
      setLocalQuantity(quantity);
      console.error('Failed to update quantity:', error);
    } finally {
      setIsUpdating(false);
    }
  }, [localQuantity, item.id, onUpdateQuantity, quantity]);
  
  const decrementQuantity = useCallback(async () => {
    if (localQuantity > 1) {
      const newQuantity = localQuantity - 1;
      setIsUpdating(true);
      // Optimistically update local state first
      setLocalQuantity(newQuantity);
      try {
        logDebug(`Decrementing quantity to ${newQuantity} for item ${item.id}`);
        await onUpdateQuantity(item.id, newQuantity);
      } catch (error) {
        // If there's an error, revert to the original quantity
        setLocalQuantity(quantity);
        console.error('Failed to update quantity:', error);
      } finally {
        setIsUpdating(false);
      }
    } else {
      logDebug(`Removing item ${item.id} (quantity would be less than 1)`);
      onRemove(item.id);
    }
  }, [localQuantity, item.id, onUpdateQuantity, quantity, onRemove]);

  // Function to handle image errors
  const handleImageError = useCallback(() => {
    logDebug(`Image error for item ${item.id}`);
    setImageLoading(false);
    setImageError(true);
  }, [item.id]);
  
  const handleRemove = useCallback(() => {
    onRemove(item.id);
  }, [onRemove, item.id]);
  
  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.imageContainer}>
          {!imageError && (localImageUri || localProduct.image_url) ? (
            <>
              <Image 
                source={{ uri: localImageUri || localProduct.image_url }}
                style={styles.image}
                onLoadStart={() => setImageLoading(true)}
                onLoadEnd={() => setImageLoading(false)}
                onError={handleImageError}
              />
              {imageLoading && (
                <View style={styles.imageLoadingContainer}>
                  <ActivityIndicator size="small" color="#b9b1f0" />
                </View>
              )}
            </>
          ) : (
            <View style={[styles.image, styles.placeholderImage]}>
              <Feather name="image" size={24} color="#b9b1f0" />
            </View>
          )}
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.productName} numberOfLines={1} ellipsizeMode="tail">
            {localProduct.name}
          </Text>
          <Text style={styles.productPrice}>${localProduct.price.toFixed(2)}</Text>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={[styles.quantityButton, isUpdating && styles.disabledButton]}
              onPress={decrementQuantity}
              disabled={isUpdating}
            >
              <Feather name="minus" size={16} color="#474472" />
            </TouchableOpacity>
            
            {isUpdating ? (
              <ActivityIndicator size="small" color="#474472" style={styles.quantityLoader} />
            ) : (
              <Text style={styles.quantity}>{localQuantity}</Text>
            )}
            
            <TouchableOpacity 
              style={[styles.quantityButton, isUpdating && styles.disabledButton]}
              onPress={incrementQuantity}
              disabled={isUpdating}
            >
              <Feather name="plus" size={16} color="#474472" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.rightContainer}>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={handleRemove}
        >
          <Feather name="trash-2" size={18} color="#ff6b6b" />
        </TouchableOpacity>
        
        <Text style={styles.totalPrice}>${itemTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  missingProductContainer: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ffdddd',
  },
  contentContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  imageContainer: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  image: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  imageLoadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 245, 245, 0.5)',
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContainer: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222',
    marginBottom: 2,
  },
  productPrice: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0eeff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantity: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 12,
    minWidth: 20,
    textAlign: 'center',
  },
  rightContainer: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: 60,
  },
  removeButton: {
    padding: 4,
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: '#b9b1f0',
  },
  disabledButton: {
    opacity: 0.5,
  },
  quantityLoader: {
    marginHorizontal: 12,
    minWidth: 20,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  retryButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    padding: 4,
  },
  retryText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#474472',
  },
  loadingText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#474472',
  },
});

export default CartItem; 