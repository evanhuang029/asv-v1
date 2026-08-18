import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';

const TRACK_HEIGHT = 220;
const TRACK_WIDTH = 56;
const THUMB_SIZE = 40;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface VerticalSliderProps {
  label: string;
  onChange: (value: number) => void;
  /** Fired on touch-down/touch-up so the parent screen can disable its
   * ScrollView for the duration of the drag -- capture-phase responder
   * claims alone aren't enough to stop iOS's native scroll gesture
   * recognizer from also grabbing the touch. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export interface VerticalSliderHandle {
  /** Snap this slider back to its centered (zero-drive) position. */
  zero: () => void;
}

/** A single vertical tank-drive slider in [-1, 1], centered on 0. Holds
 * position where released, like a physical throttle lever, rather than
 * springing back to neutral -- the "Return to Zero" buttons in TankSliders
 * (and the Drive screen's STOP button, which still forces both thrusters
 * neutral immediately) are the ways to bring a thruster back to zero. */
const VerticalSlider = forwardRef<VerticalSliderHandle, VerticalSliderProps>(
  ({ label, onChange, onDragStart, onDragEnd }, ref) => {
    const dark = useColorScheme() === 'dark';
    const travel = TRACK_HEIGHT - THUMB_SIZE;
    const half = travel / 2;
    const pan = useRef(new Animated.Value(0)).current;
    // Position (in px offset from center) the slider was left at when the
    // last gesture ended -- each new drag continues from here instead of
    // from center, since the thumb no longer springs back on release.
    const baseDy = useRef(0);
    const [displayValue, setDisplayValue] = useState(0);

    useImperativeHandle(ref, () => ({
      zero: () => {
        baseDy.current = 0;
        Animated.spring(pan, { toValue: 0, useNativeDriver: false, friction: 5 }).start();
        setDisplayValue(0);
        onChange(0);
      },
    }));

    // PanResponder is built once (below, via useRef) so its callbacks close
    // over whatever `onChange`/`onDragStart`/`onDragEnd` were on the *first*
    // render only. Routing through refs that are reassigned every render
    // means the callbacks always see the latest values -- otherwise e.g. a
    // Settings change made after mount (like toggling Invert) would never
    // reach this slider's drive output.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const onDragStartRef = useRef(onDragStart);
    onDragStartRef.current = onDragStart;
    const onDragEndRef = useRef(onDragEnd);
    onDragEndRef.current = onDragEnd;

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        // Capture variants: without these, the parent ScrollView on
        // DriveScreen wins the touch on vertical drags and scrolls the
        // screen instead of moving the thumb. Claiming the touch in the
        // capture phase makes sure the slider gets it first.
        onStartShouldSetPanResponderCapture: () => true,
        onMoveShouldSetPanResponderCapture: () => true,
        // Without this, the ScrollView (or anything else) is allowed to
        // request the touch back mid-drag, which fires
        // onPanResponderTerminate -- releasing the slider even while still
        // holding it down. Refusing the request keeps the slider in
        // control until an actual release.
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: () => onDragStartRef.current?.(),
        onPanResponderMove: (_evt, gesture) => {
          const dy = clamp(baseDy.current + gesture.dy, -half, half);
          pan.setValue(dy);
          const value = clamp(-dy / half, -1, 1);
          setDisplayValue(value);
          onChangeRef.current(value);
        },
        onPanResponderRelease: (_evt, gesture) => {
          baseDy.current = clamp(baseDy.current + gesture.dy, -half, half);
          onDragEndRef.current?.();
        },
        onPanResponderTerminate: (_evt, gesture) => {
          baseDy.current = clamp(baseDy.current + gesture.dy, -half, half);
          onDragEndRef.current?.();
        },
      }),
    ).current;

    return (
      <View style={styles.column}>
        <Text style={[styles.value, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
          {displayValue.toFixed(2)}
        </Text>
        <View
          style={[
            styles.track,
            {
              backgroundColor: dark ? '#1c2430' : '#e2e8f0',
              borderColor: dark ? '#334155' : '#94a3b8',
            },
          ]}
        >
          <View style={[styles.centerTick, { backgroundColor: dark ? '#475569' : '#cbd5e1' }]} />
          <Animated.View
            {...panResponder.panHandlers}
            style={[
              styles.thumb,
              {
                backgroundColor: dark ? '#38bdf8' : '#0284c7',
                transform: [{ translateY: pan }],
              },
            ]}
          />
        </View>
        <Text style={[styles.label, { color: dark ? '#94a3b8' : '#475569' }]}>{label}</Text>
      </View>
    );
  },
);

export interface TankSlidersProps {
  /** rawLeft, rawRight each in [-1, 1] -- fed directly into driveMixing
   * (after inversion) with no further mixing, unlike Joystick mode. */
  onChange: (rawLeft: number, rawRight: number) => void;
  /** Fired whenever either slider's drag-active count transitions to/from
   * zero, so the Drive screen can disable its ScrollView while at least
   * one slider is actively being dragged -- both sliders can be dragged
   * simultaneously (two fingers), so this is a start/end pair per drag,
   * not a single toggle. */
  onDragStart?: () => void;
  onDragEnd?: () => void;
}

export default function TankSliders({ onChange, onDragStart, onDragEnd }: TankSlidersProps) {
  const dark = useColorScheme() === 'dark';
  const leftRef = useRef(0);
  const rightRef = useRef(0);
  const leftSliderRef = useRef<VerticalSliderHandle>(null);
  const rightSliderRef = useRef<VerticalSliderHandle>(null);

  const handleLeft = (v: number) => {
    leftRef.current = v;
    onChange(leftRef.current, rightRef.current);
  };
  const handleRight = (v: number) => {
    rightRef.current = v;
    onChange(leftRef.current, rightRef.current);
  };

  return (
    <View>
      <View style={styles.row}>
        <VerticalSlider
          ref={leftSliderRef}
          label="LEFT"
          onChange={handleLeft}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <VerticalSlider
          ref={rightSliderRef}
          label="RIGHT"
          onChange={handleRight}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </View>
      <View style={styles.zeroRow}>
        <Pressable
          style={[
            styles.zeroButton,
            { backgroundColor: dark ? '#1c2430' : '#e2e8f0', borderColor: dark ? '#334155' : '#94a3b8' },
          ]}
          onPress={() => leftSliderRef.current?.zero()}
        >
          <Text style={[styles.zeroButtonText, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
            Return Left to Zero
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.zeroButton,
            { backgroundColor: dark ? '#1c2430' : '#e2e8f0', borderColor: dark ? '#334155' : '#94a3b8' },
          ]}
          onPress={() => rightSliderRef.current?.zero()}
        >
          <Text style={[styles.zeroButtonText, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
            Return Right to Zero
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 56 },
  zeroRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 20 },
  zeroButton: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1 },
  zeroButtonText: { fontSize: 12, fontWeight: '600' },
  column: { alignItems: 'center' },
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_WIDTH / 2,
    borderWidth: 2,
  },
  centerTick: {
    position: 'absolute',
    top: TRACK_HEIGHT / 2 - 1,
    left: 6,
    right: 6,
    height: 2,
  },
  thumb: {
    position: 'absolute',
    top: (TRACK_HEIGHT - THUMB_SIZE) / 2,
    left: (TRACK_WIDTH - THUMB_SIZE) / 2,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
  value: { marginBottom: 6, fontVariant: ['tabular-nums'], fontSize: 13 },
  label: { marginTop: 6, fontSize: 12, fontWeight: '600' },
});
