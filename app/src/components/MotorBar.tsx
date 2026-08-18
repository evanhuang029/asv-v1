import React from 'react';
import { StyleSheet, Text, View, useColorScheme } from 'react-native';
import type { PwmRange } from '../control/driveMixing';

export interface MotorBarProps {
  label: string;
  pwmValue: number;
  range: PwmRange;
}

/** Horizontal bar centered on neutral -- green fill to the right for
 * forward, red fill to the left for reverse. */
export default function MotorBar({ label, pwmValue, range }: MotorBarProps) {
  const dark = useColorScheme() === 'dark';
  const forward = pwmValue >= range.neutral;
  const span = forward
    ? Math.max(1, range.max - range.neutral)
    : Math.max(1, range.neutral - range.min);
  const magnitude = Math.abs(pwmValue - range.neutral);
  const fraction = Math.min(1, magnitude / span);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: dark ? '#e2e8f0' : '#1e293b' }]}>{label}</Text>
        <Text style={[styles.value, { color: dark ? '#94a3b8' : '#475569' }]}>
          {pwmValue}µs
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: dark ? '#1c2430' : '#e2e8f0' }]}>
        <View style={[styles.centerLine, { backgroundColor: dark ? '#475569' : '#94a3b8' }]} />
        {forward ? (
          <View
            style={[
              styles.fill,
              { left: '50%', width: `${fraction * 50}%`, backgroundColor: '#22c55e' },
            ]}
          />
        ) : (
          <View
            style={[
              styles.fill,
              { right: '50%', width: `${fraction * 50}%`, backgroundColor: '#ef4444' },
            ]}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 6 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: '600' },
  value: { fontSize: 12, fontVariant: ['tabular-nums'] },
  track: { height: 16, borderRadius: 8, overflow: 'hidden' },
  centerLine: { position: 'absolute', left: '50%', width: 2, height: '100%' },
  fill: { position: 'absolute', top: 0, bottom: 0, borderRadius: 8 },
});
