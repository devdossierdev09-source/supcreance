// Rappels LOCAUX Android/iOS (expo-notifications). Aucune notification distante (push) n'est utilisée.
// Import only local APIs: SDK 57's root barrel also loads the remote topic
// module, which is absent from Expo Go Android and crashes during startup.
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationChannelAsync } from 'expo-notifications/build/setNotificationChannelAsync';
import { getAllScheduledNotificationsAsync } from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import { cancelScheduledNotificationAsync } from 'expo-notifications/build/cancelScheduledNotificationAsync';
import { scheduleNotificationAsync } from 'expo-notifications/build/scheduleNotificationAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { upcomingSlots, zurichDateKey } from '@/lib/swiss-time';

export type NotifPermission = 'unsupported' | 'undetermined' | 'granted' | 'denied';
export const notificationsSupported = true;
export const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
/** Son personnalisé uniquement dans l'application compilée ; Expo Go utilise le son standard. */
export const usesCustomSound = !isExpoGo;

const KIND = 'creances-relance';
const CHANNEL = isExpoGo ? 'relances-standard' : 'relances-collection';

setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function getPermission(): Promise<NotifPermission> {
  const p = await getPermissionsAsync();
  return p.granted ? 'granted' : p.status === 'denied' ? 'denied' : 'undetermined';
}

export async function requestPermission(): Promise<NotifPermission> {
  // Android 13+ : le canal doit exister avant la demande pour que le système affiche l'invite.
  await ensureChannel();
  const p = await requestPermissionsAsync();
  return p.granted ? 'granted' : 'denied';
}

async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  await setNotificationChannelAsync(CHANNEL, {
    name: 'Rappels de relance',
    importance: AndroidImportance.HIGH,
    sound: usesCustomSound ? 'collection.wav' : 'default',
  });
}

export async function cancelReminders(): Promise<void> {
  const all = await getAllScheduledNotificationsAsync();
  await Promise.all(
    all.filter((n) => n.content.data?.kind === KIND).map((n) => cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Remplace les rappels par des déclencheurs ponctuels (dates UTC) pour 09:00 et 17:00 Zurich
 * sur ~30 jours (changements d'heure inclus). `skipToday` : rien n'est dû aujourd'hui.
 * Retourne l'instant du dernier rappel programmé (horizon), ou null.
 */
export async function scheduleReminders(skipToday: boolean, days = 30): Promise<number | null> {
  await ensureChannel();
  await cancelReminders();
  const now = Date.now();
  const today = zurichDateKey(now);
  const slots = upcomingSlots(now, days).filter((s) => !(skipToday && s.date === today));
  try {
    for (const s of slots) {
    await scheduleNotificationAsync({
      content: {
        title: 'Créances · CHF',
        body: `Rappel de ${s.slot === 9 ? '09:00' : '17:00'} : ouvrez l’application pour consulter les relances du jour.`,
        sound: usesCustomSound ? 'collection.wav' : true,
        data: { kind: KIND, date: s.date, slot: s.slot },
      },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: new Date(s.at), channelId: CHANNEL },
    });
    }
  } catch (error) {
    try {
      await cancelReminders();
    } catch {
      throw new Error('Programmation partielle : désactivez les notifications dans les réglages du téléphone puis réessayez.');
    }
    throw error;
  }
  return slots.length ? slots[slots.length - 1].at : null;
}
