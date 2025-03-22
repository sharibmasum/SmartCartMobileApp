import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../hooks/useCart';

// Mock user ID and product for demo
const DEMO_USER_ID = '123456';
const DEMO_PRODUCT = {
  id: 'p001',
  name: 'Banana Bundle - Large',
  description: 'Organic bananas, bundle of 5',
  price: 2.99,
  image_url: 'https://via.placeholder.com/150',
  barcode: '123456789',
  category: 'Fruits',
  in_stock: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

// Define interfaces for our state
interface ScannedItem {
  name: string;
  detected: boolean;
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef(null);
  
  // Get cart functionality from our hook
  const { addProductToCart, loading: cartLoading } = useCart(DEMO_USER_ID);

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  const handleScan = async () => {
    // Simulating a scan
    setScanning(true);
    
    try {
      // Placeholder for Google Vision API integration
      // In a real implementation, you would:
      // 1. Take a picture with camera
      // 2. Send the image to Google Vision API
      // 3. Process the response to identify the food item
      
      // Simulating API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setScannedItem({
        name: DEMO_PRODUCT.name,
        detected: true,
      });
      
      // Show add to cart option
      Alert.alert(
        "Item Detected",
        `${DEMO_PRODUCT.name}\nPrice: $${DEMO_PRODUCT.price.toFixed(2)}\n\nWould you like to add this to your cart?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Add to Cart",
            onPress: async () => {
              try {
                await addProductToCart(DEMO_PRODUCT, 1);
                Alert.alert("Success", "Item added to cart!");
              } catch (error) {
                Alert.alert("Error", "Failed to add item to cart.");
              }
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert("Error", "Failed to scan item. Please try again.");
    } finally {
      setScanning(false);
    }
  };

  const toggleFlash = () => {
    setFlash(!flash);
  };

  const toggleCamera = () => {
    setFacing(facing === 'back' ? 'front' : 'back');
  };

  const goToCart = () => {
    router.push('/(main)/cart');
  };

  if (permission === undefined) {
    return <View style={styles.container}><Text>Requesting camera permission...</Text></View>;
  }
  
  if (permission && !permission.granted) {
    return <View style={styles.container}><Text>No access to camera</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Cart Button */}
      <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
        <Text style={styles.cartButtonText}>View Cart</Text>
        <MaterialIcons name="shopping-cart" size={24} color="#000" />
      </TouchableOpacity>

      {/* Detected Item */}
      {scannedItem && (
        <View style={styles.detectedItemContainer}>
          <Text style={styles.detectedItemText}>{scannedItem.name}</Text>
          <View style={styles.checkmark}>
            <Text style={styles.checkmarkText}>✓</Text>
          </View>
        </View>
      )}

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView 
          ref={cameraRef}
          style={styles.camera} 
          facing={facing}
          enableTorch={flash}
        />
        
        {/* Camera Controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={toggleFlash} style={styles.cameraButton}>
            <MaterialIcons 
              name={flash ? "flash-on" : "flash-off"} 
              size={24} 
              color="#fff" 
            />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={toggleCamera} style={styles.cameraButton}>
            <MaterialIcons name="flip-camera-ios" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
        
        {/* Scanner Guidelines */}
        <View style={styles.scannerGuidelines}>
          <View style={styles.guidelineCorner} />
          <View style={[styles.guidelineCorner, {top: 0, right: 0, transform: [{rotate: '90deg'}]}]} />
          <View style={[styles.guidelineCorner, {bottom: 0, right: 0, transform: [{rotate: '180deg'}]}]} />
          <View style={[styles.guidelineCorner, {bottom: 0, left: 0, transform: [{rotate: '270deg'}]}]} />
        </View>
        
        {/* Scanning Indicator */}
        {scanning && (
          <View style={styles.scanningIndicator}>
            <Text style={styles.scanningText}>scanning...</Text>
          </View>
        )}
      </View>

      {/* Scan Button */}
      <TouchableOpacity 
        style={styles.scanButton}
        onPress={handleScan}
        disabled={scanning || cartLoading}
      >
        <Text style={styles.scanButtonText}>
          {scanning ? 'Scanning...' : 'Scan Item'}
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B19CFF',
    marginHorizontal: 20,
    marginTop: 20,
    padding: 15,
    borderRadius: 25,
  },
  cartButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 10,
  },
  cartIcon: {
    width: 24,
    height: 24,
  },
  detectedItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 20,
  },
  detectedItemText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  checkmark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ACFFAC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 18,
    color: '#000',
  },
  cameraContainer: {
    flex: 1,
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
  },
  cameraButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  scannerGuidelines: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  guidelineCorner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#fff',
    borderWidth: 3,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    top: 0,
    left: 0,
    opacity: 0.8,
  },
  scanningIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanningText: {
    color: '#fff',
    fontSize: 16,
  },
  scanButton: {
    backgroundColor: '#53B175',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});
