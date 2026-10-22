import { createContext, useContext, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SessionInfo } from '@workspace/api-client-react';

/**
 * Jeton de session signé.
 * - Natif : expo-secure-store (Keystore Android). Jamais AsyncStorage.
 * - Web (aperçu) : mémoire uniquement — perdu au rechargement, volontairement.
 * Toute erreur de stockage est remontée explicitement (jamais ignorée en silence).
 */
const KEY = 'creances.session.token';
const native = Platform.OS !== 'web';
let memToken: string | null = null;

// ---- Erreur de stockage observable ----
let storageError: string | null = null;
const listeners = new Set<() => void>();
function setStorageError(msg: string | null) {
  storageError = msg;
  listeners.forEach((l) => l());
}
export function useStorageError(): string | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => storageError,
    () => storageError,
  );
}
export const dismissStorageError = () => setStorageError(null);

export const getToken = (): string | null => memToken;

export async function hydrateToken(): Promise<void> {
  if (!native) return;
  try {
    const t = await SecureStore.getItemAsync(KEY);
    memToken = t && t.length > 0 ? t : null;
  } catch {
    memToken = null;
    setStorageError('Le coffre sécurisé de l’appareil est illisible. Reconnectez-vous ; si le problème persiste, effacez les données de l’application.');
  }
}

/** Enregistre le jeton. Lève une erreur si le coffre sécurisé échoue (le jeton n'est alors pas conservé). */
export async function storeToken(token: string): Promise<void> {
  if (native) {
    try {
      await SecureStore.setItemAsync(KEY, token);
    } catch {
      memToken = null;
      throw new Error('SECURE_STORE_WRITE');
    }
  }
  memToken = token;
  setStorageError(null);
}

/**
 * Efface le jeton en mémoire, puis dans le coffre.
 * Si la suppression échoue, écrase la valeur par une chaîne vide (ignorée à la relance)
 * puis vérifie ; en dernier recours, signale explicitement l'échec.
 * Retourne true si le coffre ne contient plus de jeton exploitable.
 */
export async function clearToken(): Promise<boolean> {
  memToken = null;
  if (!native) return true;
  try {
    await SecureStore.deleteItemAsync(KEY);
    return true;
  } catch {
    // repli
  }
  try {
    await SecureStore.setItemAsync(KEY, '');
    const left = await SecureStore.getItemAsync(KEY);
    if (!left) return true;
  } catch {
    // signalé ci-dessous
  }
  setStorageError(
    'Impossible d’effacer le jeton du coffre sécurisé. La session a été révoquée côté serveur, mais un jeton invalide peut subsister sur l’appareil : effacez les données de l’application dans les réglages Android.',
  );
  return false;
}

export const LOGGED_OUT: SessionInfo = { authenticated: false, today: '', inactivityMinutes: 30 };

export const SessionContext = createContext<SessionInfo | null>(null);

export function useSessionInfo(): SessionInfo {
  const s = useContext(SessionContext);
  return s ?? LOGGED_OUT;
}
export const useToday = () => useSessionInfo().today;

// ---- Activité réelle (toucher, saisie), partagée avec les feuilles modales ----
export const ActivityContext = createContext<() => void>(() => undefined);
export const useActivity = () => useContext(ActivityContext);
