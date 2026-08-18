import React, { useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View, useColorScheme } from 'react-native';

export interface JoystickProps {
  size?: number;
  /** throttle, turn each in [-1, 1]. Called continuously while dragging and
   * once more with (0, 0) on release. */
  onChange: (throttle: number, turn: number) => void;
  disabled?: boolean;
  /** Fired on touch-down/touch-up so the parent screen can disable its
   * ScrollView for the duration of the drag -- capture-phase responder
   * claims alone aren't enough to stop iOS's native scroll gesture
   * recognizer from also grabbing the touch. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

const DEFAULT_SIZE = 220;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Custom virtual joystick built on PanResponder -- deliberately not using
 * an external joystick library to keep the app's native module footprint
 * minimal and predictable. */
export default function Joystick({
  size = DEFAULT_SIZE,
  onChange,
  disabled,
  onDragStart,
  onDragEnd,
}: JoystickProps) {
  const dark = useColorScheme() === 'dark';
  const radius = size / 2;
  const knobSize = size * 0.42;
  const knobRadius = knobSize / 2;
  const maxTravel = radius - knobRadius;

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  // PanResponder is built once (below, via useRef) so its callbacks close
  // over whatever `onChange`/`disabled`/`onDragStart`/`onDragEnd` were on
  // the *first* render only. Routing through refs that are reassigned every
  // render means the callbacks always see the latest values -- otherwise
  // e.g. a Settings change made after mount (like toggling Invert) would
  // never reach the joystick's drive output.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const onDragStartRef = useRef(onDragStart);
  onDragStartRef.current = onDragStart;
  const onDragEndRef = useRef(onDragEnd);
  onDragEndRef.current = onDragEnd;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      // Capture variants: without these, the parent ScrollView on
      // DriveScreen wins the touch on vertical drags and scrolls the
      // screen instead of moving the knob. Claiming the touch in the
      // capture phase makes sure the joystick gets it first.
      onStartShouldSetPanResponderCapture: () => !disabledRef.current,
      onMoveShouldSetPanResponderCapture: () => !disabledRef.current,
      // Without this, the ScrollView (or anything else) is allowed to
      // request the touch back mid-drag, which fires
      // onPanResponderTerminate -- springing the knob back to center even
      // while still holding it down. Refusing the request keeps the
      // joystick in control until an actual release.
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => onDragStartRef.current?.(),
      onPanResponderMove: (_evt, gesture) => {
        let dx = gesture.dx;
        let dy = gesture.dy;
        const dist = Math.hypot(dx, dy);
        if (dist > maxTravel && dist > 0) {
          const scale = maxTravel / dist;
          dx *= scale;
          dy *= scale;
        }
        pan.setValue({ x: dx, y: dy });
        const turn = clamp(dx / maxTravel, -1, 1);
        const throttle = clamp(-dy / maxTravel, -1, 1);
        onChangeRef.current(throttle, turn);
      },
      onPanResponderRelease: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
        onChangeRef.current(0, 0);
        onDragEndRef.current?.();
      },
      onPanResponderTerminate: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 5 }).start();
        onChangeRef.current(0, 0);
        onDragEndRef.current?.();
      },
    }),
  ).current;

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: dark ? '#1c2430' : '#e2e8f0',
          borderColor: dark ? '#334155' : '#94a3b8',
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <View style={[styles.crosshairV, { backgroundColor: dark ? '#334155' : '#cbd5e1' }]} />
      <View style={[styles.crosshairH, { backgroundColor: dark ? '#334155' : '#cbd5e1' }]} />
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.knob,
          {
            width: knobSize,
            height: knobSize,
            borderRadius: knobRadius,
            backgroundColor: dark ? '#38bdf8' : '#0284c7',
            transform: pan.getTranslateTransform(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
  },
  crosshairV: { position: 'absolute', width: 1, height: '80%' },
  crosshairH: { position: 'absolute', height: 1, width: '80%' },
});
