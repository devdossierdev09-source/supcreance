// Calendrier Europe/Zurich et simulation d'encaissement. Module pur (aucune dépendance),
// copié à l'identique dans creances-mobile/lib/swiss-time.ts — garder les deux synchronisés.

export const ZURICH = 'Europe/Zurich';
export const REMINDER_SLOTS = [9, 17] as const;
export type ReminderSlot = (typeof REMINDER_SLOTS)[number];

const fmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZURICH,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export type WallParts = { y: number; m: number; d: number; h: number; mi: number; s: number };

export function zurichParts(ms: number): WallParts {
  const p: Record<string, number> = {};
  for (const x of fmt.formatToParts(new Date(ms))) if (x.type !== 'literal') p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour === 24 ? 0 : p.hour, mi: p.minute, s: p.second };
}

const pad = (n: number) => String(n).padStart(2, '0');
export function zurichDateKey(ms: number): string {
  const p = zurichParts(ms);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

function offsetMs(ms: number): number {
  const p = zurichParts(ms);
  const wall = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return wall - Math.floor(ms / 1000) * 1000;
}

/** Instant UTC correspondant à une heure murale de Zurich (heures 00:00, 09:00, 17:00 : jamais ambiguës). */
export function zurichWallToUtc(y: number, m: number, d: number, h = 0, mi = 0): number {
  const guess = Date.UTC(y, m - 1, d, h, mi);
  let t = guess - offsetMs(guess);
  t = guess - offsetMs(t);
  return t;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d };
}

export function addDays(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Début (minuit suisse) et fin (minuit suivant) d'une journée ; durée réelle 23 h / 24 h / 25 h. */
export function zurichDayBounds(key: string): { start: number; end: number; length: number } {
  const a = parseKey(key);
  const b = parseKey(addDays(key, 1));
  const start = zurichWallToUtc(a.y, a.m, a.d);
  const end = zurichWallToUtc(b.y, b.m, b.d);
  return { start, end, length: end - start };
}

/**
 * Montant hypothétique en millièmes de centime : objectif × (écoulé depuis minuit suisse / durée réelle du jour),
 * plafonné à l'objectif. Objectif nul ou invalide → 0. N'est jamais un encaissement réel.
 */
export function simulatedMilli(targetCentimes: string, nowMs: number, dayKey: string): bigint {
  let target: bigint;
  try {
    target = BigInt(targetCentimes);
  } catch {
    return 0n;
  }
  if (target <= 0n) return 0n;
  const { start, length } = zurichDayBounds(dayKey);
  const elapsed = Math.min(Math.max(nowMs - start, 0), length);
  const v = (target * 1000n * BigInt(Math.floor(elapsed))) / BigInt(length);
  const cap = target * 1000n;
  return v > cap ? cap : v;
}

export function dayFraction(nowMs: number, dayKey: string): number {
  const { start, length } = zurichDayBounds(dayKey);
  return Math.min(Math.max((nowMs - start) / length, 0), 1);
}

export type SlotOccurrence = { date: string; slot: ReminderSlot; at: number };

export function slotInstant(date: string, slot: ReminderSlot): number {
  const { y, m, d } = parseKey(date);
  return zurichWallToUtc(y, m, d, slot, 0);
}

/** Prochaines occurrences strictement futures de 09:00 et 17:00 (Zurich) sur `days` jours civils. */
export function upcomingSlots(nowMs: number, days = 30): SlotOccurrence[] {
  const today = zurichDateKey(nowMs);
  const out: SlotOccurrence[] = [];
  for (let i = 0; i <= days; i++) {
    const date = addDays(today, i);
    for (const slot of REMINDER_SLOTS) {
      const at = slotInstant(date, slot);
      if (at > nowMs) out.push({ date, slot, at });
    }
  }
  return out.slice(0, days * REMINDER_SLOTS.length);
}

/**
 * Créneaux franchis entre deux ticks (prev < at <= now), en ignorant ceux plus vieux que `graceMs`
 * (veille, onglet gelé) : un créneau manqué n'est jamais rejoué.
 */
export function crossedSlots(prevMs: number, nowMs: number, graceMs = 5 * 60_000): SlotOccurrence[] {
  if (nowMs <= prevMs) return [];
  const out: SlotOccurrence[] = [];
  const from = zurichDateKey(prevMs);
  for (let i = 0; i <= 1; i++) {
    const date = addDays(from, i);
    for (const slot of REMINDER_SLOTS) {
      const at = slotInstant(date, slot);
      if (at > prevMs && at <= nowMs && nowMs - at <= graceMs) out.push({ date, slot, at });
    }
  }
  return out;
}

export function formatMilliChf(milli: bigint): { main: string; sub: string } {
  const c = milli / 1000n;
  const int = (c / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return { main: `${int}.${(c % 100n).toString().padStart(2, '0')}`, sub: (milli % 1000n).toString().padStart(3, '0') };
}
