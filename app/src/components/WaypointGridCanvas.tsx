import React, { useRef } from 'react';
import {
  GestureResponderEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { Waypoint } from '../types/path';

export const GRID_UNIT_PX = 20;
const DEFAULT_SIZE = 300;
const MARKER_SIZE = 28;
const LONG_PRESS_DELETE_MS = 500;
const DRAG_THRESHOLD_PX = 4;

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function clampToCanvas(x: number, y: number, size: number): { x: number; y: number } {
  return { x: Math.min(size, Math.max(0, x)), y: Math.min(size, Math.max(0, y)) };
}

export interface WaypointGridCanvasProps {
  waypoints: Waypoint[];
  onAddWaypoint: (x: number, y: number) => void;
  onMoveWaypoint: (id: string, x: number, y: number) => void;
  onDeleteWaypoint: (id: string) => void;
  size?: number;
}

/** Blank square grid for placing/dragging/deleting relative waypoints.
 * Deliberately labeled "relative units" -- there's no GPS yet, so this has
 * no real-world distance accuracy. See control/navigator.ts for how these
 * get turned into dead-reckoning legs. */
export default function WaypointGridCanvas({
  waypoints,
  onAddWaypoint,
  onMoveWaypoint,
  onDeleteWaypoint,
  size = DEFAULT_SIZE,
}: WaypointGridCanvasProps) {
  const dark = useColorScheme() === 'dark';
  const half = size / 2;

  const lineOffsets: number[] = [];
  for (let px = 0; px <= size; px += GRID_UNIT_PX) {
    lineOffsets.push(px);
  }

  const handlePress = (evt: GestureResponderEvent) => {
    const { locationX, locationY } = evt.nativeEvent;
    const gx = (locationX - half) / GRID_UNIT_PX;
    const gy = (locationY - half) / GRID_UNIT_PX;
    onAddWaypoint(round2(gx), round2(gy));
  };

  return (
    <View>
      <Pressable onPress={handlePress}>
        <View
          style={[
            styles.canvas,
            {
              width: size,
              height: size,
              backgroundColor: dark ? '#0f1622' : '#f8fafc',
              borderColor: dark ? '#334155' : '#94a3b8',
            },
          ]}
        >
          {lineOffsets.map(px => (
            <React.Fragment key={`grid-${px}`}>
              <View
                pointerEvents="none"
                style={[
                  styles.gridLineV,
                  {
                    left: px,
                    backgroundColor:
                      px === half ? (dark ? '#475569' : '#94a3b8') : dark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              />
              <View
                pointerEvents="none"
                style={[
                  styles.gridLineH,
                  {
                    top: px,
                    backgroundColor:
                      px === half ? (dark ? '#475569' : '#94a3b8') : dark ? '#1e293b' : '#e2e8f0',
                  },
                ]}
              />
            </React.Fragment>
          ))}

          {waypoints.map((wp, index) => (
            <WaypointMarker
              key={wp.id}
              index={index + 1}
              waypoint={wp}
              canvasHalf={half}
              canvasSize={size}
              onMove={(x, y) => onMoveWaypoint(wp.id, x, y)}
              onDelete={() => onDeleteWaypoint(wp.id)}
            />
          ))}
        </View>
      </Pressable>
      <Text style={[styles.caption, { color: dark ? '#64748b' : '#94a3b8' }]}>
        Relative units, ~1 unit ≈ 1 second of travel (uncalibrated placeholder, no real-world
        distance accuracy). Tap to add a waypoint, drag to move, long-press to delete.
      </Text>
    </View>
  );
}

interface WaypointMarkerProps {
  index: number;
  waypoint: Waypoint;
  canvasHalf: number;
  canvasSize: number;
  onMove: (x: number, y: number) => void;
  onDelete: () => void;
}

function WaypointMarker({
  index,
  waypoint,
  canvasHalf,
  canvasSize,
  onMove,
  onDelete,
}: WaypointMarkerProps) {
  const startPx = useRef({ x: 0, y: 0 });
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moved = useRef(false);

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        moved.current = false;
        startPx.current = {
          x: canvasHalf + waypoint.x * GRID_UNIT_PX,
          y: canvasHalf + waypoint.y * GRID_UNIT_PX,
        };
        longPressTimer.current = setTimeout(() => {
          if (!moved.current) onDelete();
        }, LONG_PRESS_DELETE_MS);
      },
      onPanResponderMove: (_evt, gesture) => {
        if (Math.abs(gesture.dx) > DRAG_THRESHOLD_PX || Math.abs(gesture.dy) > DRAG_THRESHOLD_PX) {
          if (!moved.current) {
            moved.current = true;
            clearTimer();
          }
        }
        if (moved.current) {
          const newPx = clampToCanvas(
            startPx.current.x + gesture.dx,
            startPx.current.y + gesture.dy,
            canvasSize,
          );
          const gx = round2((newPx.x - canvasHalf) / GRID_UNIT_PX);
          const gy = round2((newPx.y - canvasHalf) / GRID_UNIT_PX);
          onMove(gx, gy);
        }
      },
      onPanResponderRelease: clearTimer,
      onPanResponderTerminate: clearTimer,
    }),
  ).current;

  const px = canvasHalf + waypoint.x * GRID_UNIT_PX;
  const py = canvasHalf + waypoint.y * GRID_UNIT_PX;

  return (
    <View
      {...panResponder.panHandlers}
      style={[styles.marker, { left: px - MARKER_SIZE / 2, top: py - MARKER_SIZE / 2 }]}
    >
      <Text style={styles.markerText}>{index}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: {
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  gridLineV: { position: 'absolute', top: 0, bottom: 0, width: 1 },
  gridLineH: { position: 'absolute', left: 0, right: 0, height: 1 },
  marker: {
    position: 'absolute',
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e0f2fe',
  },
  markerText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  caption: { fontSize: 11, marginTop: 8, textAlign: 'center', paddingHorizontal: 8 },
});
