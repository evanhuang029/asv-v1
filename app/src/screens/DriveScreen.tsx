import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useColorScheme,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useBoatStore } from '../state/useBoatStore';
import { boatConnection } from '../networking/BoatConnection';
import {
  computeDrivePwm,
  mixJoystick,
  type InvertFlags,
  type PwmRange,
} from '../control/driveMixing';
import Joystick from '../components/Joystick';
import TankSliders from '../components/TankSliders';
import MotorBar from '../components/MotorBar';
import SignalBars from '../components/SignalBars';
import DebugConsole from '../components/DebugConsole';
import StopButton from '../components/StopButton';

type Props = NativeStackScreenProps<RootStackParamList, 'Drive'>;
type ControlMode = 'joystick' | 'tank';

/** Signal bars at or below this count for TOO_FAR_CONSECUTIVE_TICKS
 * consecutive ~1s readings (see BoatConnection's SIGNAL_PING_INTERVAL_MS)
 * trigger the auto-shutdown. Requiring more than one bad reading avoids
 * tripping on a single dropped ping. This is a UX safety net on top of,
 * not a replacement for, the bridge's 300ms silence watchdog, which
 * applies regardless of whether this fires (the ESP32 firmware has no
 * comms-loss failsafe of its own). */
const TOO_FAR_BARS_THRESHOLD = 1;
const TOO_FAR_CONSECUTIVE_TICKS = 2;

const STATUS_COLORS: Record<string, string> = {
  disconnected: '#64748b',
  connecting: '#f59e0b',
  connected: '#22c55e',
  failsafe: '#ef4444',
};
const STATUS_LABELS: Record<string, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  connected: 'Connected',
  failsafe: 'Failsafe Tripped',
};

