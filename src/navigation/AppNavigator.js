/**
 * AppNavigator - Navigation with all routes including new screens
 */
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator();

const defaultScreenOptions = {
  headerStyle: { backgroundColor: colors.background },
  headerTintColor: colors.primary,
  headerTitleStyle: { ...typography.headerSmall, color: colors.primary },
  headerShadowVisible: false,
  animation: 'slide_from_right',
};

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
      initialRouteName={showOnboarding ? 'ProfileSetup' : 'Home'}
      screenOptions={defaultScreenOptions}
    >
      <Stack.Screen
        name="ProfileSetup"
        component={ProfileSetupScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Home"
        component={HomeScreen}
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
    </Stack.Navigator>
  );
};

export default AppNavigator;
