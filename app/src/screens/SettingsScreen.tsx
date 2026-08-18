import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import { useBoatStore, DEFAULT_SETTINGS } from '../state/useBoatStore';

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'numeric' | 'numbers-and-punctuation' | 'default';
  dark: boolean;
}

function Field({ label, value, onChangeText, keyboardType = 'default', dark }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: dark ? '#94a3b8' : '#475569' }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          { color: dark ? '#e2e8f0' : '#1e293b', borderColor: dark ? '#334155' : '#94a3b8' },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const dark = useColorScheme() === 'dark';
  const settings = useBoatStore(s => s.settings);
  const updateSettings = useBoatStore(s => s.updateSettings);
  const resetSettingsToDefaults = useBoatStore(s => s.resetSettingsToDefaults);

  const [ip, setIp] = useState(settings.ip);
  const [port, setPort] = useState(String(settings.port));
  const [pwmMin, setPwmMin] = useState(String(settings.pwmMin));
  const [pwmNeutral, setPwmNeutral] = useState(String(settings.pwmNeutral));
  const [pwmMax, setPwmMax] = useState(String(settings.pwmMax));
  const [unitsPerSecond, setUnitsPerSecond] = useState(String(settings.unitsPerSecond));

  const commitIp = () => {
    const trimmed = ip.trim();
    if (trimmed) updateSettings({ ip: trimmed });
    else setIp(settings.ip);
  };
  const commitPort = () => {
    const n = parseInt(port, 10);
    if (Number.isFinite(n) && n > 0) updateSettings({ port: n });
    else setPort(String(settings.port));
  };
  const commitPwm = (field: 'pwmMin' | 'pwmNeutral' | 'pwmMax', text: string, setter: (s: string) => void) => {
    const n = parseInt(text, 10);
    if (Number.isFinite(n)) updateSettings({ [field]: n } as never);
    else setter(String(settings[field]));
  };
  const commitUnitsPerSecond = () => {
    const n = parseFloat(unitsPerSecond);
    if (Number.isFinite(n) && n > 0) updateSettings({ unitsPerSecond: n });
    else setUnitsPerSecond(String(settings.unitsPerSecond));
  };

  const handleReset = () => {
    Alert.alert('Reset settings?', 'This restores all settings to their defaults.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          resetSettingsToDefaults();
          setIp(DEFAULT_SETTINGS.ip);
          setPort(String(DEFAULT_SETTINGS.port));
          setPwmMin(String(DEFAULT_SETTINGS.pwmMin));
          setPwmNeutral(String(DEFAULT_SETTINGS.pwmNeutral));
          setPwmMax(String(DEFAULT_SETTINGS.pwmMax));
          setUnitsPerSecond(String(DEFAULT_SETTINGS.unitsPerSecond));
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ backgroundColor: dark ? '#0b1220' : '#f1f5f9' }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.sectionTitle, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
        Connection
      </Text>
      <Field label="Pi IP address" value={ip} onChangeText={setIp} dark={dark} />
      {ip !== settings.ip && <CommitHint onPress={commitIp} dark={dark} />}
      <Field
        label="WebSocket port"
        value={port}
        onChangeText={setPort}
        keyboardType="numeric"
        dark={dark}
      />
      {port !== String(settings.port) && <CommitHint onPress={commitPort} dark={dark} />}

      <Text style={[styles.sectionTitle, { color: dark ? '#e2e8f0' : '#1e293b', marginTop: 24 }]}>
        PWM range
      </Text>
      <Text style={[styles.helpText, { color: dark ? '#64748b' : '#94a3b8' }]}>
        Should match whatever the ESC calibration program on the boat determines. Neutral is a
        placeholder (1500) until that calibration is done.
      </Text>
      <Field
        label="Min (µs)"
        value={pwmMin}
        onChangeText={setPwmMin}
        keyboardType="numeric"
        dark={dark}
      />
      {pwmMin !== String(settings.pwmMin) && (
        <CommitHint onPress={() => commitPwm('pwmMin', pwmMin, setPwmMin)} dark={dark} />
      )}
      <Field
        label="Neutral (µs)"
        value={pwmNeutral}
        onChangeText={setPwmNeutral}
        keyboardType="numeric"
        dark={dark}
      />
      {pwmNeutral !== String(settings.pwmNeutral) && (
        <CommitHint onPress={() => commitPwm('pwmNeutral', pwmNeutral, setPwmNeutral)} dark={dark} />
      )}
      <Field
        label="Max (µs)"
        value={pwmMax}
        onChangeText={setPwmMax}
        keyboardType="numeric"
        dark={dark}
      />
      {pwmMax !== String(settings.pwmMax) && (
        <CommitHint onPress={() => commitPwm('pwmMax', pwmMax, setPwmMax)} dark={dark} />
      )}

      <Text style={[styles.sectionTitle, { color: dark ? '#e2e8f0' : '#1e293b', marginTop: 24 }]}>
        Motor direction
      </Text>
      <View style={styles.invertRow}>
        <View style={styles.invertItem}>
          <Text style={[styles.fieldLabel, { color: dark ? '#94a3b8' : '#475569' }]}>
            Invert Left
          </Text>
          <Switch
            value={settings.invertLeft}
            onValueChange={v => updateSettings({ invertLeft: v })}
          />
        </View>
        <View style={styles.invertItem}>
          <Text style={[styles.fieldLabel, { color: dark ? '#94a3b8' : '#475569' }]}>
            Invert Right
          </Text>
          <Switch
            value={settings.invertRight}
            onValueChange={v => updateSettings({ invertRight: v })}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: dark ? '#e2e8f0' : '#1e293b', marginTop: 24 }]}>
        Path Planning
      </Text>
      <Field
        label="Units per second (relative grid units)"
        value={unitsPerSecond}
        onChangeText={setUnitsPerSecond}
        keyboardType="numeric"
        dark={dark}
      />
      {unitsPerSecond !== String(settings.unitsPerSecond) && (
        <CommitHint onPress={commitUnitsPerSecond} dark={dark} />
      )}

      <Pressable style={styles.resetButton} onPress={handleReset}>
        <Text style={styles.resetButtonText}>Reset to defaults</Text>
      </Pressable>
    </ScrollView>
  );
}

function CommitHint({ onPress, dark }: { onPress: () => void; dark: boolean }) {
  return (
    <Pressable onPress={onPress} style={styles.commitHint}>
      <Text style={[styles.commitHintText, { color: dark ? '#38bdf8' : '#0284c7' }]}>
        Tap to apply
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 6 },
  helpText: { fontSize: 12, marginBottom: 12 },
  field: { marginTop: 12 },
  fieldLabel: { fontSize: 13, marginBottom: 6, fontWeight: '600' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  commitHint: { alignSelf: 'flex-end', marginTop: 4 },
  commitHintText: { fontSize: 12, fontWeight: '600' },
  invertRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  invertItem: { alignItems: 'center' },
  resetButton: {
    marginTop: 36,
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resetButtonText: { color: '#fecaca', fontWeight: '700' },
});
