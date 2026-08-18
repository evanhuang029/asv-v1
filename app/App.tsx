/**
 * Trashboat control app.
 * @format
 */

import React, { useEffect } from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppNavigator from './src/navigation/AppNavigator';
import { boatConnection } from './src/networking/BoatConnection';
import { useBoatStore } from './src/state/useBoatStore';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const setConnectionStatus = useBoatStore(s => s.setConnectionStatus);
  const setBoatId = useBoatStore(s => s.setBoatId);
  const addLog = useBoatStore(s => s.addLog);
  const setSignalBars = useBoatStore(s => s.setSignalBars);

  useEffect(() => {
    // Wire the single shared BoatConnection instance to the store once for
    // the whole app lifetime -- Connect/Drive/PathPlan screens all read
    // connection status, boatId, and logs from the store rather than each
    // owning their own subscription.
    boatConnection.setHandlers({
      onStatusChange: setConnectionStatus,
      onBoatId: setBoatId,
      onLog: addLog,
      onFailsafe: () => addLog('[app] failsafe_tripped received from bridge'),
      onSignal: setSignalBars,
    });
  }, [setConnectionStatus, setBoatId, addLog, setSignalBars]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </SafeAreaProvider>
  );
}

export default App;
