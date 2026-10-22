import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { getGetRemindersQueryKey, useGetReminders } from '@workspace/api-client-react';
import { Btn, Card, Label, Money, Pill, Skeleton, Txt } from '@/components/ui';
import colorsConst from '@/constants/colors';
import { dayFraction, formatMilliChf, simulatedMilli, zurichDateKey } from '@/lib/swiss-time';

const C = colorsConst.light;

/** Simulation : objectif du jour réparti depuis minuit suisse. Lecture seule, aucune écriture au grand livre. */
export function CollectionCounter() {
  const params = {};
  const q = useGetReminders(params, { query: { queryKey: getGetRemindersQueryKey(params), refetchInterval: 60_000, placeholderData: (p) => p } });
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const r = q.data;
  const localDay = zurichDateKey(now);
  const stale = !!r && r.today !== localDay;
  const asked = useRef('');
  const refetch = q.refetch;
  useEffect(() => {
    if (stale && asked.current !== localDay) {
      asked.current = localDay;
      void refetch();
    }
  }, [stale, localDay, refetch]);

  const target = r && !stale ? r.objectifCentimes : '0';
  const hasTarget = target !== '0' && !target.startsWith('-');
  const sim = r && !stale ? simulatedMilli(target, now, r.today) : 0n;
  const { main, sub } = formatMilliChf(sim);
  const pct = r && !stale && hasTarget ? dayFraction(now, r.today) : 0;

  return (
    <Card style={{ gap: 8, borderStyle: 'dashed' }} testID="card-simulation">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Label color={C.primary}>Simulation · objectif du jour</Label>
        <Pill label="SIMULATION" tone="ok" />
      </View>
      {q.isPending ? (
        <Skeleton h={40} />
      ) : q.error && !r ? (
        <View style={{ gap: 8 }}>
          <Txt size={13} color={C.destructive}>Impossible de charger les objectifs du jour.</Txt>
          <Btn compact variant="outline" label="Réessayer" onPress={() => void q.refetch()} testID="button-retry-counter" />
        </View>
      ) : stale || !r ? (
        <Txt size={13} muted>Nouvelle journée à Zurich — actualisation…</Txt>
      ) : (
        <>
          <Txt w="b" size={30} color={C.primary} style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1} testID="text-simulated-amount">
            {main}
            <Txt size={14} color={C.mutedForeground}>{sub}</Txt>
            <Txt size={12} color={C.mutedForeground}> CHF</Txt>
          </Txt>
          {hasTarget ? (
            <View style={{ height: 4, backgroundColor: C.muted, borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: 4, width: `${pct * 100}%`, backgroundColor: C.primary }} />
            </View>
          ) : (
            <Txt size={12} muted testID="text-no-target">Aucun objectif aujourd’hui : la simulation reste à zéro.</Txt>
          )}
          <View style={{ flexDirection: 'row', gap: 12, paddingTop: 4 }}>
            <View style={{ flex: 1 }}>
              <Txt size={11} muted>OBJECTIF</Txt>
              <Money value={r.objectifCentimes} size={13} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={11} muted>ENCAISSÉ RÉEL</Txt>
              <Money value={r.encaisseCentimes} size={13} color={C.settled} testID="text-counter-actual" />
            </View>
            <View style={{ flex: 1 }}>
              <Txt size={11} muted>RESTE RÉEL</Txt>
              <Money value={r.restantCentimes} size={13} color={C.debt} />
            </View>
          </View>
          <Txt size={11} muted>Simulation, pas un encaissement réel : progression de l’objectif depuis minuit (Europe/Zurich), sur la durée réelle du jour.</Txt>
        </>
      )}
    </Card>
  );
}
