import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import type { OnboardingStackParamList } from './types';
import { SplashScreen } from '@/screens/onboarding/SplashScreen';
import { LoginScreen } from '@/screens/onboarding/LoginScreen';
import { SignupPhoneScreen } from '@/screens/onboarding/SignupPhoneScreen';
import { SignupOtpScreen } from '@/screens/onboarding/SignupOtpScreen';
import { SignupNameScreen } from '@/screens/onboarding/SignupNameScreen';
import { SignupDobScreen } from '@/screens/onboarding/SignupDobScreen';
import { SignupGenderScreen } from '@/screens/onboarding/SignupGenderScreen';
import { SignupPhotoScreen } from '@/screens/onboarding/SignupPhotoScreen';
import { InterestsScreen } from '@/screens/onboarding/InterestsScreen';
import { ContactsSyncScreen } from '@/screens/onboarding/ContactsSyncScreen';
import { PeopleToFollowScreen } from '@/screens/onboarding/PeopleToFollowScreen';
import { NeighbourhoodScreen } from '@/screens/onboarding/NeighbourhoodScreen';
import { TermsScreen } from '@/screens/settings/TermsScreen';
import { PrivacyPolicyScreen } from '@/screens/settings/PrivacyPolicyScreen';
import { SettingsPrivacyScreen } from '@/screens/settings/SettingsPrivacyScreen';

import { OnboardingDraftProvider } from '@/state/OnboardingDraftContext';
import { STACK_SCREEN_OPTIONS } from './transitions';
const Stack = createStackNavigator<OnboardingStackParamList>();

export function OnboardingNavigator() {
  return (
    <OnboardingDraftProvider>
    <Stack.Navigator screenOptions={STACK_SCREEN_OPTIONS} initialRouteName="Splash">
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignupPhone" component={SignupPhoneScreen} />
      <Stack.Screen name="SignupOtp" component={SignupOtpScreen} />
      <Stack.Screen name="SignupName" component={SignupNameScreen} />
      <Stack.Screen name="SignupDob" component={SignupDobScreen} />
      <Stack.Screen name="SignupGender" component={SignupGenderScreen} />
      <Stack.Screen name="SignupPhoto" component={SignupPhotoScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="ContactsSync" component={ContactsSyncScreen} />
      <Stack.Screen name="PeopleToFollow" component={PeopleToFollowScreen} />
      <Stack.Screen name="Neighbourhood" component={NeighbourhoodScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="SettingsPrivacy" component={SettingsPrivacyScreen} />
    </Stack.Navigator>
    </OnboardingDraftProvider>
  );
}
