import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OnboardingScreen, JournalScreen, ResponseScreen } from '../screens';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const ONBOARDING_KEY = '@witnessed/onboarding_complete';

export function RootNavigator() {
  const [isReady, setIsReady] = useState(false);
  const [onboardingComplete, setOnboardingComplete] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then(value => setOnboardingComplete(value === 'true'))
      .catch(() => setOnboardingComplete(false))
      .finally(() => setIsReady(true));
  }, []);

  if (!isReady) {
    return <View style={{ flex: 1, backgroundColor: '#F5F2EE' }} />;
  }

  return (
    <Stack.Navigator
      initialRouteName={onboardingComplete ? 'Journal' : 'Onboarding'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name="Journal"
        component={JournalScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Response"
        component={ResponseScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}
