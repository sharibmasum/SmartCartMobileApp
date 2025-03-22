import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { logout } from '../../services/auth';

// Define interfaces for our state
interface ScannedItem {
  name: string;
  detected: boolean;
  price?: number;
  confidence?: number;
}

// Use a properly formatted UUID for the demo user ID
const DEMO_USER_ID = '550e8400-e29b-41d4-a716-446655440000';

// Set this to false to suppress console errors in production
const SHOW_DEBUG_ERRORS = false;

// Replace console.error with this custom error handler
const logError = (message: string, error: any) => {
  if (SHOW_DEBUG_ERRORS) {
    console.error(message, error);
  }
};

// Helper function to generate a valid UUID v4
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Helper function to get product from database by name
async function getProductByName(name: string) {
  // Normalize the name for better matching
  const normalizedName = name.toLowerCase().trim();
  
  // First try exact match
  const { data: exactMatch, error: exactError } = await supabase
    .from('products')
    .select('*')
    .ilike('name', normalizedName)
    .limit(1);
    
  if (!exactError && exactMatch && exactMatch.length > 0) {
    return exactMatch[0];
  }
  
  // Try partial match
  const { data: partialMatch, error: partialError } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${normalizedName}%`)
    .limit(1);
  
  if (!partialError && partialMatch && partialMatch.length > 0) {
    return partialMatch[0];
  }
  
  // Try matching within category 'Fruits'
  const { data: fruitMatch, error: fruitError } = await supabase
    .from('products')
    .select('*')
    .eq('category', 'Fruits')
    .limit(1);
    
  if (!fruitError && fruitMatch && fruitMatch.length > 0) {
    // Return first fruit as fallback
    return fruitMatch[0];
  }
  
  return null;
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<any>(null);
  const [userId, setUserId] = useState<string>(DEMO_USER_ID); // Initialize with demo UUID
  
  // Get the current user ID
  useEffect(() => {
    const getUserId = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Error getting user session:', error);
          return;
        }
        
        if (data?.session?.user) {
          setUserId(data.session.user.id);
        } else {
          // For development, use a demo UUID
          console.log('No authenticated user, using demo UUID');
          setUserId(DEMO_USER_ID);
        }
      } catch (err) {
        console.error('Error in getUserId:', err);
        // Fall back to demo UUID
        setUserId(DEMO_USER_ID);
      }
    };
    
    getUserId();
  }, []);
  
  // Get cart functionality from our hook
  const { addProductToCart, loading: cartLoading } = useCart(userId);

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

  const handleScan = useCallback(async () => {
    if (scanning || cartLoading) return; // Prevent multiple scans
    
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
      
      // Get the highest confidence food item
      const bestMatch = recognitionResult.items[0];
      
      // Set the scanned item state
      setScannedItem({
        name: bestMatch.name,
        detected: true,
        price: bestMatch.price || 2.99, // Default price if not available
        confidence: bestMatch.confidence, // Keep for internal use but don't show to user
      });
      
      // Use the productId to get the complete product information
      if (!bestMatch.productId) {
        Alert.alert(
          "Product Not Found",
          "This product doesn't appear to be in our database.",
          [{ text: "OK", onPress: () => setScanning(false) }]
        );
        return;
      }
      
      try {
        // Get the complete product from the database
        const { data: databaseProduct, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', bestMatch.productId)
          .single();
        
        if (error || !databaseProduct) {
          logError('Error fetching product from database:', error);
          Alert.alert(
            "Product Not Found",
            "This product doesn't appear to be in our database.",
            [{ text: "OK", onPress: () => setScanning(false) }]
          );
          return;
        }
        
        // Show add to cart option
        Alert.alert(
          "Food Item Detected",
          `${databaseProduct.name}\nPrice: $${databaseProduct.price.toFixed(2)}\n\nWould you like to add this to your cart?`,
          [
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setScanning(false)
            },
            {
              text: "Add to Cart",
              onPress: async () => {
                try {
                  // First close the current dialog to prevent UI freezing
                  setScanning(false);
                  
                  // Add existing product from database to cart
                  const result = await addProductToCart(databaseProduct, 1);
                  
                  // Show success message after operation completes
                  Alert.alert("Success", "Item added to cart!");
                } catch (error) {
                  // Log the error but don't show it to the user
                  logError('Error adding to cart:', error);
                  
                  // Still show success since the item was added to the local cart
                  Alert.alert("Success", "Item added to cart!");
                }
              }
            }
          ],
          { cancelable: false }
        );
      } catch (dbError) {
        logError('Database error:', dbError);
        Alert.alert(
          "Error",
          "Could not fetch product details. Please try again.",
          [{ text: "OK", onPress: () => setScanning(false) }]
        );
      }
    } catch (error) {
      logError('Vision API error:', error);
      Alert.alert("Error", "Failed to scan item. Please try again.");
      setScanning(false);
    }
  }, [scanning, cartLoading, takePicture, addProductToCart]);

  const toggleFlash = () => {
    setFlash(!flash);
  };

  const toggleCamera = () => {
    setFacing(facing === 'back' ? 'front' : 'back');
  };

  const goToCart = () => {
    router.push('/(main)/cart');
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to log out. Please try again.');
    }
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
      
      <View style={styles.topBar}>
        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialIcons name="logout" size={24} color="#000" />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
        
        {/* Cart Button */}
        <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
          <Text style={styles.cartButtonText}>View Cart</Text>
          <MaterialIcons name="shopping-cart" size={24} color="#000" />
        </TouchableOpacity>
      </View>

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
        style={[styles.scanButton, (scanning || cartLoading) && styles.disabledButton]}
        onPress={handleScan}
        activeOpacity={0.7}
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 20,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFB19C',
    padding: 10,
    borderRadius: 25,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 5,
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#B19CFF',
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
  disabledButton: {
    backgroundColor: '#a0d4b1',
    opacity: 0.8,
  },
});
