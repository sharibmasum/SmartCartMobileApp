// Color palette for the application
const colors = {
  primary: '#53B175',
  secondary: '#F8A44C',
  background: '#FAFAFA',
  white: '#FFFFFF',
  text: '#181725',
  secondaryText: '#7C7C7C',
  border: '#E2E2E2',
  lightBackground: '#F2F3F2',
  error: '#FF5252',
  success: '#53B175',
  warning: '#FFC107',
  info: '#2196F3',
  input: '#F2F3F2',
  shadow: 'rgba(0, 0, 0, 0.1)',
};

// Typography styles
const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 30,
  },
  fontWeights: {
    normal: '400',
    medium: '500',
    semiBold: '600',
    bold: '700',
  },
};

// Spacing scale for consistent margins/padding
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Border radius scale
const borderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  round: 9999,
};

// Theme object 
export const Theme = {
  colors,
  typography,
  spacing,
  borderRadius,
}; 