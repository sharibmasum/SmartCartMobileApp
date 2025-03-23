import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CartItem as CartItemType } from '../../types/cart.types';
import { Theme } from '../../theme';
import { Feather } from '@expo/vector-icons';

interface CartItemProps {
  item: CartItemType;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onUpdateQuantity, onRemove }) => {
  const { product, quantity } = item;
  const [imageLoading, setImageLoading] = React.useState(true);
  const [imageError, setImageError] = React.useState(false);
  
  if (!product) {
    return null;
  }

  const itemTotal = product.price * quantity;
  
  const incrementQuantity = () => {
    onUpdateQuantity(item.id, quantity + 1);
  };
  
  const decrementQuantity = () => {
    if (quantity > 1) {
      onUpdateQuantity(item.id, quantity - 1);
    } else {
      onRemove(item.id);
    }
  };

  // Function to handle image errors
  const handleImageError = () => {
    setImageLoading(false);
    setImageError(true);
  };
  
  return (
    <View style={styles.container}>
      <View style={styles.contentContainer}>
        <View style={styles.imageContainer}>
          {product.image_url && !imageError ? (
            <>
              <Image 
                source={{ uri: product.image_url }}
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
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          
          <Text style={styles.productPrice}>${product.price.toFixed(2)} / each</Text>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={decrementQuantity}
            >
              <Feather name="minus" size={16} color="#474472" />
            </TouchableOpacity>
            
            <Text style={styles.quantity}>{quantity}</Text>
            
            <TouchableOpacity 
              style={styles.quantityButton} 
              onPress={incrementQuantity}
            >
              <Feather name="plus" size={16} color="#474472" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.rightContainer}>
        <TouchableOpacity 
          style={styles.removeButton}
          onPress={() => onRemove(item.id)}
        >
          <Feather name="trash-2" size={18} color="#ff6b6b" />
        </TouchableOpacity>
        
        <Text style={styles.totalPrice}>${itemTotal.toFixed(2)}</Text>
      </View>
    </View>
  );
};

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
});

export default CartItem; 