import type { QueryClient } from '@tanstack/react-query';
import { getGetSessionQueryKey } from '@workspace/api-client-react';
import { z, type ZodTypeAny } from 'zod';

// ---------- Argent : chaînes de centimes entiers, BigInt uniquement pour l'affichage/validation ----------
const MAX_CENTIMES = 99999999999n;

export function formatCentimes(value: string): string {
  let n: bigint;
  try {
    n = BigInt(value);
  } catch {
    return '—';
  }
  const neg = n < 0n;
  if (neg) n = -n;
  const int = (n / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  const frac = (n % 100n).toString().padStart(2, '0');
  return `${neg ? '−' : ''}${int}.${frac}`;
}
export const formatChf = (value: string): string => `${formatCentimes(value)} CHF`;
export const absCentimes = (value: string): string => value.replace('-', '');

export function centimesToRaw(value: string): string {
  let n = BigInt(value);
  if (n < 0n) n = -n;
  return `${n / 100n}.${(n % 100n).toString().padStart(2, '0')}`;
}
const safe = (v: string, f: (n: bigint) => boolean) => {
  try {
    return f(BigInt(v));
  } catch {
    return false;
  }
};
export const isZero = (v: string) => safe(v, (n) => n === 0n);
export const isPositive = (v: string) => safe(v, (n) => n > 0n);

export type ParsedAmount = { ok: true; raw: string; centimes: string } | { ok: false; error: string };

export function parseAmount(input: string): ParsedAmount {
  const grouped = input.trim().replace(/[\s\u00a0\u202f]/g, '');
  const s = grouped.replace(/['’]/g, '');
  if (!s) return { ok: false, error: 'Saisissez un montant.' };
  if (input.length > 80 || !/^(?:\d+|\d{1,3}(?:['’]\d{3})+)(?:[.,]\d{1,2})?$/.test(grouped)) {
    return { ok: false, error: "Montant invalide. Formats : 1234.5, 1234,50, 1'234.50 (2 décimales max.)." };
  }
  const [i, f = ''] = s.split(/[.,]/);
  const frac = f.padEnd(2, '0');
  const c = BigInt(i) * 100n + BigInt(frac);
  if (c <= 0n) return { ok: false, error: 'Le montant doit être strictement positif.' };
  if (c > MAX_CENTIMES) return { ok: false, error: "Maximum autorisé : 999'999'999.99 CHF." };
  return { ok: true, raw: `${BigInt(i)}.${frac}`, centimes: c.toString() };
}

// ---------- Validation ----------
export const nameSchema = z.string().trim().min(1, 'Ce champ est obligatoire.').max(100, '100 caractères au maximum.');
export const amountSchema = z.string().superRefine((v, ctx) => {
  const r = parseAmount(v);
  if (!r.ok) ctx.addIssue({ code: 'custom', message: r.error });
});
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).')
  .refine(
    (v) => !Number.isNaN(Date.parse(v)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v,
    'Date invalide (AAAA-MM-JJ).',
  );
export const noteSchema = z.string().max(2000, '2000 caractères au maximum.');
export const motifSchema = z.string().trim().min(1, 'Le motif est obligatoire.').max(1000, '1000 caractères au maximum.');
export const encaisseurSchema = z.enum(['UTILISATEUR_1', 'UTILISATEUR_2'], { message: 'Choisissez qui a encaissé ce paiement.' });

export function validate<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
): { ok: true; data: z.infer<S> } | { ok: false; errors: Record<string, string> } {
  const r = schema.safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  const errors: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const k = String(issue.path[0] ?? '_');
    if (!errors[k]) errors[k] = issue.message;
  }
  return { ok: false, errors };
}

// ---------- Dates (référence : session.today, Europe/Zurich) ----------
export function zurichDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
export function shiftDate(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return day;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function formatDate(d: string | null | undefined): string {
  if (!d) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : d;
}
export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}
export function dateWarning(date: string, today: string, createdAt: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  if (today && date > today) return 'Cette date est dans le futur. Vous pouvez continuer, mais vérifiez-la.';
  if (date < zurichDate(createdAt)) return 'Cette date précède la création du dossier. Vérifiez-la.';
  return null;
}

// ---------- Encaisseurs ----------
export const COLLECTORS = [
  { value: 'UTILISATEUR_1', label: 'Utilisateur 1' },
  { value: 'UTILISATEUR_2', label: 'Utilisateur 2' },
] as const;
export type Collector = (typeof COLLECTORS)[number]['value'];
export const collectorLabel = (v: string | null | undefined) => COLLECTORS.find((c) => c.value === v)?.label ?? 'Non attribué';

export const TYPE_LABEL: Record<string, string> = {
  MONTANT_INITIAL: 'Montant initial',
  AJOUT_MONTANT: 'Ajout',
  PAIEMENT_ORGANISME: 'Paiement',
  PAIEMENT_GLOBAL: 'Paiement global',
};
export const isPayment = (t: string) => t === 'PAIEMENT_ORGANISME' || t === 'PAIEMENT_GLOBAL';

// ---------- Erreurs API ----------
type Errish = { status?: number; data?: { error?: unknown; code?: unknown } | null };
const asErr = (e: unknown): Errish => (typeof e === 'object' && e ? (e as Errish) : {});
export const apiStatus = (e: unknown): number | undefined => asErr(e).status;
export const apiCode = (e: unknown): string | undefined => {
  const c = asErr(e).data?.code;
  return typeof c === 'string' ? c : undefined;
};
export function errorMessage(e: unknown): string {
  const err = asErr(e);
  const s = err.status;
  const msg = err.data?.error;
  if (typeof msg === 'string' && msg.trim()) return msg;
  if (s === 401) return 'Votre session a expiré. Reconnectez-vous.';
  if (s === 404) return 'Élément introuvable.';
  if (s === 409) return "Les données ont changé entre-temps. Vérifiez l'état actuel puis réessayez.";
  if (s === 413) return 'Le fichier est trop volumineux.';
  if (s === 422 || s === 400) return 'Les informations saisies ne sont pas valides.';
  if (s === 429) return 'Trop de tentatives. Patientez un instant.';
  if (s && s >= 500) return 'Le serveur a rencontré un problème. Réessayez dans un instant.';
  return 'Connexion impossible. Vérifiez le réseau puis réessayez. Rien n’a été enregistré localement.';
}

// ---------- Idempotence ----------
// An idempotence identifier, not an authentication credential.
// Pure JS keeps UUID creation independent of native crypto module versions.
export const newReference = (): string => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
  /[xy]/g,
  (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === 'x' ? value : (value & 3) | 8).toString(16);
  },
);

// ---------- Rafraîchissement après écriture ----------
const SESSION_KEY = JSON.stringify(getGetSessionQueryKey());
export const isSessionKey = (k: readonly unknown[]) => JSON.stringify(k) === SESSION_KEY;

/** Après toute écriture : invalide tout ce qui dépend du journal (dossiers, historiques, listes, encaissements, relances, estimations). */
export async function refreshAll(qc: QueryClient) {
  await qc.invalidateQueries({ predicate: (q) => !isSessionKey(q.queryKey) });
}
