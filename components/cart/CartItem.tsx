import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CartItem as CartItemType } from '../../types/cart.types';

interface CartItemProps {
  item: CartItemType;
  onRemove: () => void;
  onUpdateQuantity: (quantity: number) => void;
}

const CartItem: React.FC<CartItemProps> = ({ item, onRemove, onUpdateQuantity }) => {
  const { product, quantity } = item;
  
  const handleIncrement = () => {
    onUpdateQuantity(quantity + 1);
  };
  
  const handleDecrement = () => {
    if (quantity > 1) {
      onUpdateQuantity(quantity - 1);
    } else {
      onRemove();
    }
  };
  
  return (
    <View style={styles.container}>
      {/* Product Image */}
      <View style={styles.imageContainer}>
        {product.image_url ? (
          <Image source={{ uri: product.image_url }} style={styles.image} />
        ) : (
          <View style={styles.placeholderImage}>
            <MaterialIcons name="image" size={30} color="#ccc" />
          </View>
        )}
      </View>
      
      {/* Product Details */}
      <View style={styles.detailsContainer}>
        <Text style={styles.productName}>{product.name}</Text>
        <Text style={styles.productPrice}>${product.price.toFixed(2)}</Text>
      </View>
      
      {/* Quantity Controls */}
      <View style={styles.quantityContainer}>
        <TouchableOpacity onPress={handleDecrement} style={styles.quantityButton}>
          <MaterialIcons name="remove" size={18} color="#666" />
        </TouchableOpacity>
        
        <Text style={styles.quantityText}>{quantity}</Text>
        
        <TouchableOpacity onPress={handleIncrement} style={styles.quantityButton}>
          <MaterialIcons name="add" size={18} color="#666" />
        </TouchableOpacity>
      </View>
      
      {/* Remove Button */}
      <TouchableOpacity onPress={onRemove} style={styles.removeButton}>
        <MaterialIcons name="delete-outline" size={24} color="#ff6b6b" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 10,
    overflow: 'hidden',
    marginRight: 15,
    backgroundColor: '#f9f9f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f2f2f2',
  },
  detailsContainer: {
    flex: 1,
    marginRight: 10,
  },
  productName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 15,
    color: '#53B175',
    fontWeight: 'bold',
  },
  quantityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#f3f3f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quantityText: {
    fontSize: 16,
    fontWeight: '500',
    marginHorizontal: 10,
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 5,
  },
});

export default CartItem; 