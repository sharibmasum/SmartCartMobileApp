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
import { recognizeFoodWithVision } from '../../services/vision';
import { supabase } from '../../services/supabase';

// Define interfaces for our state
interface ScannedItem {
  name: string;
  detected: boolean;
  price?: number;
  confidence?: number;
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Get the current user ID
  useEffect(() => {
    const getUserId = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error getting user session:', error);
        return;
      }
      
      if (data?.session?.user) {
        setUserId(data.session.user.id);
      } else {
        // For development, use a UUID that you know has proper permissions
        console.log('No authenticated user, using demo ID');
        setUserId('550e8400-e29b-41d4-a716-446655440000');
      }
    };
    
    getUserId();
  }, []);
  
  // Get cart functionality from our hook
  const { addProductToCart, loading: cartLoading } = useCart(userId || '');

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  const takePicture = async () => {
    if (!cameraRef.current) return null;
    
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      return photo;
    } catch (error) {
      console.error('Error taking picture:', error);
      return null;
    }
  };

  const handleScan = async () => {
    if (!userId) {
      Alert.alert("Authentication Error", "Please sign in to use this feature.");
      return;
    }
    
    setScanning(true);
    
    try {
      // Take a picture with the camera
      const photo = await takePicture();
      
      if (!photo || !photo.base64) {
        throw new Error('Failed to capture image');
      }
      
      // Send the image to Google Vision API for food recognition
      const recognitionResult = await recognizeFoodWithVision(photo.base64);
      
      if (!recognitionResult || !recognitionResult.items || recognitionResult.items.length === 0) {
        Alert.alert("Not Recognized", "Couldn't identify any food item. Please try again.");
        setScanning(false);
        return;
      }
      
      // Check if we're using mock data
      if (recognitionResult.isMocked) {
        console.log("Using mocked data because API key is invalid");
        // Optionally alert the user that mock data is being used
        Alert.alert(
          "Using Demo Mode",
          "Your API key appears to be invalid. Using demo data for testing. To use real scanning, please update your Google Cloud Vision API key in your .env file.",
          [{ text: "OK" }]
        );
      }
      
      // Get the highest confidence food item
      const bestMatch = recognitionResult.items[0];
      
      // Set the scanned item state
      setScannedItem({
        name: bestMatch.name,
        detected: true,
        price: bestMatch.price || 2.99, // Default price if not available
        confidence: bestMatch.confidence,
      });
      
      // Show add to cart option
      Alert.alert(
        "Food Item Detected",
        `${bestMatch.name}\nConfidence: ${(bestMatch.confidence * 100).toFixed(1)}%\nPrice: $${bestMatch.price?.toFixed(2) || '2.99'}\n\nWould you like to add this to your cart?`,
        [
          {
            text: "Cancel",
            style: "cancel"
          },
          {
            text: "Add to Cart",
            onPress: async () => {
              try {
                if (!userId) {
                  throw new Error('No user ID available');
                }
                
                // Convert the recognized item to a product format
                const recognizedProduct = {
                  id: `vision_${Date.now()}`,
                  name: bestMatch.name,
                  description: `Detected with ${(bestMatch.confidence * 100).toFixed(1)}% confidence`,
                  price: bestMatch.price || 2.99,
                  image_url: photo.uri,
                  barcode: '',
                  category: bestMatch.category || 'Food',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                };
                
                await addProductToCart(recognizedProduct, 1);
                Alert.alert("Success", "Item added to cart!");
              } catch (error) {
                console.error('Error adding to cart:', error);
                Alert.alert("Error", "Failed to add item to cart. Please make sure you're signed in.");
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Vision API error:', error);
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
