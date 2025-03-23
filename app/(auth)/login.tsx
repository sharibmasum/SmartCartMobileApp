import { useState } from 'react';
import { View, StyleSheet, Alert, Text, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Button, TextInput, useTheme } from 'react-native-paper';
import { supabase } from '../../services/supabase';
import { router } from 'expo-router';

export default function Login() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Please enter your email and password');
      return;
    }

    try {
      setLoading(true);
      setErrorMsg(null);
      console.log(`Attempting to sign in with email: ${email}`);

      // Clear any existing login state first
      await supabase.auth.signOut();
      
      // Perform login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Login error:', error.message);
        setErrorMsg(error.message);
        return;
      }

      if (data?.user) {
        console.log('Login successful - user:', data.user.id);
        console.log('Session:', data.session ? 'exists' : 'does not exist');
        
        // Make sure we have finished the loading state first
        setLoading(false);
        
        // Wrap in setTimeout to ensure auth state is fully updated
        setTimeout(() => {
          // Navigate directly to scanner
          console.log('Navigating to scanner...');
          try {
            router.replace('/(main)/scanner');
          } catch (e) {
            console.error('Navigation error:', e);
            alert('Login successful but navigation failed. Please restart the app.');
          }
        }, 100);
        
        return;
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setErrorMsg('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.form}>
        <Text style={styles.title}>SmartCart</Text>
        <Text style={styles.subtitle}>Login</Text>
        
        {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
        
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        
        <Button 
          mode="contained" 
          onPress={handleLogin} 
          style={styles.button}
          disabled={loading}
          labelStyle={{ color: 'black' }}
        >
          {loading ? <ActivityIndicator color="#000" size="small" /> : 'Login'}
        </Button>
        
        <Button 
          mode="text" 
          onPress={() => router.navigate('/(auth)/register')}
          style={styles.linkButton}
          contentStyle={{ flexDirection: 'row', flexWrap: 'wrap' }}
          labelStyle={null}
        >
          <Text style={{ color: 'black' }}>Don't have an account? </Text>
          <Text style={{ color: theme.colors.primary }}>Sign up</Text>
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  form: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    marginBottom: 15,
  },
  button: {
    marginTop: 15,
    paddingVertical: 8,
  },
  linkButton: {
    marginTop: 15,
  },
  error: {
    color: 'red',
    marginBottom: 15,
    textAlign: 'center',
  },
}); 