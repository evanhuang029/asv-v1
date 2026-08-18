import React, { useRef, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface DebugConsoleProps {
  /** Already capped to the last ~200 lines by useBoatStore. */
  logs: string[];
}

const COLLAPSED_HEIGHT = 90;
const EXPANDED_HEIGHT = 260;

/** Scrollable, monospace, auto-scrolling log panel for raw ESP32 serial
 * lines and bridge status forwarded from the Pi. Rendering is a plain
 * ScrollView of Text lines (already capped upstream), which is cheap enough
 * at this volume not to need a virtualized list. */
export default function DebugConsole({ logs }: DebugConsoleProps) {
  const [expanded, setExpanded] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.header}
        onPress={() => {
          LayoutAnimation.easeInEaseOut();
          setExpanded(e => !e);
        }}
      >
        <Text style={styles.headerText}>Debug Console ({logs.length})</Text>
        <Text style={styles.headerText}>{expanded ? '▼ collapse' : '▲ expand'}</Text>
      </Pressable>
      <ScrollView
        ref={scrollRef}
        style={{ height: expanded ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No log lines yet.</Text>
        ) : (
          logs.map((line, i) => (
            <Text key={i} style={styles.line}>
              {line}
            </Text>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 10, overflow: 'hidden', marginTop: 10, backgroundColor: '#0f172a' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1e293b',
  },
  headerText: { color: '#e2e8f0', fontSize: 12, fontWeight: '600' },
  line: {
    color: '#4ade80',
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 11,
    paddingHorizontal: 10,
    paddingVertical: 1,
  },
  emptyText: { color: '#64748b', fontSize: 12, padding: 10, fontStyle: 'italic' },
});
