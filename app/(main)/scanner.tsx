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
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useCart } from '../../hooks/useCart';
import { recognizeFoodWithVision } from '../../services/vision';
import { supabase } from '../../services/supabase';
import { logout } from '../../services/auth';
import Button from '../../components/ui/Button';
import { Theme } from '../../theme';
import { getCurrentUser } from '../../services/auth';

// Define interfaces for our state
interface ScannedItem {
  name: string;
  detected: boolean;
  price?: number;
  confidence?: number;
}

// Enable debug logging
const SHOW_DEBUG_ERRORS = true;

// Custom logger that can be turned on/off
const logError = (message: string, error: any) => {
  if (SHOW_DEBUG_ERRORS) {
    console.error(`[Scanner] ${message}`, error);
  }
};

// Helper function for logging debug information
const logDebug = (message: string, data?: any) => {
  if (SHOW_DEBUG_ERRORS) {
    if (data) {
      console.log(`[Scanner] ${message}`, data);
    } else {
      console.log(`[Scanner] ${message}`);
    }
  }
};

// Helper function to get product from database by name
async function getProductByName(name: string) {
  // Normalize the name for better matching
  const normalizedName = name.toLowerCase().trim();
  
  logDebug(`Searching for product with name: ${normalizedName}`);
  
  // First try exact match
  const { data: exactMatch, error: exactError } = await supabase
    .from('products')
    .select('*')
    .ilike('name', normalizedName)
    .limit(1);
  
  if (exactError) {
    logError('Error during exact match search:', exactError);
  }
    
  if (!exactError && exactMatch && exactMatch.length > 0) {
    logDebug(`Found exact match: ${exactMatch[0].name}`);
    return exactMatch[0];
  }
  
  // Try partial match
  const { data: partialMatch, error: partialError } = await supabase
    .from('products')
    .select('*')
    .ilike('name', `%${normalizedName}%`)
    .limit(1);
  
  if (partialError) {
    logError('Error during partial match search:', partialError);
  }
  
  if (!partialError && partialMatch && partialMatch.length > 0) {
    logDebug(`Found partial match: ${partialMatch[0].name}`);
    return partialMatch[0];
  }
  
  // Try matching within category 'Fruits'
  const { data: fruitMatch, error: fruitError } = await supabase
    .from('products')
    .select('*')
    .eq('category', 'Fruits')
    .limit(1);
  
  if (fruitError) {
    logError('Error during fruit category search:', fruitError);
  }
    
  if (!fruitError && fruitMatch && fruitMatch.length > 0) {
    // Return first fruit as fallback
    logDebug(`No match found, returning first fruit as fallback: ${fruitMatch[0].name}`);
    return fruitMatch[0];
  }
  
  logDebug('No product found matching the name');
  return null;
}

