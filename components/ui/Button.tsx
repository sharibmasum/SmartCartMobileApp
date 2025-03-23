import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, StyleProp, ViewStyle, TextStyle } from 'react-native';
import { Theme } from '../../theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  style,
  textStyle,
  disabled = false,
  loading = false,
  variant = 'primary',
}) => {
  // Determine button and text styles based on variant
  const getButtonStyle = () => {
    switch (variant) {
      case 'secondary':
        return [styles.button, styles.secondaryButton];
      case 'outline':
        return [styles.button, styles.outlineButton];
      case 'danger':
        return [styles.button, styles.dangerButton];
      case 'primary':
      default:
        return [styles.button, styles.primaryButton];
    }
  };

  const getTextStyle = () => {
    switch (variant) {
      case 'outline':
        return [styles.buttonText, styles.outlineText];
      default:
        return [styles.buttonText];
    }
  };

  return (
    <TouchableOpacity
      style={[
        getButtonStyle(),
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? '#474472' : 'white'} />
      ) : (
        <Text
          style={[
            getTextStyle(),
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: '#474472',
  },
  secondaryButton: {
    backgroundColor: '#b9b1f0',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#474472',
  },
  dangerButton: {
    backgroundColor: '#ff6b6b',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  outlineText: {
    color: '#474472',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    opacity: 0.7,
  },
  disabledText: {
    color: '#999',
  },
});

export default Button; 