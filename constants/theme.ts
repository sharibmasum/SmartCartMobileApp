import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

// Define our app colors
export const COLORS = {
  primary: '#b3a7e3', // Purple color for branding
  secondary: '#F5A623',
  background: '#FFFFFF',
  surface: '#F8F8F8',
  error: '#FF3B30',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: COLORS.primary,
    secondary: COLORS.secondary,
    background: COLORS.background,
    surface: COLORS.surface,
    error: COLORS.error,
    text: '#000000',
    disabled: '#C7C7CC',
    placeholder: '#8E8E93',
    backdrop: 'rgba(0, 0, 0, 0.5)',
    notification: '#FF3B30',
  },
}; 