/**
 * AppNavigator - Bottom tabs (Home / Progress / Settings) inside a native stack
 */
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography } from '../theme/theme';
import { isOnboarded } from '../data/userStorage';

// Screens
import HomeScreen from '../screens/HomeScreen';
import PoseScreen from '../screens/PoseScreen';
import PoseCorrectorScreen from '../screens/PoseCorrectorScreen';
import ProfileSetupScreen from '../screens/ProfileSetupScreen';
import PoseDetailScreen from '../screens/PoseDetailScreen';
import CustomSetScreen from '../screens/CustomSetScreen';
import SuryaNamaskarScreen from '../screens/SuryaNamaskarScreen';
import HealthScanScreen from '../screens/HealthScanScreen';
import PracticeSessionScreen from '../screens/PracticeSessionScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const defaultScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: { ...typography.headerSmall, color: colors.primary },
  headerShadowVisible: false,
  animation: 'slide_from_right',
};

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: {
        backgroundColor: colors.card,
        borderTopColor: colors.borderLight,
        height: 58,
        paddingBottom: 6,
        paddingTop: 6,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="History"
      component={HistoryScreen}
      options={{
        title: 'Progress',
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={21} color={color} />
        ),
      }}
    />
    <Tab.Screen
      name="Settings"
      component={SettingsScreen}
      options={{
        tabBarIcon: ({ focused, color }) => (
          <Ionicons name={focused ? 'settings' : 'settings-outline'} size={21} color={color} />
        ),
      }}
    />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    isOnboarded().then(done => {
      setShowOnboarding(!done);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      initialRouteName={showOnboarding ? 'ProfileSetup' : 'MainTabs'}
      screenOptions={defaultScreenOptions}
    >
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="PoseScreen"
        component={PoseScreen}
        options={{ title: 'Yoga Poses', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="PoseDetail"
        component={PoseDetailScreen}
        options={{ title: 'Pose Guide', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="PoseCorrector"
        component={PoseCorrectorScreen}
        options={{ title: 'Pose Corrector', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="CustomSet"
        component={CustomSetScreen}
        options={{ title: 'Custom Sets', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="SuryaNamaskar"
        component={SuryaNamaskarScreen}
        options={{ title: 'Surya Namaskar', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="HealthScan"
        component={HealthScanScreen}
        options={{ title: 'Health Scanner', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="PracticeSession"
        component={PracticeSessionScreen}
        options={{ title: 'Practice', headerBackTitle: 'Back' }}
      />
    </Stack.Navigator>
  );
};

export default AppNavigator;