export default function DriveScreen({ navigation }: Props) {
  const dark = useColorScheme() === 'dark';
  const [mode, setMode] = useState<ControlMode>('joystick');
  // Both tank sliders can be dragged at once (two fingers), so this is a
  // count of active drags, not a boolean -- the ScrollView stays disabled
  // as long as at least one control is being touched.
  const [activeDrags, setActiveDrags] = useState(0);
  const handleDragStart = () => setActiveDrags(n => n + 1);
  const handleDragEnd = () => setActiveDrags(n => Math.max(0, n - 1));

  const settings = useBoatStore(s => s.settings);
  const setInvertLeft = useBoatStore(s => s.setInvertLeft);
  const setInvertRight = useBoatStore(s => s.setInvertRight);
  const telemetry = useBoatStore(s => s.telemetry);
  const setMotorPwm = useBoatStore(s => s.setMotorPwm);
  const logs = useBoatStore(s => s.logs);
  const connectionStatus = useBoatStore(s => s.connectionStatus);
  const signalBars = useBoatStore(s => s.signalBars);

  const range: PwmRange = { min: settings.pwmMin, neutral: settings.pwmNeutral, max: settings.pwmMax };
  const invert: InvertFlags = { invertLeft: settings.invertLeft, invertRight: settings.invertRight };

  const lowSignalStreak = useRef(0);
  const tooFarTriggered = useRef(false);

  useEffect(() => {
    if (connectionStatus === 'disconnected' || tooFarTriggered.current) {
      lowSignalStreak.current = 0;
      return;
    }
    if (signalBars <= TOO_FAR_BARS_THRESHOLD) {
      lowSignalStreak.current += 1;
    } else {
      lowSignalStreak.current = 0;
    }
    if (lowSignalStreak.current >= TOO_FAR_CONSECUTIVE_TICKS) {
      tooFarTriggered.current = true;
      boatConnection.stop();
      setMotorPwm(range.neutral, range.neutral);
      Alert.alert('Robot too far', 'The link to the boat is too weak to drive safely -- thrusters stopped.');
      navigation.reset({ index: 0, routes: [{ name: 'Connect' }] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signalBars, connectionStatus]);

  const applyDrive = (rawLeft: number, rawRight: number) => {
    const { leftPwm, rightPwm } = computeDrivePwm(rawLeft, rawRight, invert, range);
    setMotorPwm(leftPwm, rightPwm);
    boatConnection.sendDrive(leftPwm, rightPwm);
  };

  const handleJoystickChange = (throttle: number, turn: number) => {
    const { rawLeft, rawRight } = mixJoystick(throttle, turn);
    applyDrive(rawLeft, rawRight);
  };

  const handleTankChange = (rawLeft: number, rawRight: number) => applyDrive(rawLeft, rawRight);

  const handleStop = () => {
    // STOP + disconnect: send stop, sever the connection entirely, and
    // require an explicit Connect tap to resume -- no auto-reconnect.
    boatConnection.stop();
    setMotorPwm(range.neutral, range.neutral);
    navigation.reset({ index: 0, routes: [{ name: 'Connect' }] });
  };

  // Theme-derived palette, computed once per render instead of scattering
  // `dark ? a : b` through every style prop -- makes the JSX below (and
  // adding new cards later) much easier to scan.
  const c = {
    bg: dark ? '#0b1220' : '#f1f5f9',
    card: dark ? '#111827' : '#ffffff',
    cardBorder: dark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.15)',
    chip: dark ? '#1c2430' : '#e2e8f0',
    text: dark ? '#e2e8f0' : '#1e293b',
    subtext: dark ? '#94a3b8' : '#475569',
    eyebrow: dark ? '#64748b' : '#94a3b8',
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <ScrollView contentContainerStyle={styles.scrollContent} scrollEnabled={activeDrags === 0}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: c.text }]}>🚤 Trashboat</Text>
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.iconButton, { backgroundColor: c.chip }]}
              onPress={() => navigation.navigate('PathPlan')}
            >
              <Text style={styles.iconButtonText}>🗺️</Text>
            </Pressable>
            <Pressable
              style={[styles.iconButton, { backgroundColor: c.chip }]}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={styles.iconButtonText}>⚙️</Text>
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.statusPill,
            { backgroundColor: c.chip, borderColor: STATUS_COLORS[connectionStatus] },
          ]}
        >
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[connectionStatus] }]} />
          <Text style={[styles.statusText, { color: c.text }]}>{STATUS_LABELS[connectionStatus]}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.eyebrow, { color: c.eyebrow }]}>TELEMETRY</Text>
          <MotorBar label="Left thruster" pwmValue={telemetry.leftPwm} range={range} />
          <MotorBar label="Right thruster" pwmValue={telemetry.rightPwm} range={range} />
          <View style={[styles.divider, { backgroundColor: c.cardBorder }]} />
          <View style={styles.bottomTelemetryRow}>
            <Text style={[styles.battery, { color: c.subtext }]}>
              🔋{' '}
              {telemetry.batteryVoltage != null ? `${telemetry.batteryVoltage.toFixed(1)}V` : '--V'}
              {' / '}
              {telemetry.batteryCurrent != null ? `${telemetry.batteryCurrent.toFixed(1)}A` : '--A'}
            </Text>
            <View style={styles.signalGroup}>
              <SignalBars bars={signalBars} />
              <Text style={[styles.signalLabel, { color: c.subtext }]}>Signal</Text>
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.eyebrow, { color: c.eyebrow }]}>CALIBRATION</Text>
          <View style={styles.invertRow}>
            <View style={styles.invertItem}>
              <Text style={[styles.invertLabel, { color: c.text }]}>Invert Left</Text>
              <Switch value={settings.invertLeft} onValueChange={setInvertLeft} />
            </View>
            <View style={styles.invertItem}>
              <Text style={[styles.invertLabel, { color: c.text }]}>Invert Right</Text>
              <Switch value={settings.invertRight} onValueChange={setInvertRight} />
            </View>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: c.card, borderColor: c.cardBorder }]}>
          <Text style={[styles.eyebrow, { color: c.eyebrow }]}>CONTROL</Text>
          <View style={[styles.modeToggleRow, { backgroundColor: c.chip }]}>
            <Pressable
              style={[styles.modeButton, mode === 'joystick' && styles.modeButtonActive]}
              onPress={() => setMode('joystick')}
            >
              <Text
                style={[styles.modeButtonText, { color: mode === 'joystick' ? '#fff' : c.subtext }]}
              >
                Joystick
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modeButton, mode === 'tank' && styles.modeButtonActive]}
              onPress={() => setMode('tank')}
            >
              <Text style={[styles.modeButtonText, { color: mode === 'tank' ? '#fff' : c.subtext }]}>
                Tank Sliders
              </Text>
            </Pressable>
          </View>

          <View style={styles.controlArea}>
            {mode === 'joystick' ? (
              <Joystick
                onChange={handleJoystickChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ) : (
              <TankSliders
                onChange={handleTankChange}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            )}
          </View>
        </View>

        <DebugConsole logs={logs} />
        <View style={{ height: 120 }} />
      </ScrollView>

      <View style={styles.stopContainer} pointerEvents="box-none">
        <StopButton onPress={handleStop} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { padding: 16 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: 0.2 },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: { fontSize: 17 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    marginBottom: 16,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 7 },
  statusText: { fontSize: 13, fontWeight: '700' },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  divider: { height: 1, marginVertical: 12 },
  bottomTelemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  battery: { fontSize: 14, fontWeight: '600' },
  signalGroup: { alignItems: 'center' },
  signalLabel: { fontSize: 11, marginTop: 4, fontWeight: '600' },
  invertRow: { flexDirection: 'row', justifyContent: 'space-around' },
  invertItem: { alignItems: 'center' },
  invertLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  modeToggleRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    gap: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 9,
    alignItems: 'center',
  },
  modeButtonActive: { backgroundColor: '#0284c7' },
  modeButtonText: { fontWeight: '700', fontSize: 13 },
  controlArea: { alignItems: 'center' },
  stopContainer: { position: 'absolute', right: 20, bottom: 28 },
});
