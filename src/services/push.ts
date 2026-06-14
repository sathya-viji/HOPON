/**
 * Push-token registration — Wave 3.
 *
 * Requests notification permission and registers the device's native push token
 * with the backend (`register_push_token`). Fully guarded: the native modules are
 * presence-checked via expo-modules-core's `requireOptionalNativeModule` (which
 * returns null instead of throwing) BEFORE expo-device / expo-notifications are
 * imported, so a dev client whose binary doesn't include them — or a simulator
 * (no APNs/FCM) — no-ops silently with no red-box (mirrors client.ts's
 * AsyncStorage native-module guard).
 *
 * NOTE: untestable on the iOS simulator (native modules absent → skipped). Real
 * registration needs a physical device + a dev-client rebuild that includes
 * expo-notifications (`npx expo run:ios` / `run:android`).
 */
import { Platform } from 'react-native';
import { registerPushToken } from '@/api/notifications';

let attempted = false;

export async function registerForPushNotificationsAsync(): Promise<void> {
  if (attempted) return; // once per app session; reset on sign-out
  attempted = true;
  try {
    const platform = Platform.OS;
    if (platform !== 'ios' && platform !== 'android') return;

    // Presence-check WITHOUT importing the packages (importing them throws + shows
    // a dev red-box when the native module isn't in the binary). expo-modules-core
    // is always present; requireOptionalNativeModule returns null when absent.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core');
    const hasNative =
      typeof core.requireOptionalNativeModule === 'function' &&
      !!core.requireOptionalNativeModule('ExpoDevice') &&
      !!core.requireOptionalNativeModule('ExpoPushTokenManager');
    if (!hasNative) {
      console.log('[push] native push modules not in this build — skipping (rebuild on a device to enable)');
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    if (!Device?.isDevice) {
      console.log('[push] not a physical device — skipping push-token registration');
      return;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[push] notification permission not granted — skipping');
      return;
    }

    const tokenResp = await Notifications.getDevicePushTokenAsync();
    const token: unknown = tokenResp?.data;
    if (typeof token === 'string' && token.length > 0) {
      await registerPushToken(token, platform);
      console.log('[push] device push token registered');
    }
  } catch (e) {
    console.warn('[push] registration skipped:', (e as Error)?.message ?? String(e));
  }
}

/** Allow a re-attempt after sign-out → sign-in. */
export function resetPushRegistration(): void {
  attempted = false;
}
