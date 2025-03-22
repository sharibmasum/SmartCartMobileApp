/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C',
    background: '#fff',
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

// App color palette
export const colors = {
  primary: '#007AFF',
  secondary: '#F5A623',
  background: '#FFFFFF',
  surface: '#F8F8F8',
  error: '#FF3B30',
  text: '#000000',
  textSecondary: '#8E8E93',
  disabled: '#C7C7CC',
  placeholder: '#8E8E93',
  divider: '#E5E5EA',
  success: '#4CD964',
  warning: '#FF9500',
  info: '#5AC8FA',
};

// Function to get color with opacity
export const getColorWithOpacity = (colorHex: string, opacity: number) => {
  // Ensure opacity is between 0 and 1
  const safeOpacity = Math.max(0, Math.min(1, opacity));
  
  // Extract the RGB part of the color
  const rgbColor = colorHex.substring(1);
  
  // Convert opacity to hex
  const alpha = Math.round(safeOpacity * 255).toString(16).padStart(2, '0');
  
  return `#${rgbColor}${alpha}`;
};
