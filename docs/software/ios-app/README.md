# iOS app setup

The app is a standard React Native CLI project (TypeScript, iOS only --
Android scaffolding was intentionally removed). For React Native
boilerplate (Metro, Fast Refresh, troubleshooting), see
[`app/README.md`](../../../app/README.md).

## Prerequisites (do this once)

1. Install Xcode from the Mac App Store, then open it once to accept the
   license and let it install additional components.
2. Install the Command Line Tools: `xcode-select --install`
3. Install CocoaPods: `sudo gem install cocoapods` (or `brew install cocoapods`)
4. Node.js 22+ and npm (already required to have gotten this far).

## Install & run

```bash
cd app
npm install            # already done if you're reading this after the initial build
cd ios && pod install && cd ..
npm run ios             # boots the iOS Simulator and builds/runs the app
```

To run on a physical iPhone: open `ios/app.xcworkspace` in Xcode, select
your device as the run target, and press Run. A physical device is
strongly recommended for testing the joystick/tank-slider gesture feel --
the Simulator's mouse-based touch emulation doesn't fully match real touch
input.

## Where things live

```
app/src/
  screens/        ConnectScreen, DriveScreen, PathPlanScreen, SettingsScreen
  navigation/      AppNavigator.tsx (React Navigation native-stack)
  networking/      BoatConnection.ts -- WebSocket client, reconnect/backoff, 150ms heartbeat
  control/         driveMixing.ts (joystick/tank -> PWM math), navigator.ts (dead-reckoning stub)
  state/           useBoatStore.ts -- Zustand store, persisted via AsyncStorage
  components/      Joystick, TankSliders, MotorBar, DebugConsole, StopButton, WaypointGridCanvas
  types/           messages.ts (WS protocol, kept in sync with pi-bridge/bridge.py), path.ts
```

State management: **Zustand** (chosen over plain Context) -- less
boilerplate for persistence via its middleware, and avoids re-rendering the
whole component tree on every ~150ms telemetry/heartbeat tick the way a
naive single Context value would.
