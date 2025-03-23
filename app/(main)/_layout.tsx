import { Tabs } from 'expo-router';
import { useTheme } from 'react-native-paper';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

// Define our purple color
const PURPLE_COLOR = '#b3a7e3';

export default function MainLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: PURPLE_COLOR,
        tabBarInactiveTintColor: '#888',
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'white',
          borderTopColor: '#eee',
        },
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scanner',
          tabBarIcon: ({ color, size }) => (
            <Icon name="barcode-scan" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: ({ color, size }) => (
            <Icon name="cart" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Icon name="account" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
} 