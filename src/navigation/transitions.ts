import { TransitionPresets, StackNavigationOptions } from '@react-navigation/stack';

export const STACK_SCREEN_OPTIONS: StackNavigationOptions = {
  headerShown: false,
  gestureEnabled: true,
  ...TransitionPresets.SlideFromRightIOS,
  transitionSpec: {
    open: {
      animation: 'spring',
      config: { stiffness: 280, damping: 30, mass: 0.9, overshootClamping: false, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
    },
    close: {
      animation: 'spring',
      config: { stiffness: 280, damping: 30, mass: 0.9, overshootClamping: false, restDisplacementThreshold: 0.01, restSpeedThreshold: 0.01 },
    },
  },
};
