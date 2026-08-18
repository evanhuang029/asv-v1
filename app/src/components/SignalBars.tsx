import React from 'react';
import { StyleSheet, View, useColorScheme } from 'react-native';

const SEGMENT_COUNT = 10;
const SEGMENT_WIDTH = 14;
const SEGMENT_HEIGHT = 5;
const SEGMENT_GAP = 2;

export interface SignalBarsProps {
  /** 0-10, 10 = strongest link, 0/1 = weakest. This is NOT real WiFi RSSI --
   * iOS doesn't expose signal strength to third-party apps. It's derived in
   * BoatConnection from ping/pong round-trip time over the WebSocket link
   * to the Pi bridge, which is actually the more relevant number here
   * (it's a direct measure of how well control commands are getting
   * through, not just raw radio strength). */
  bars: number;
}

function colorForBars(bars: number): string {
  if (bars <= 2) return '#ef4444';
  if (bars <= 5) return '#f59e0b';
  return '#22c55e';
}

/** Vertical 10-segment signal-strength ladder, filled from the bottom up. */
export default function SignalBars({ bars }: SignalBarsProps) {
  const dark = useColorScheme() === 'dark';
  const clamped = Math.max(0, Math.min(SEGMENT_COUNT, Math.round(bars)));
  const color = colorForBars(clamped);
  const emptyColor = dark ? '#1c2430' : '#e2e8f0';

  return (
    <View style={styles.column}>
      {Array.from({ length: SEGMENT_COUNT }, (_, i) => (
        <View
          key={i}
          style={[
            styles.segment,
            { backgroundColor: i < clamped ? color : emptyColor },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: 'column-reverse',
    alignItems: 'center',
  },
  segment: {
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    borderRadius: 1.5,
    marginVertical: SEGMENT_GAP / 2,
  },
});
