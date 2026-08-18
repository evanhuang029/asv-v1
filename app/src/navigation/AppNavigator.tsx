import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ConnectScreen from '../screens/ConnectScreen';
import DriveScreen from '../screens/DriveScreen';
import PathPlanScreen from '../screens/PathPlanScreen';
import SettingsScreen from '../screens/SettingsScreen';

export type RootStackParamList = {
  Connect: undefined;
  Drive: undefined;
  PathPlan: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Connect">
        <Stack.Screen
          name="Connect"
          component={ConnectScreen}
          options={{ title: 'Connect to Boat' }}
        />
        <Stack.Screen name="Drive" component={DriveScreen} options={{ title: 'Drive' }} />
        <Stack.Screen
          name="PathPlan"
          component={PathPlanScreen}
          options={{ title: 'Path Planning' }}
        />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
