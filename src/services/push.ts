/**
 * Push-notification setup + token registration — Wave 3 (Expo Push).
 *
 * The backend delivers PUSH via the Expo Push Service (push-sender / chat-push
 * POST to https://exp.host/--/api/v2/push/send), so the device must register an
 * **Expo push token** (`ExponentPushToken[…]`) — NOT a raw APNs/FCM device token.
 * We therefore call `getExpoPushTokenAsync({ projectId })`, passing the EAS
 * project id from app.json (`extra.eas.projectId`).
 *
 * Everything is presence-guarded: the native modules are checked via
 * expo-modules-core's `requireOptionalNativeModule` (returns null instead of
 * throwing) BEFORE expo-device / expo-notifications are imported, so a dev client
 * whose binary lacks them — or a simulator (no APNs/FCM) — no-ops silently with
 * no red-box (mirrors client.ts's AsyncStorage native-module guard).
 *
 * NOTE: untestable on the iOS simulator (native modules absent → skipped). Real
 * registration needs a physical device + a build that includes expo-notifications
 * (`npx expo run:ios` / `run:android`, or an EAS dev/preview build).
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { registerPushToken } from '@/api/notifications';

let attempted = false;
let handlerConfigured = false;

/** EAS project id (app.json → extra.eas.projectId); required for Expo tokens. */
function resolveProjectId(): string | null {
  const cfg = Constants as unknown as {
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    easConfig?: { projectId?: string };
  };
  return cfg.expoConfig?.extra?.eas?.projectId ?? cfg.easConfig?.projectId ?? null;
}

/** True only when expo-device + expo-notifications native modules are in the binary. */
function hasNativePush(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const core = require('expo-modules-core');
    return (
      typeof core.requireOptionalNativeModule === 'function' &&
      !!core.requireOptionalNativeModule('ExpoDevice') &&
      !!core.requireOptionalNativeModule('ExpoPushTokenManager')
    );
  } catch {
    return false;
  }
}

/**
 * Foreground display behaviour + Android channel. Called once at app startup.
 * Without a handler, notifications received while the app is foregrounded are
 * silently swallowed; on Android, a channel is required to surface heads-up
 * notifications at all. Guarded so it no-ops where the native module is absent.
 */
export async function configurePushHandler(): Promise<void> {
  if (handlerConfigured) return;
  handlerConfigured = true;
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    if (!hasNativePush()) return;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#F0492D',
      });
    }
  } catch (e) {
    console.warn('[push] handler config skipped:', (e as Error)?.message ?? String(e));
  }
}

export interface PushDebugInfo {
  supported: boolean;        // native modules present in this binary
  isDevice: boolean;
  permission: string;        // 'granted' | 'denied' | 'undetermined' | 'n/a'
  projectId: string | null;
  token: string | null;      // ExponentPushToken[…]
  error?: string;
}

/**
 * Resolve the device's Expo push token, requesting permission if needed.
 * Shared by registration and the debug screen. Returns a structured result
 * rather than throwing so callers can render the failure mode.
 */
async function resolveExpoPushToken(requestPermission: boolean): Promise<PushDebugInfo> {
  const info: PushDebugInfo = {
    supported: false,
    isDevice: false,
    permission: 'n/a',
    projectId: resolveProjectId(),
    token: null,
  };
  try {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
      info.error = 'unsupported platform';
      return info;
    }
    if (!hasNativePush()) {
      info.error = 'native push modules not in this build — rebuild on a device';
      return info;
    }
    info.supported = true;

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Device = require('expo-device');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Notifications = require('expo-notifications');

    info.isDevice = !!Device?.isDevice;
    if (!info.isDevice) {
      info.error = 'not a physical device — push tokens need real hardware';
      return info;
    }

    const existing = await Notifications.getPermissionsAsync();
    let status = existing.status;
    if (status !== 'granted' && requestPermission) {
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    info.permission = status;
    if (status !== 'granted') {
      info.error = 'notification permission not granted';
      return info;
    }

    if (!info.projectId) {
      info.error = 'missing EAS projectId (app.json → extra.eas.projectId)';
      return info;
    }

    const resp = await Notifications.getExpoPushTokenAsync({ projectId: info.projectId });
    const token: unknown = resp?.data;
    if (typeof token === 'string' && token.length > 0) info.token = token;
    else info.error = 'no token returned';
    return info;
  } catch (e) {
    info.error = (e as Error)?.message ?? String(e);
    return info;
  }
}

/** Request permission, fetch the Expo token, and register it with the backend. */
export async function registerForPushNotificationsAsync(): Promise<void> {
  if (attempted) return; // once per app session; reset on sign-out
  attempted = true;
  const info = await resolveExpoPushToken(true);
  if (info.token && (Platform.OS === 'ios' || Platform.OS === 'android')) {
    try {
      await registerPushToken(info.token, Platform.OS);
      console.log('[push] expo push token registered');
    } catch (e) {
      console.warn('[push] token registration failed:', (e as Error)?.message ?? String(e));
    }
  } else {
    console.log('[push] registration skipped:', info.error ?? 'no token');
  }
}

/** Read the current Expo push token + diagnostics, without writing to the backend. */
export function getPushDebugInfo(): Promise<PushDebugInfo> {
  return resolveExpoPushToken(true);
}

/** Allow a re-attempt after sign-out → sign-in. */
export function resetPushRegistration(): void {
  attempted = false;
}
