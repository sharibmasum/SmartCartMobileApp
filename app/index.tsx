import { Redirect } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, StyleSheet, Button } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isAuthenticated } from '../services/supabase';

export default function Index() {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<boolean | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Add log message function
  const addLog = (message: string) => {
    setLogs(prev => [...prev, message]);
    console.log(message);
  };

  useEffect(() => {
    // Check authentication status
    const checkAuth = async () => {
      try {
        addLog('Checking authentication status...');
        const isAuth = await isAuthenticated();
        addLog(`Authentication status: ${isAuth}`);
        setAuthStatus(isAuth);
      } catch (error) {
        const errorMsg = String(error);
        addLog(`Error checking auth: ${errorMsg}`);
        setError(errorMsg);
        setAuthStatus(false);
      } finally {
        setIsReady(true);
      }
    };

    checkAuth();
  }, []);

  // Function to clear storage and reset
  const clearStorageAndReset = async () => {
    try {
      setIsReady(false);
      addLog('Clearing all storage...');
      
      // Clear all auth tokens from SecureStore
      await SecureStore.deleteItemAsync('access-token');
      await SecureStore.deleteItemAsync('refresh-token'); 
      await SecureStore.deleteItemAsync('supabase-auth-token');
      
      // Clear all auth tokens from AsyncStorage
      await AsyncStorage.removeItem('supabase.auth.access-token');
      await AsyncStorage.removeItem('supabase.auth.refresh-token');
      await AsyncStorage.removeItem('supabase.auth.supabase-auth-token');
      
      addLog('Storage cleared successfully');
      
      // Recheck auth status
      addLog('Rechecking authentication status...');
      const authResult = await isAuthenticated();
      addLog(`New authentication result: ${authResult}`);
      setAuthStatus(authResult);
      setIsReady(true);
    } catch (err) {
      const errorMsg = String(err);
      addLog(`Error clearing storage: ${errorMsg}`);
      setError(errorMsg);
      setIsReady(true);
    }
  };

  // Show loading indicator while checking authentication
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.text}>Loading...</Text>
      </View>
    );
  }

  // If there's an error, show debug screen
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Button title="Clear Storage & Retry" onPress={clearStorageAndReset} />
        <Button title="Continue to Login" onPress={() => setIsReady(true)} />
        
        <ScrollView style={styles.logContainer}>
          <Text style={styles.logTitle}>Debug Logs:</Text>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    );
  }

  // Redirect based on authentication status
  if (authStatus === true) {
    console.log('Index: Redirecting to main app');
    return <Redirect href="/(main)/scanner" />;
  } else {
    console.log('Index: Redirecting to login');
    return <Redirect href="/(auth)/login" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
  },
  text: {
    marginTop: 16,
    textAlign: 'center',
  },
  errorText: {
    color: 'red',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 20,
  },
  logContainer: {
    maxHeight: 300,
    width: '100%',
    backgroundColor: '#f0f0f0',
    padding: 10,
    borderRadius: 5,
  },
  logTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
}); 