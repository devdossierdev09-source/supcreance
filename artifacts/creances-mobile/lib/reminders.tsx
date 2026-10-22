import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getReminders } from '@workspace/api-client-react';
import { cancelReminders, getPermission, notificationsSupported, requestPermission, scheduleReminders, type NotifPermission } from '@/lib/notifications';

// Réglage propre à l'appareil (pas une donnée métier) : AsyncStorage, désactivé par défaut.
const KEY = 'creances.reminders.v1';
const RENEW_BELOW_MS = 25 * 86_400_000;

type Stored = { enabled: boolean; horizon: number | null; renewedAt: number | null };
type Ctx = Stored & {
  ready: boolean;
  supported: boolean;
  permission: NotifPermission;
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
  renew: () => Promise<void>;
};

const OFF: Stored = { enabled: false, horizon: null, renewedAt: null };
const ReminderCtx = createContext<Ctx | null>(null);

export function useReminders(): Ctx {
  const c = useContext(ReminderCtx);
  if (!c) throw new Error('ReminderProvider manquant');
  return c;
}

async function nothingDueToday(): Promise<boolean> {
  try {
    const r = await getReminders({});
    return BigInt(r.restantCentimes) <= 0n;
  } catch {
    return false;
  }
}

export function ReminderProvider({ children }: { children: ReactNode }) {
  const [st, setSt] = useState<Stored>(OFF);
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<NotifPermission>(notificationsSupported ? 'undetermined' : 'unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stRef = useRef(st);
  stRef.current = st;
  // File unique : activation, désactivation et renouvellement ne se chevauchent jamais.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const serial = useCallback((fn: () => Promise<void>) => {
    const next = queue.current.then(fn, fn);
    queue.current = next.catch(() => undefined);
    return next;
  }, []);

  /** Enregistre d'abord ; l'état affiché ne change qu'après un enregistrement durable réussi. */
  const save = useCallback(async (next: Stored) => {
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error('storage');
    }
    stRef.current = next;
    setSt(next);
  }, []);

  const schedule = useCallback(async () => {
    const horizon = await scheduleReminders(await nothingDueToday());
    try {
      await save({ enabled: true, horizon, renewedAt: Date.now() });
    } catch (e) {
      await cancelReminders().catch(() => undefined);
      throw e;
    }
  }, [save]);

  const failMsg = (e: unknown, fallback: string) =>
    e instanceof Error && e.message === 'storage' ? 'Réglage non enregistré sur l’appareil (stockage indisponible). Réessayez.' : fallback;

  const renewIfNeeded = useCallback(
    (force: boolean) =>
      serial(async () => {
        if (!stRef.current.enabled || !notificationsSupported) return;
        try {
          const p = await getPermission();
          setPermission(p);
          if (p !== 'granted') return;
          const h = stRef.current.horizon;
          if (force || !h || h - Date.now() < RENEW_BELOW_MS) await schedule();
        } catch (e) {
          setError(failMsg(e, 'Impossible de reprogrammer les rappels.'));
        }
      }),
    [serial, schedule],
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw && alive) {
          const v = JSON.parse(raw) as Stored;
          stRef.current = v;
          setSt(v);
        }
        if (notificationsSupported) setPermission(await getPermission());
      } catch {
        if (alive) setError('Lecture du réglage impossible : rappels considérés comme désactivés.');
      } finally {
        if (alive) setReady(true);
      }
      // À chaque ouverture : rafraîchit la planification (tient compte du solde du jour).
      if (alive) await renewIfNeeded(true);
    })();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void renewIfNeeded(true);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [renewIfNeeded]);

  const enable = useCallback(
    () =>
      serial(async () => {
        if (!notificationsSupported) return;
        setBusy(true);
        setError(null);
        try {
          let p = await getPermission();
          if (p !== 'granted') p = await requestPermission();
          setPermission(p);
          if (p !== 'granted') return;
          await schedule();
        } catch (e) {
          setError(failMsg(e, 'Impossible de programmer les rappels sur cet appareil.'));
        } finally {
          setBusy(false);
        }
      }),
    [serial, schedule],
  );

  const disable = useCallback(
    () =>
      serial(async () => {
        setBusy(true);
        setError(null);
        try {
          await cancelReminders();
        } catch {
          // Reste activé : l'utilisateur peut réessayer.
          setError('Annulation des rappels impossible : ils restent programmés. Réessayez.');
          setBusy(false);
          return;
        }
        try {
          await save(OFF);
        } catch (e) {
          setError(failMsg(e, 'Désactivation non enregistrée.'));
        } finally {
          setBusy(false);
        }
      }),
    [serial, save],
  );

  const renew = useCallback(() => renewIfNeeded(true), [renewIfNeeded]);

  return (
    <ReminderCtx.Provider value={{ ...st, ready, supported: notificationsSupported, permission, busy, error, enable, disable, renew }}>
      {children}
    </ReminderCtx.Provider>
  );
}
