import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

export interface StopButtonProps {
  onPress: () => void;
  disabled?: boolean;
}

/** Large, high-contrast, always-reachable STOP control. No confirmation
 * dialog -- in an emergency the extra tap costs more than it protects
 * against. Positioning (fixed, thumb-reachable) is the caller's job. */
export default function StopButton({ onPress, disabled }: StopButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={12}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={styles.text}>STOP</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#dc2626',
    borderRadius: 44,
    width: 88,
    height: 88,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    borderWidth: 3,
    borderColor: '#fecaca',
  },
  pressed: { backgroundColor: '#b91c1c', transform: [{ scale: 0.96 }] },
  disabled: { backgroundColor: '#7f1d1d', opacity: 0.5 },
  text: { color: '#fff', fontWeight: '800', fontSize: 18, letterSpacing: 1 },
});
