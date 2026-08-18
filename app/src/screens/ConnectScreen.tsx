import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useBoatStore } from '../state/useBoatStore';
import { boatConnection } from '../networking/BoatConnection';

type Props = NativeStackScreenProps<RootStackParamList, 'Connect'>;

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

export default function ConnectScreen({ navigation }: Props) {
  const settings = useBoatStore(s => s.settings);
  const updateSettings = useBoatStore(s => s.updateSettings);
  const connectionStatus = useBoatStore(s => s.connectionStatus);
  // Local buffer so we don't hammer AsyncStorage on every keystroke -- the
  // store (and thus persisted last-used IP) only updates on Connect.
  const [ip, setIp] = useState(settings.ip);

  useEffect(() => {
    if (connectionStatus === 'connected') {
      navigation.replace('Drive');
    }
  }, [connectionStatus, navigation]);

  const handleConnect = () => {
    const trimmed = ip.trim();
    if (!trimmed) return;
    updateSettings({ ip: trimmed });
    boatConnection.connect(trimmed, settings.port);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>Trashboat Control</Text>

      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[connectionStatus] }]} />
        <Text style={styles.statusText}>{STATUS_LABELS[connectionStatus]}</Text>
      </View>

      <Text style={styles.label}>Pi IP address</Text>
      <TextInput
        style={styles.input}
        value={ip}
        onChangeText={setIp}
        placeholder="192.168.4.1"
        placeholderTextColor="#64748b"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="numbers-and-punctuation"
        editable={connectionStatus !== 'connecting'}
      />
      <Text style={styles.hint}>Port {settings.port} (edit in Settings)</Text>

      <Pressable
        style={[styles.connectButton, connectionStatus === 'connecting' && styles.buttonDisabled]}
        onPress={handleConnect}
        disabled={connectionStatus === 'connecting'}
      >
        <Text style={styles.connectButtonText}>
          {connectionStatus === 'connecting' ? 'Connecting…' : 'Connect'}
        </Text>
      </Pressable>

      <Pressable style={styles.settingsLink} onPress={() => navigation.navigate('Settings')}>
        <Text style={styles.settingsLinkText}>Settings</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1220', padding: 24, justifyContent: 'center' },
  title: {
    color: '#e2e8f0',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 32,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { color: '#e2e8f0', fontSize: 16, fontWeight: '600' },
  label: { color: '#94a3b8', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#1c2430',
    color: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  hint: { color: '#64748b', fontSize: 12, marginTop: 6 },
  connectButton: {
    backgroundColor: '#0284c7',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  buttonDisabled: { opacity: 0.6 },
  connectButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  settingsLink: { marginTop: 20, alignItems: 'center' },
  settingsLinkText: { color: '#38bdf8', fontSize: 14, fontWeight: '600' },
});
