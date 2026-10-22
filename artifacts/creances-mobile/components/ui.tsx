import React, { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getGetForecastsQueryKey, useGetForecasts } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { COLLECTORS, errorMessage, formatChf, formatDate, shiftDate } from '@/lib/core';
import colorsConst from '@/constants/colors';
import { useActivity } from '@/lib/auth';

export const F = {
  r: 'IBMPlexMono_400Regular',
  m: 'IBMPlexMono_500Medium',
  s: 'IBMPlexMono_600SemiBold',
  b: 'IBMPlexMono_700Bold',
} as const;

const C = colorsConst.light;
const R = colorsConst.radius;

// ---------------- Typo ----------------
type TxtProps = {
  children?: ReactNode;
  style?: StyleProp<TextStyle>;
  w?: keyof typeof F;
  size?: number;
  color?: string;
  muted?: boolean;
  upper?: boolean;
  numberOfLines?: number;
  testID?: string;
  selectable?: boolean;
};
export function Txt({ children, style, w = 'r', size = 15, color, muted, upper, numberOfLines, testID, selectable }: TxtProps) {
  return (
    <Text
      testID={testID}
      selectable={selectable}
      numberOfLines={numberOfLines}
      style={[
        { fontFamily: F[w], fontSize: size, color: color ?? (muted ? C.mutedForeground : C.foreground), lineHeight: Math.round(size * 1.4) },
        upper && { textTransform: 'uppercase', letterSpacing: 1.2 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, color }: { children: ReactNode; color?: string }) {
  return (
    <Txt w="s" size={11} upper color={color ?? C.mutedForeground}>
      {children}
    </Txt>
  );
}

export function Money({ value, size = 16, color, testID, sign }: { value: string; size?: number; color?: string; testID?: string; sign?: '+' | '−' }) {
  return (
    <Txt w="b" size={size} color={color} testID={testID} style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
      {sign ?? ''}
      {formatChf(value)}
    </Txt>
  );
}

// ---------------- Boutons ----------------
type BtnVariant = 'primary' | 'outline' | 'danger' | 'ghost' | 'dangerOutline';
export function Btn({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  testID,
  style,
  compact,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  variant?: BtnVariant;
  icon?: keyof typeof Feather.glyphMap;
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  accessibilityLabel?: string;
}) {
  const bg =
    variant === 'primary' ? C.primary : variant === 'danger' ? C.destructive : variant === 'ghost' ? 'transparent' : C.background;
  const fg =
    variant === 'primary' ? C.primaryForeground : variant === 'danger' ? C.destructiveForeground : variant === 'dangerOutline' ? C.destructive : C.foreground;
  const border = variant === 'outline' ? C.input : variant === 'dangerOutline' ? C.destructive : variant === 'ghost' ? 'transparent' : bg;
  const off = disabled || loading;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        compact && { minHeight: 44, paddingHorizontal: 12 },
        { backgroundColor: bg, borderColor: border, opacity: off ? 0.5 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Feather name={icon} size={18} color={fg} />}
          <Txt w="b" size={compact ? 13 : 15} color={fg} upper={!compact}>
            {label}
          </Txt>
        </>
      )}
    </Pressable>
  );
}

export function IconBtn({ icon, onPress, label, testID, color }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; label: string; testID?: string; color?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [s.iconBtn, { opacity: pressed ? 0.6 : 1 }]}
    >
      <Feather name={icon} size={22} color={color ?? C.foreground} />
    </Pressable>
  );
}

