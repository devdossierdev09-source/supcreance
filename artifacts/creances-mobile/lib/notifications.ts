// Aperçu web : expo-notifications n'y est pas importé. Les rappels programmés sont réservés à Android/iOS.
export type NotifPermission = 'unsupported' | 'undetermined' | 'granted' | 'denied';
export const notificationsSupported = false;
export const isExpoGo = false;
export const usesCustomSound = false;

export async function getPermission(): Promise<NotifPermission> {
  return 'unsupported';
}
export async function requestPermission(): Promise<NotifPermission> {
  return 'unsupported';
}
export async function cancelReminders(): Promise<void> {}
export async function scheduleReminders(_skipToday: boolean, _days = 30): Promise<number | null> {
  return null;
}
