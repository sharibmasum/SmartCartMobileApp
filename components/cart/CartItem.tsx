import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CartItem as CartItemType } from '../../types/cart.types';

interface CartItemProps {
  item: CartItemType;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const { product, quantity } = item;

  const handleIncrease = () => {
    onUpdateQuantity(quantity + 1);
  };

  const handleDecrease = () => {
    if (quantity > 1) {
      onUpdateQuantity(quantity - 1);
    } else {
      onRemove();
    }
  };

  const subtotal = product.price * quantity;

  return (
    <View style={styles.container}>
      <View style={styles.productInfo}>
        <Image 
          source={{ uri: product.image_url || 'https://via.placeholder.com/80' }} 
          style={styles.productImage} 
          resizeMode="cover"
        />
        
        <View style={styles.productDetails}>
          <Text style={styles.productName} numberOfLines={2} ellipsizeMode="tail">
            {product.name}
          </Text>
          
          <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
          
          <View style={styles.quantityContainer}>
            <TouchableOpacity onPress={handleDecrease} style={styles.quantityButton}>
              <MaterialIcons name="remove" size={16} color="#53B175" />
            </TouchableOpacity>
            
            <Text style={styles.quantityText}>{quantity}</Text>
            
            <TouchableOpacity onPress={handleIncrease} style={styles.quantityButton}>
              <MaterialIcons name="add" size={16} color="#53B175" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      
      <View style={styles.actionsContainer}>
        <Text style={styles.subtotal}>${subtotal.toFixed(2)}</Text>
        
        <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
          <MaterialIcons name="delete-outline" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  productInfo: {
    flexDirection: 'row',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 10,
    marginRight: 15,
  },
  productDetails: {
    flex: 1,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 14,
    color: '#53B175',
    marginBottom: 10,
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 25,
    height: 25,
    borderRadius: 12.5,
    borderWidth: 1,
    borderColor: '#E2E2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '500',
    marginHorizontal: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  subtotal: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  removeButton: {
    padding: 5,
  },
});

export default CartItem; 