export default function Scanner() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedItem, setScannedItem] = useState<ScannedItem | null>(null);
  const [scanning, setScanning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const cameraRef = useRef<any>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showDetectedItem, setShowDetectedItem] = useState(false);
  const [detectedProduct, setDetectedProduct] = useState<any>(null);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const successPopupAnim = useRef(new Animated.Value(0)).current;
  
  // Animated value for slide-up panel
  const slideUpAnim = useRef(new Animated.Value(0)).current;
  
  // Get the current user ID
  useEffect(() => {
    const getUserId = async () => {
      setUserLoading(true);
      try {
        logDebug('Attempting to get current user');
        const user = await getCurrentUser();
        
        if (user && user.id) {
          logDebug(`User authenticated: ${user.id}`);
          setUserId(user.id);
        } else {
          logDebug('No authenticated user, redirecting to login');
          // If no user is authenticated, redirect to login
          Alert.alert(
            "Authentication Required", 
            "You need to be logged in to use the scanner.",
            [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
          );
        }
      } catch (err) {
        logError('Error getting current user:', err);
        // Show error message and redirect to login
        Alert.alert(
          "Authentication Error", 
          "There was a problem verifying your login. Please try again.",
          [{ text: "OK", onPress: () => router.replace('/(auth)/login') }]
        );
      } finally {
        setUserLoading(false);
      }
    };
    
    getUserId();
  }, []);
  
  // Get cart functionality from our hook - only initialize when we have a userId
  const { 
    addProductToCart, 
    loading: cartLoading,
    error: cartError 
  } = useCart(userId || '');

  // Handle cart errors
  useEffect(() => {
    if (cartError) {
      logError('Cart error:', cartError);
      Alert.alert(
        "Cart Error",
        "There was a problem with your cart. Please try again later.",
        [{ text: "OK" }]
      );
    }
  }, [cartError]);

  useEffect(() => {
    (async () => {
      if (permission && !permission.granted) {
        await requestPermission();
      }
    })();
  }, [permission, requestPermission]);

  // Animation for slide-up panel
  useEffect(() => {
    if (showDetectedItem) {
      Animated.spring(slideUpAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.spring(slideUpAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    }
  }, [showDetectedItem, slideUpAnim]);

  // Animation for success popup
  useEffect(() => {
    if (showSuccessPopup) {
      // Animate in
      Animated.sequence([
        Animated.timing(successPopupAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        // Hold for 1.5 seconds
        Animated.delay(1500),
        // Animate out
        Animated.timing(successPopupAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start(({ finished }) => {
        if (finished) {
          setShowSuccessPopup(false);
        }
      });
    }
  }, [showSuccessPopup, successPopupAnim]);

  const takePicture = async () => {
    if (!cameraRef.current) return null;
    
    try {
      logDebug('Taking picture with camera');
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });
      return photo;
    } catch (error) {
      logError('Error taking picture:', error);
      return null;
    }
  };

  const handleScan = useCallback(async () => {
    if (scanning || cartLoading || !userId) {
      if (!userId) {
        logDebug('Cannot scan: No authenticated user');
        Alert.alert("Login Required", "Please login to scan products.");
      } else if (scanning) {
        logDebug('Already scanning, ignoring request');
      } else if (cartLoading) {
        logDebug('Cart operation in progress, ignoring scan request');
      }
      return;
    }
    
    logDebug('Starting product scan');
    setScanning(true);
    
    try {
      // Take a picture with the camera
      const photo = await takePicture();
      
      if (!photo || !photo.base64) {
        throw new Error('Failed to capture image');
      }
      
      logDebug('Image captured, sending to Vision API');
      
      // Send the image to Google Vision API for food recognition
      const recognitionResult = await recognizeFoodWithVision(photo.base64);
      
      if (!recognitionResult || !recognitionResult.items || recognitionResult.items.length === 0) {
        logDebug('No items recognized in image');
        // Display in UI instead of alert
        setScannedItem({
          name: "No item recognized",
          detected: false,
        });
        setScanning(false);
        return;
      }
      
      // Get the highest confidence food item
      const bestMatch = recognitionResult.items[0];
      logDebug(`Best match from Vision API: ${bestMatch.name}`);
      
      // Use the productId to get the complete product information
      if (!bestMatch.productId) {
        logDebug('Best match has no product ID');
        // Display in UI instead of alert
        setScannedItem({
          name: "Item not in database",
          detected: false, // This will hide the checkmark
        });
        setScanning(false);
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
          
          // Try to get by name as fallback
          logDebug(`Trying to find product by name: ${bestMatch.name}`);
          const productByName = await getProductByName(bestMatch.name);
          
          if (productByName) {
            setDetectedProduct(productByName);
            setScannedItem({
              name: productByName.name,
              price: productByName.price,
              detected: true,
              confidence: bestMatch.confidence,
            });
            setShowDetectedItem(true);
          } else {
            setScannedItem({
              name: bestMatch.name,
              detected: false,
              confidence: bestMatch.confidence,
            });
          }
        } else {
          // We found the product!
          logDebug(`Product found in database: ${databaseProduct.name}`);
          setDetectedProduct(databaseProduct);
          setScannedItem({
            name: databaseProduct.name,
            price: databaseProduct.price,
            detected: true,
            confidence: bestMatch.confidence,
          });
          setShowDetectedItem(true);
        }
      } catch (dbError) {
        logError('Error in database query:', dbError);
        // Display error message
        setScannedItem({
          name: bestMatch.name,
          detected: false,
          confidence: bestMatch.confidence,
        });
      }
    } catch (e) {
      logError('Error scanning item:', e);
      Alert.alert('Error', 'Failed to scan item. Please try again.');
    } finally {
      setScanning(false);
    }
  }, [scanning, cartLoading, userId]);

  const handleAddToCart = useCallback(async () => {
    if (!detectedProduct || !userId) {
      if (!userId) {
        logDebug('Cannot add to cart: No authenticated user');
        Alert.alert("Login Required", "Please login to add items to your cart.");
      } else {
        logDebug('Cannot add to cart: No detected product');
      }
      return;
    }
    
    try {
      logDebug(`Adding product to cart: ${detectedProduct.name}`);
      const result = await addProductToCart(detectedProduct, 1);
      
      if (result) {
        logDebug(`Successfully added ${detectedProduct.name} to cart`);
        // Hide the panel
        setShowDetectedItem(false);
        // Show success popup
        setShowSuccessPopup(true);
      } else {
        logError('Failed to add product to cart', null);
        Alert.alert(
          'Error', 
          'Could not add item to cart. Please try again.'
        );
      }
    } catch (error) {
      logError('Error adding to cart:', error);
      Alert.alert(
        'Error', 
        'Failed to add item to cart. Please try again.'
      );
    }
  }, [detectedProduct, addProductToCart, userId]);

  const toggleFlash = () => {
    setFlash(prev => !prev);
  };

  const toggleCamera = () => {
    setFacing(prev => prev === 'back' ? 'front' : 'back');
  };

  const goToCart = () => {
    if (!userId) {
      Alert.alert("Login Required", "Please login to view your cart.");
      return;
    }
    router.push('/(main)/cart');
  };

  const handleCloseDetectedItem = () => {
    setShowDetectedItem(false);
    setDetectedProduct(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  const handleSettings = () => {
    setShowSettings(!showSettings);
  };

  // Loading state while checking for user authentication
  if (userLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.primary} />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </SafeAreaView>
    );
  }

  // If no user is authenticated
  if (!userId) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.errorText}>Authentication Required</Text>
        <Button 
          title="Go to Login" 
          onPress={() => router.replace('/(auth)/login')}
          style={styles.loginButton} 
        />
      </SafeAreaView>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>We need your permission to use the camera</Text>
        <Button 
          title="Grant Permission" 
          onPress={requestPermission} 
          style={{ marginTop: 20 }}
        />
      </View>
    );
  }

  // Calculate transform for slide-up animation
  const slideUpStyle = {
    transform: [
      {
        translateY: slideUpAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [300, -30],
        }),
      },
    ],
    opacity: slideUpAnim,
  };

  // Calculate transform for success popup animation
  const successPopupStyle = {
    opacity: successPopupAnim,
    transform: [
      {
        translateY: successPopupAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-20, 0],
        }),
      },
    ],
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Settings Menu Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={showSettings}
        onRequestClose={() => setShowSettings(false)}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalView}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Settings</Text>
            
            <TouchableOpacity 
              style={styles.modalOption}
              onPress={() => {
                setShowSettings(false);
                handleLogout();
              }}
            >
              <MaterialIcons name="logout" size={24} color="#000" />
              <Text style={styles.modalOptionText}>Logout</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalCloseButton}
              onPress={() => setShowSettings(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      
      {/* Success Popup */}
      {showSuccessPopup && (
        <Animated.View style={[styles.successPopup, successPopupStyle]}>
          <View style={styles.successPopupContent}>
            <MaterialIcons name="check-circle" size={24} color="#fff" style={styles.successIcon} />
            <Text style={styles.successPopupText}>Item added to cart!</Text>
          </View>
        </Animated.View>
      )}
      
      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Top section with settings gear and cart button */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.cartButton} onPress={goToCart}>
            <Text style={styles.cartButtonText}>View Cart</Text>
            <MaterialIcons name="shopping-cart" size={24} color="#000" />
          </TouchableOpacity>
          
          <View style={styles.headerRightButtons}>
            <TouchableOpacity style={styles.profileButton} onPress={() => router.push('/(main)/profile')}>
              <MaterialIcons name="person" size={24} color="#333" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsButton} onPress={handleSettings}>
              <MaterialIcons name="settings" size={24} color="#333" />
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Detected Item */}
        {scannedItem && (
          <View style={styles.detectedItemContainer}>
            <Text style={[styles.detectedItemText, !scannedItem.detected && styles.notFoundText]}>
              {scannedItem.name}
            </Text>
            {scannedItem.detected && (
              <View style={styles.checkmark}>
                <Text style={styles.checkmarkText}>✓</Text>
              </View>
            )}
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
           
          </View>
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
      </View>

      {/* Detected Food Item Slide-up Panel */}
      {showDetectedItem && detectedProduct && (
        <Animated.View style={[styles.detectedItemPanel, slideUpStyle]}>
          <View style={styles.detectedItemPanelContent}>
            <Text style={styles.detectedItemPanelTitle}>Food Item Detected</Text>
            
            <Text style={styles.detectedItemPanelName}>{detectedProduct.name}</Text>
            <Text style={styles.detectedItemPanelPrice}>${detectedProduct.price.toFixed(2)}</Text>
            
            <Text style={styles.detectedItemPanelQuestion}>
              Would you like to add this to your cart?
            </Text>
            
            <View style={styles.detectedItemPanelButtons}>
              <TouchableOpacity 
                style={styles.cancelButton}
                onPress={handleCloseDetectedItem}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.addToCartButton}
                onPress={handleAddToCart}
              >
                <Text style={styles.addToCartButtonText}>Add to Cart</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainContent: {
    flex: 1,
    paddingVertical: 5,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 15,
    paddingBottom: 10,
    paddingHorizontal: 20,
  },
  settingsButton: {
    padding: 10,
  },
  cartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#b9b1f0', // Light purple button color
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  cartButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginRight: 5,
  },
  detectedItemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  detectedItemText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  checkmark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    fontSize: 18,
    color: '#fff',
  },
  cameraContainer: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 15,
    marginBottom: 15,
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
    zIndex: 10,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.7)',
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

  scanButton: {
    backgroundColor: '#b3a7e3', // Purple to match requested color
    marginHorizontal: 20,
    marginBottom: 30,
    marginTop: 15,
    padding: 16,
    borderRadius: 25,
    alignItems: 'center',
  },
  scanButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'black',
  },
  disabledButton: {
    backgroundColor: '#474472',
    opacity: 0.9,
  },
  modalView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  modalContent: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalOptionText: {
    fontSize: 18,
    marginLeft: 15,
  },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: '#ddd',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Slide-up panel styles
  detectedItemPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -3,
    },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  detectedItemPanelContent: {
    backgroundColor: '#fff',
    padding: 24,
    paddingBottom: 60,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
  },
  detectedItemPanelTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#000',
    textAlign: 'center',
    marginBottom: 16,
  },
  detectedItemPanelName: {
    fontSize: 20,
    color: '#000',
    textAlign: 'center',
    marginBottom: 8,
  },
  detectedItemPanelPrice: {
    fontSize: 18,
    color: '#b9b1f0',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  detectedItemPanelQuestion: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  detectedItemPanelButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginRight: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
  },
  addToCartButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    marginLeft: 8,
    backgroundColor: '#b9b1f0',
    borderRadius: 8,
  },
  addToCartButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  // Success popup styles
  successPopup: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  successPopupContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#474472',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  successIcon: {
    marginRight: 8,
  },
  successPopupText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerRightButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileButton: {
    padding: 10,
    marginRight: 5,
  },
  notFoundText: {
    color: '#D32F2F', // Red color for error state
    fontSize: 18,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 18,
    marginBottom: 20,
  },
  loginButton: {
    backgroundColor: '#b3a7e3',
    padding: 16,
    borderRadius: 25,
  },
  text: {
    fontSize: 18,
    marginBottom: 20,
  },
});