// ---------------- Champs ----------------
export function Field({
  label,
  error,
  hint,
  mono,
  big,
  testID,
  right,
  ...props
}: TextInputProps & { label: string; error?: string; hint?: string; mono?: boolean; big?: boolean; testID?: string; right?: ReactNode }) {
  const [focus, setFocus] = useState(false);
  const ping = useActivity();
  const userOnChange = props.onChangeText;
  return (
    <View style={{ gap: 6 }}>
      <Label color={error ? C.destructive : undefined}>{label}</Label>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={C.mutedForeground + '99'}
          selectionColor={C.primary}
          cursorColor={C.primary}
          onFocus={(e) => {
            setFocus(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocus(false);
            props.onBlur?.(e);
          }}
          {...props}
          onChangeText={(t) => {
            ping();
            userOnChange?.(t);
          }}
          style={[
            s.input,
            {
              borderColor: error ? C.destructive : focus ? C.primary : C.input,
              fontFamily: big || mono ? F.b : F.r,
              fontSize: big ? 24 : 16,
              minHeight: big ? 60 : 52,
              flex: 1,
            },
            props.multiline && { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
          ]}
        />
        {right}
      </View>
      {error ? (
        <Txt size={13} color={C.destructive} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Txt>
      ) : hint ? (
        <Txt size={12} muted>
          {hint}
        </Txt>
      ) : null}
    </View>
  );
}

export function DateField({ label, value, onChange, today, error, testID }: { label: string; value: string; onChange: (v: string) => void; today: string; error?: string; testID?: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Field label={label} value={value} onChangeText={onChange} placeholder="AAAA-MM-JJ" keyboardType="numbers-and-punctuation" autoCapitalize="none" maxLength={10} mono error={error} testID={testID} hint={value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatDate(value) : undefined} />
      {today ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label="Aujourd’hui" active={value === today} onPress={() => onChange(today)} testID={testID ? `${testID}-today` : undefined} />
          <Chip label="Hier" active={value === shiftDate(today, -1)} onPress={() => onChange(shiftDate(today, -1))} testID={testID ? `${testID}-yesterday` : undefined} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------- Chips / segments ----------------
export function Chip({ label, active, onPress, testID, tone }: { label: string; active?: boolean; onPress: () => void; testID?: string; tone?: 'danger' }) {
  const col = tone === 'danger' ? C.destructive : C.primary;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [
        s.chip,
        { borderColor: active ? col : C.border, backgroundColor: active ? col : 'transparent', opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Txt w="s" size={13} color={active ? C.primaryForeground : C.foreground}>
        {label}
      </Txt>
    </Pressable>
  );
}

export function Segmented<T extends string>({ options, value, onChange, testID }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; testID?: string }) {
  return (
    <View style={s.segment} testID={testID}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            testID={testID ? `${testID}-${o.value}` : undefined}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[s.segItem, on && { backgroundColor: C.primary }]}
          >
            <Txt w="s" size={12} color={on ? C.primaryForeground : C.mutedForeground} numberOfLines={1}>
              {o.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

export function CollectorPicker({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label color={error ? C.destructive : undefined}>Encaissé par</Label>
      <View style={{ flexDirection: 'row', gap: 8 }} accessibilityRole="radiogroup">
        {COLLECTORS.map((c) => {
          const on = value === c.value;
          return (
            <Pressable
              key={c.value}
              testID={`select-encaisseur-${c.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => onChange(c.value)}
              style={[s.collector, { borderColor: on ? C.primary : error ? C.destructive : C.input, backgroundColor: on ? C.settledSoft : C.background }]}
            >
              <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? C.primary : C.mutedForeground} />
              <Txt w="b" size={14} color={on ? C.primary : C.foreground}>
                {c.label}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      {error ? <Txt size={13} color={C.destructive}>{error}</Txt> : <Txt size={12} muted>Aucune présélection : choix obligatoire.</Txt>}
    </View>
  );
}

export function OptionRow({ label, sub, active, onPress, testID, right }: { label: string; sub?: string; active: boolean; onPress: () => void; testID?: string; right?: ReactNode }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={[s.option, { borderColor: active ? C.primary : C.border, backgroundColor: active ? C.settledSoft : C.card }]}
    >
      <Feather name={active ? 'disc' : 'circle'} size={18} color={active ? C.primary : C.mutedForeground} />
      <View style={{ flex: 1 }}>
        <Txt w="s" numberOfLines={1}>{label}</Txt>
        {sub ? <Txt size={12} muted>{sub}</Txt> : null}
      </View>
      {right}
    </Pressable>
  );
}

// ---------------- Blocs ----------------
export function Card({ children, style, testID, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string; accent?: string }) {
  return (
    <View testID={testID} style={[s.card, accent ? { borderColor: accent } : null, style]}>
      {children}
    </View>
  );
}

export function Row({ label, children, testID }: { label: string; children: ReactNode; testID?: string }) {
  return (
    <View style={s.kv} testID={testID}>
      <Txt size={13} muted style={{ flexShrink: 1 }}>
        {label}
      </Txt>
      {children}
    </View>
  );
}

export function Notice({ tone = 'info', children, testID }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode; testID?: string }) {
  const map = {
    info: { b: C.border, bg: C.muted, fg: C.foreground, i: 'info' as const },
    warn: { b: C.warn, bg: C.warnSoft, fg: C.warn, i: 'alert-triangle' as const },
    error: { b: C.destructive, bg: C.destructiveSoft, fg: C.destructive, i: 'alert-octagon' as const },
    ok: { b: C.primary, bg: C.settledSoft, fg: C.primary, i: 'check' as const },
  }[tone];
  return (
    <View testID={testID} accessibilityRole={tone === 'error' ? 'alert' : undefined} style={[s.notice, { borderColor: map.b, backgroundColor: map.bg }]}>
      <Feather name={map.i} size={16} color={map.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <Txt size={14} color={map.fg}>{children}</Txt> : children}</View>
    </View>
  );
}

export function Pill({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'ok' | 'danger' | 'warn' }) {
  const col = tone === 'ok' ? C.primary : tone === 'danger' ? C.destructive : tone === 'warn' ? C.warn : C.mutedForeground;
  return (
    <View style={[s.pill, { borderColor: col }]}>
      <Txt w="s" size={10} upper color={col}>
        {label}
      </Txt>
    </View>
  );
}

export function Skeleton({ h = 72, style }: { h?: number; style?: StyleProp<ViewStyle> }) {
  const op = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(op, { toValue: 0.8, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(op, { toValue: 0.35, duration: 650, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [op]);
  return <Animated.View accessibilityLabel="Chargement" style={[{ height: h, backgroundColor: C.muted, borderRadius: R, opacity: op }, style]} />;
}
export function SkeletonList({ n = 4, h = 72 }: { n?: number; h?: number }) {
  return (
    <View style={{ gap: 10 }} testID="state-loading">
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} h={h} />
      ))}
    </View>
  );
}

export function ErrorState({ error, onRetry, testID }: { error: unknown; onRetry: () => void; testID?: string }) {
  return (
    <Card accent={C.destructive} testID={testID ?? 'state-error'} style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Feather name="wifi-off" size={20} color={C.destructive} />
        <Txt w="b" color={C.destructive}>ERREUR</Txt>
      </View>
      <Txt size={14}>{errorMessage(error)}</Txt>
      <Btn label="Réessayer" variant="outline" icon="refresh-cw" onPress={onRetry} testID="button-retry" />
    </Card>
  );
}

export function Empty({ icon, title, text, action, testID }: { icon: keyof typeof Feather.glyphMap; title: string; text?: string; action?: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={s.empty}>
      <Feather name={icon} size={28} color={C.border} />
      <Txt w="b" style={{ textAlign: 'center' }}>{title}</Txt>
      {text ? <Txt size={13} muted style={{ textAlign: 'center' }}>{text}</Txt> : null}
      {action}
    </View>
  );
}

export function Pager({ offset, limit, total, count, onPrev, onNext, busy, testID }: { offset: number; limit: number; total: number; count: number; onPrev: () => void; onNext: () => void; busy?: boolean; testID?: string }) {
  if (total <= limit && offset === 0) return null;
  return (
    <View style={s.pager} testID={testID}>
      <Btn compact variant="outline" icon="chevron-left" label="Préc." disabled={offset === 0 || busy} onPress={onPrev} testID={testID ? `${testID}-prev` : 'button-prev'} />
      <Txt size={13} muted>
        {total === 0 ? '0' : `${offset + 1}–${offset + count}`} / {total}
      </Txt>
      <Btn compact variant="outline" icon="chevron-right" label="Suiv." disabled={offset + count >= total || busy} onPress={onNext} testID={testID ? `${testID}-next` : 'button-next'} />
    </View>
  );
}

export function SectionTitle({ children, right, color }: { children: ReactNode; right?: ReactNode; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
      <Txt w="b" size={13} upper color={color ?? C.primary}>
        {'> '}
        {children}
      </Txt>
      {right}
    </View>
  );
}

export function ProgressBar({ percent }: { percent: number }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <View style={{ height: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.muted }} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(p) }}>
      <View style={{ width: `${p}%`, height: '100%', backgroundColor: C.primary }} />
    </View>
  );
}

// ---------------- Feuille modale ----------------
export function Sheet({ title, subtitle, onClose, children, testID, dismissable = true }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; testID?: string; dismissable?: boolean }) {
  const insets = useSafeAreaInsets();
  const ping = useActivity();
  const close = () => {
    if (dismissable) onClose();
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <View style={s.backdrop} onTouchStart={ping}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Fermer" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 0) + 8, maxHeight: '94%' }]} testID={testID}>
          <View style={s.sheetHead}>
            <View style={{ flex: 1 }}>
              <Txt w="b" size={18} color={C.primary}>{title}</Txt>
              {subtitle ? <Txt size={12} muted>{subtitle}</Txt> : null}
            </View>
            <IconBtn icon="x" label="Fermer" onPress={close} testID="button-close-sheet" />
          </View>
          <KeyboardAwareScrollViewCompat bottomOffset={24} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 16 }}>
            {children}
          </KeyboardAwareScrollViewCompat>
        </View>
      </View>
    </Modal>
  );
}

export function Actions({ children }: { children: ReactNode }) {
  return <View style={{ gap: 10, marginTop: 4 }}>{children}</View>;
}

// ---------------- Estimation ----------------
export function Forecast({ clientId }: { clientId?: number }) {
  const q = useGetForecasts({ query: { queryKey: getGetForecastsQueryKey(), refetchInterval: 30_000 } });
  const f = clientId === undefined ? q.data?.global : q.data?.clients.find((c) => c.clientId === clientId)?.estimation;
  const title = clientId === undefined ? 'Estimation générale · dossiers actifs' : 'Estimation · ce client';
  const days = f?.daysUntilEnd;
  return (
    <Card testID={clientId === undefined ? 'forecast-global' : `forecast-client-${clientId}`} style={{ gap: 10 }}>
      <Label color={C.primary}>{title}</Label>
      {q.isPending ? (
        <Skeleton h={48} />
      ) : q.error || !f ? (
        clientId !== undefined && q.data ? (
          <Txt size={13} muted>Aucune estimation pour ce dossier.</Txt>
        ) : (
          <View style={{ gap: 8 }}>
            <Txt size={14} color={C.destructive}>Impossible de charger l’estimation.</Txt>
            <Btn compact variant="outline" label="Réessayer" onPress={() => q.refetch()} />
          </View>
        )
      ) : (
        <View style={{ gap: 8 }}>
          {f.status === 'settled' ? (
            <Txt w="b" size={18} color={C.primary}>Tout est déjà soldé.</Txt>
          ) : f.status === 'unavailable' ? (
            <Txt w="b">Date de récupération non estimable</Txt>
          ) : (
            <View>
              <Txt size={12} muted>{f.status === 'partial' ? 'Fin estimée de la part planifiée uniquement' : 'Fin estimée pour tout récupérer'}</Txt>
              {f.endDate ? (
                <Txt w="b" size={26} color={C.primary} testID="forecast-end-date">{formatDate(f.endDate)}</Txt>
              ) : (
                <Txt size={13} muted>Date au-delà de la plage affichable.</Txt>
              )}
              {days !== null && days !== undefined && (
                <Txt size={13} testID="forecast-duration">{days === '0' ? 'Aujourd’hui' : `Dans ${formatInt(days)} jour${days === '1' ? '' : 's'}`}</Txt>
              )}
            </View>
          )}
          {f.status !== 'settled' && f.status !== 'unavailable' && (
            <>
              <Row label="Solde planifié"><Money value={f.estimableCentimes} size={14} /></Row>
              <Row label="Cadence / jour"><Money value={f.dailyCentimes} size={14} /></Row>
            </>
          )}
          {f.status !== 'settled' && f.nonEstimableCentimes !== '0' && (
            <Notice tone="error">
              <Txt size={13} color={C.destructive}>Sans date estimable : <Txt w="b" size={13} color={C.destructive}>{formatChf(f.nonEstimableCentimes)}</Txt></Txt>
              <Txt size={12} muted>Relances inactives, archives ou dettes futures : récupération totale non estimable.</Txt>
            </Notice>
          )}
          <Txt size={11} muted>Projection indicative aux relances actuelles, chaque jour, sans nouvelle dette. Jours manqués non ajoutés.</Txt>
        </View>
      )}
    </Card>
  );
}
function formatInt(v: string) {
  try {
    return BigInt(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  } catch {
    return v;
  }
}

// ---------------- Toasts ----------------
type Toast = { id: number; title: string; desc?: string; tone: 'ok' | 'error' };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const insets = useSafeAreaInsets();
  const op = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const push = useCallback(
    (t: Omit<Toast, 'id'>) => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ ...t, id: Date.now() });
      op.setValue(0);
      Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
      timer.current = setTimeout(() => setToast(null), 3400);
    },
    [op],
  );
  const col = toast?.tone === 'error' ? C.destructive : C.primary;
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="box-none"
          style={[s.toastWrap, { top: insets.top + (Platform.OS === 'web' ? 67 : 8), opacity: op, transform: [{ translateY: op.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}
        >
          <Pressable onPress={() => setToast(null)} style={[s.toast, { borderColor: col }]} accessibilityLiveRegion="polite" testID="toast">
            <Txt w="b" size={14} color={col}>{toast.title}</Txt>
            {toast.desc ? <Txt size={13}>{toast.desc}</Txt> : null}
          </Pressable>
        </Animated.View>
      )}
    </ToastCtx.Provider>
  );
}

const s = StyleSheet.create({
  btn: {
    minHeight: 54,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: R,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  iconBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  input: {
    borderWidth: 1,
    borderRadius: R,
    paddingHorizontal: 14,
    color: C.foreground,
    backgroundColor: C.background,
  },
  chip: { minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderRadius: R, justifyContent: 'center' },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: C.border, borderRadius: R, padding: 3, gap: 3, backgroundColor: C.card },
  segItem: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: R, paddingHorizontal: 4 },
  collector: { flex: 1, minHeight: 56, borderWidth: 1, borderRadius: R, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  option: { minHeight: 56, borderWidth: 1, borderRadius: R, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: R, padding: 14 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  notice: { flexDirection: 'row', gap: 10, borderWidth: 1, borderRadius: R, padding: 12 },
  pill: { borderWidth: 1, borderRadius: R, paddingHorizontal: 6, paddingVertical: 1, alignSelf: 'flex-start' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 36, paddingHorizontal: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: C.border, borderRadius: R },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,8,2,0.78)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: C.background, borderTopWidth: 1, borderColor: C.primary, borderTopLeftRadius: R, borderTopRightRadius: R },
  sheetHead: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 4, paddingTop: 6, borderBottomWidth: 1, borderBottomColor: C.border, minHeight: 60 },
  toastWrap: { position: 'absolute', left: 12, right: 12, zIndex: 1000 },
  toast: { backgroundColor: C.card, borderWidth: 1, borderRadius: R, padding: 14, gap: 2 },
});

export { useColors };
