import { Stack } from 'expo-router';
import { useEffect, useState, useRef } from 'react';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { isAuthenticated, clearAllAuthTokens, supabase } from '../services/supabase';
import { View, Text, ActivityIndicator } from 'react-native';

// Set to false to stop forcing logout during development
const FORCE_LOGOUT_ON_START = false;

export default function RootLayout() {
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const authCheckedRef = useRef(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        setLoading(true);
        
        // Only clear tokens on initial app start if FORCE_LOGOUT_ON_START is true
        if (!authCheckedRef.current && FORCE_LOGOUT_ON_START) {
          console.log("App started - forcing logout by clearing tokens");
          await clearAllAuthTokens();
          authCheckedRef.current = true;
        } else if (!authCheckedRef.current) {
          console.log("App started - keeping existing auth tokens");
          authCheckedRef.current = true;
        }
        
        // Check actual auth status after clearing tokens
        console.log('Checking current auth status...');
        const isAuth = await isAuthenticated();
        console.log('Current auth status:', isAuth);
        setAuthStatus(isAuth);
      } catch (error) {
        console.error('Root layout - Error checking auth tokens:', error);
        setError(`Authentication check failed: ${String(error)}`);
        setAuthStatus(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Subscribe to auth state changes
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session ? 'Session exists' : 'No session');
      
      // Update auth status based on session
      const isAuth = !!session;
      console.log('Setting auth status to:', isAuth);
      setAuthStatus(isAuth);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  // Show loading screen while checking authentication
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={{ marginTop: 16 }}>Loading...</Text>
      </View>
    );
  }

  // Show error screen if there was an error
  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: 'red', marginBottom: 10 }}>Error: {error}</Text>
        <Text>Please restart the app</Text>
      </View>
    );
  }

  return (
    <PaperProvider theme={theme}>
      <SafeAreaProvider>
        <Stack screenOptions={{ headerShown: false }}>
          {/* Index screen */}
          <Stack.Screen 
            name="index" 
            options={{ headerShown: false }}
          />
          
          {/* Auth screens */}
          <Stack.Screen 
            name="(auth)" 
            options={{ headerShown: false }}
            redirect={authStatus === true}
          />
          
          {/* Main screens */}
          <Stack.Screen 
            name="(main)" 
            options={{ headerShown: false }}
            redirect={authStatus === false}
          />
          
          {/* Handle 404 errors - updated */}
          <Stack.Screen 
            name="+not-found" 
            options={{ 
              headerShown: false,
              title: 'Not Found'
            }} 
          />
        </Stack>
      </SafeAreaProvider>
    </PaperProvider>
  );
}
