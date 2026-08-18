import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SavedPath, Waypoint } from '../types/path';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failsafe';

export interface Settings {
  ip: string;
  port: number;
  pwmMin: number;
  pwmNeutral: number;
  pwmMax: number;
  invertLeft: boolean;
  invertRight: boolean;
  /** Relative grid units per second, used to convert Path Planning waypoint
   * distances into leg durations for the dead-reckoning executor. */
  unitsPerSecond: number;
}

export const DEFAULT_SETTINGS: Settings = {
  ip: '192.168.4.1',
  port: 8765,
  pwmMin: 1000,
  pwmNeutral: 1500,
  pwmMax: 2000,
  invertLeft: false,
  invertRight: false,
  unitsPerSecond: 1,
};

export interface Telemetry {
  leftPwm: number;
  rightPwm: number;
  // TODO: replace with real telemetry once a voltage/current sensor is wired
  // to the Pi/ESP32 and included in the serial or WS protocol. Until then
  // this is a static mock so the UI slot exists and can be wired up later
  // without further screen changes.
  batteryVoltage: number | null;
  batteryCurrent: number | null;
}

const MOCK_TELEMETRY: Telemetry = {
  leftPwm: DEFAULT_SETTINGS.pwmNeutral,
  rightPwm: DEFAULT_SETTINGS.pwmNeutral,
  batteryVoltage: 12.4,
  batteryCurrent: null,
};

const MAX_LOG_LINES = 200;

interface BoatState {
  connectionStatus: ConnectionStatus;
  boatId: string | null;
  logs: string[];
  telemetry: Telemetry;
  /** 0-10 link-quality reading from BoatConnection's ping/pong RTT --
   * not real WiFi RSSI, see SignalBars.tsx. */
  signalBars: number;
  settings: Settings;
  savedPaths: SavedPath[];
  activePath: Waypoint[];

  setConnectionStatus: (status: ConnectionStatus) => void;
  setBoatId: (boatId: string | null) => void;
  setSignalBars: (bars: number) => void;
  addLog: (line: string) => void;
  clearLogs: () => void;
  setMotorPwm: (leftPwm: number, rightPwm: number) => void;
  updateSettings: (partial: Partial<Settings>) => void;
  resetSettingsToDefaults: () => void;
  setInvertLeft: (value: boolean) => void;
  setInvertRight: (value: boolean) => void;

  setActivePath: (waypoints: Waypoint[]) => void;
  savePath: (name: string) => void;
  loadPath: (name: string) => void;
  deletePath: (name: string) => void;
}

export const useBoatStore = create<BoatState>()(
  persist(
    (set, get) => ({
      connectionStatus: 'disconnected',
      boatId: null,
      logs: [],
      telemetry: MOCK_TELEMETRY,
      signalBars: 0,
      settings: DEFAULT_SETTINGS,
      savedPaths: [],
      activePath: [],

      setConnectionStatus: status => set({ connectionStatus: status }),
      setBoatId: boatId => set({ boatId }),
      setSignalBars: bars => set({ signalBars: bars }),

      addLog: line =>
        set(state => {
          const next = [...state.logs, line];
          if (next.length > MAX_LOG_LINES) {
            next.splice(0, next.length - MAX_LOG_LINES);
          }
          return { logs: next };
        }),
      clearLogs: () => set({ logs: [] }),

      setMotorPwm: (leftPwm, rightPwm) =>
        set(state => ({ telemetry: { ...state.telemetry, leftPwm, rightPwm } })),

      updateSettings: partial =>
        set(state => ({ settings: { ...state.settings, ...partial } })),
      resetSettingsToDefaults: () => set({ settings: DEFAULT_SETTINGS }),
      setInvertLeft: value =>
        set(state => ({ settings: { ...state.settings, invertLeft: value } })),
      setInvertRight: value =>
        set(state => ({ settings: { ...state.settings, invertRight: value } })),

      setActivePath: waypoints => set({ activePath: waypoints }),
      savePath: name => {
        const { activePath, savedPaths } = get();
        const withoutExisting = savedPaths.filter(p => p.name !== name);
        const saved: SavedPath = { name, waypoints: activePath, savedAt: Date.now() };
        set({ savedPaths: [...withoutExisting, saved] });
      },
      loadPath: name => {
        const found = get().savedPaths.find(p => p.name === name);
        if (found) set({ activePath: found.waypoints });
      },
      deletePath: name =>
        set(state => ({ savedPaths: state.savedPaths.filter(p => p.name !== name) })),
    }),
    {
      name: 'trashboat-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist settings and saved paths -- connection status, live
      // telemetry, and the in-progress activePath edit buffer should not
      // survive a fresh app launch.
      partialize: state => ({
        settings: state.settings,
        savedPaths: state.savedPaths,
      }),
    },
  ),
);
