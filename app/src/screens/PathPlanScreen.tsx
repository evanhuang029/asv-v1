import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { useBoatStore } from '../state/useBoatStore';
import { boatConnection } from '../networking/BoatConnection';
import { DeadReckoningExecutor, computeLegs } from '../control/navigator';
import WaypointGridCanvas from '../components/WaypointGridCanvas';
import { generateId } from '../utils/id';

type Props = NativeStackScreenProps<RootStackParamList, 'PathPlan'>;

export default function PathPlanScreen(_props: Props) {
  const dark = useColorScheme() === 'dark';

  const activePath = useBoatStore(s => s.activePath);
  const setActivePath = useBoatStore(s => s.setActivePath);
  const savedPaths = useBoatStore(s => s.savedPaths);
  const savePath = useBoatStore(s => s.savePath);
  const loadPath = useBoatStore(s => s.loadPath);
  const deletePath = useBoatStore(s => s.deletePath);
  const settings = useBoatStore(s => s.settings);
  const setMotorPwm = useBoatStore(s => s.setMotorPwm);

  const [pathName, setPathName] = useState('');
  const [running, setRunning] = useState(false);

  const executorRef = useRef(
    new DeadReckoningExecutor({
      sendDrive: (left, right) => {
        setMotorPwm(left, right);
        boatConnection.sendDrive(left, right);
      },
      getPwmRange: () => {
        const s = useBoatStore.getState().settings;
        return { min: s.pwmMin, neutral: s.pwmNeutral, max: s.pwmMax };
      },
      getInvert: () => {
        const s = useBoatStore.getState().settings;
        return { invertLeft: s.invertLeft, invertRight: s.invertRight };
      },
      getUnitsPerSecond: () => useBoatStore.getState().settings.unitsPerSecond,
    }),
  ).current;

  useEffect(() => {
    // Stop any in-progress dead-reckoning run if the user navigates away.
    return () => executorRef.stop();
  }, [executorRef]);

  const addWaypoint = (x: number, y: number) => {
    setActivePath([...activePath, { id: generateId('wp'), x, y }]);
  };
  const moveWaypoint = (id: string, x: number, y: number) => {
    setActivePath(activePath.map(wp => (wp.id === id ? { ...wp, x, y } : wp)));
  };
  const deleteWaypoint = (id: string) => {
    setActivePath(activePath.filter(wp => wp.id !== id));
  };
  const reorder = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= activePath.length) return;
    const next = [...activePath];
    [next[index], next[target]] = [next[target], next[index]];
    setActivePath(next);
  };
  const clearPath = () => setActivePath([]);

  const handleRunPath = async () => {
    if (activePath.length < 2) {
      Alert.alert('Need at least 2 waypoints', 'Add another waypoint to define a leg to run.');
      return;
    }
    if (!boatConnection.isConnected) {
      Alert.alert('Not connected', 'Connect to the boat before running a path.');
      return;
    }
    setRunning(true);
    try {
      await executorRef.run(activePath);
    } finally {
      setRunning(false);
    }
  };

  const handleStopPath = () => {
    executorRef.stop();
    setRunning(false);
  };

  const handleSave = () => {
    const trimmed = pathName.trim();
    if (!trimmed) {
      Alert.alert('Name required', 'Enter a name to save this path.');
      return;
    }
    savePath(trimmed);
    setPathName('');
  };

  const legs = computeLegs(activePath, settings.unitsPerSecond);
  const totalSeconds = legs.reduce((sum, leg) => sum + leg.durationSeconds, 0);

  return (
    <ScrollView
      style={{ backgroundColor: dark ? '#0b1220' : '#f1f5f9' }}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.stubNote, { color: dark ? '#f59e0b' : '#b45309' }]}>
        Autonomous mode is a plumbing stub -- no GPS/LIDAR yet. See
        control/navigator.ts for details; this open-loop path will drift.
      </Text>

      <WaypointGridCanvas
        waypoints={activePath}
        onAddWaypoint={addWaypoint}
        onMoveWaypoint={moveWaypoint}
        onDeleteWaypoint={deleteWaypoint}
      />

      <View style={styles.summaryRow}>
        <Text style={[styles.summaryText, { color: dark ? '#94a3b8' : '#475569' }]}>
          {activePath.length} waypoint{activePath.length === 1 ? '' : 's'} · {legs.length} leg
          {legs.length === 1 ? '' : 's'} · ~{totalSeconds.toFixed(1)}s total
        </Text>
        {activePath.length > 0 && (
          <Pressable onPress={clearPath}>
            <Text style={styles.clearLink}>Clear</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.listBlock}>
        {activePath.map((wp, index) => (
          <View key={wp.id} style={[styles.listRow, { borderColor: dark ? '#334155' : '#cbd5e1' }]}>
            <Text style={[styles.listIndex, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
              {index + 1}
            </Text>
            <Text style={[styles.listCoords, { color: dark ? '#94a3b8' : '#475569' }]}>
              ({wp.x.toFixed(2)}, {wp.y.toFixed(2)})
            </Text>
            <View style={styles.listControls}>
              <Pressable onPress={() => reorder(index, -1)} disabled={index === 0}>
                <Text style={[styles.listButton, index === 0 && styles.listButtonDisabled]}>▲</Text>
              </Pressable>
              <Pressable onPress={() => reorder(index, 1)} disabled={index === activePath.length - 1}>
                <Text
                  style={[
                    styles.listButton,
                    index === activePath.length - 1 && styles.listButtonDisabled,
                  ]}
                >
                  ▼
                </Text>
              </Pressable>
              <Pressable onPress={() => deleteWaypoint(wp.id)}>
                <Text style={[styles.listButton, styles.deleteButton]}>✕</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.runRow}>
        <Pressable
          style={[styles.runButton, running && styles.buttonDisabled]}
          onPress={handleRunPath}
          disabled={running}
        >
          <Text style={styles.runButtonText}>{running ? 'Running…' : 'Run Path'}</Text>
        </Pressable>
        <Pressable
          style={[styles.stopPathButton, !running && styles.buttonDisabled]}
          onPress={handleStopPath}
          disabled={!running}
        >
          <Text style={styles.runButtonText}>Stop Path</Text>
        </Pressable>
      </View>

      <View style={styles.saveBlock}>
        <Text style={[styles.sectionTitle, { color: dark ? '#e2e8f0' : '#1e293b' }]}>
          Save / Load
        </Text>
        <View style={styles.saveRow}>
          <TextInput
            style={[
              styles.nameInput,
              { color: dark ? '#e2e8f0' : '#1e293b', borderColor: dark ? '#334155' : '#94a3b8' },
            ]}
            value={pathName}
            onChangeText={setPathName}
            placeholder="Path name"
            placeholderTextColor="#64748b"
          />
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.runButtonText}>Save</Text>
          </Pressable>
        </View>
        {savedPaths.map(p => (
          <View key={p.name} style={[styles.listRow, { borderColor: dark ? '#334155' : '#cbd5e1' }]}>
            <Text style={[styles.listCoords, { color: dark ? '#e2e8f0' : '#1e293b', flex: 1 }]}>
              {p.name} ({p.waypoints.length} pts)
            </Text>
            <Pressable onPress={() => loadPath(p.name)}>
              <Text style={styles.listButton}>Load</Text>
            </Pressable>
            <Pressable onPress={() => deletePath(p.name)}>
              <Text style={[styles.listButton, styles.deleteButton]}>Delete</Text>
            </Pressable>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  stubNote: { fontSize: 12, marginBottom: 12, fontStyle: 'italic' },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  summaryText: { fontSize: 12 },
  clearLink: { color: '#ef4444', fontSize: 12, fontWeight: '600' },
  listBlock: { marginTop: 12 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  listIndex: { fontWeight: '700', width: 24 },
  listCoords: { fontSize: 13, flex: 1 },
  listControls: { flexDirection: 'row', gap: 14 },
  listButton: { color: '#38bdf8', fontWeight: '600', fontSize: 13 },
  listButtonDisabled: { opacity: 0.3 },
  deleteButton: { color: '#ef4444' },
  runRow: { flexDirection: 'row', gap: 12, marginTop: 20 },
  runButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  stopPathButton: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.4 },
  runButtonText: { color: '#fff', fontWeight: '700' },
  saveBlock: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  saveRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  nameInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  saveButton: {
    backgroundColor: '#0284c7',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
});
