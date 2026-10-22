import React, { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { getGetRemindersQueryKey, useGetReminders, type GetRemindersParams, type ReminderEntry } from '@workspace/api-client-react';
import { Card, Empty, ErrorState, Label, Money, Pager, Row, SectionTitle, SkeletonList, Txt } from '@/components/ui';
import { TabHeader } from '@/components/Screen';
import colorsConst from '@/constants/colors';
import { formatDate, isPositive } from '@/lib/core';

const C = colorsConst.light;

export default function RemindersScreen() {
  const [offset, setOffset] = useState(0);
  const params: GetRemindersParams = offset ? { offset } : {};
  const q = useGetReminders(params, { query: { queryKey: getGetRemindersQueryKey(params), refetchInterval: 30_000, placeholderData: (p) => p } });
  const r = q.data;

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <TabHeader title="Relances" />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: Platform.OS === 'web' ? 120 : 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={C.primary} colors={[C.primary]} progressBackgroundColor={C.card} />}
      >
        {q.isLoading ? (
          <SkeletonList n={4} />
        ) : q.error && !r ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : r ? (
          <>
            <Card accent={C.primary} style={{ gap: 8 }} testID="card-reminders-today">
              <Label>{`Aujourd’hui · ${formatDate(r.today)}`}</Label>
              <Money value={r.restantCentimes} size={28} color={isPositive(r.restantCentimes) ? C.debt : C.settled} testID="text-reminders-remaining" />
              <Txt size={12} muted>reste à encaisser aujourd’hui</Txt>
              <Row label="Objectif du jour"><Money value={r.objectifCentimes} size={14} /></Row>
              <Row label="Déjà encaissé"><Money value={r.encaisseCentimes} size={14} color={C.settled} /></Row>
            </Card>

            <SectionTitle>Objectifs du jour</SectionTitle>
            {r.todayEntries.length === 0 ? (
              <Empty icon="bell-off" title="Aucune relance active aujourd’hui" text="Activez une relance depuis un organisme dans un dossier." testID="state-reminders-empty" />
            ) : (
              r.todayEntries.map((e) => <EntryCard key={`t-${e.organismeId}-${e.date}`} e={e} />)
            )}

            <SectionTitle color={C.destructive}>{`Jours manqués (${r.missedTotalRows})`}</SectionTitle>
            {r.missedTotalRows > 0 && (
              <Card accent={C.destructive} style={{ gap: 4, backgroundColor: C.destructiveSoft }}>
                <Row label="Total non encaissé"><Money value={r.missedTotalCentimes} size={15} color={C.destructive} /></Row>
                <Txt size={11} color={C.destructive}>Objectifs historiques, non reportés et non ajoutés à la dette.</Txt>
              </Card>
            )}
            {r.missedEntries.length === 0 ? (
              <Txt size={13} muted>Aucun jour manqué.</Txt>
            ) : (
              r.missedEntries.map((e) => <EntryCard key={`m-${e.organismeId}-${e.date}`} e={e} missed />)
            )}
            <Pager offset={r.offset} limit={r.limit} total={r.missedTotalRows} count={r.missedEntries.length} busy={q.isFetching} onPrev={() => setOffset(Math.max(0, offset - r.limit))} onNext={() => setOffset(offset + r.limit)} testID="pager-missed" />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function EntryCard({ e, missed }: { e: ReminderEntry; missed?: boolean }) {
  const done = !isPositive(e.restantCentimes);
  const col = missed ? C.destructive : done ? C.primary : C.debt;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/client/[id]', params: { id: String(e.clientId) } })}
      accessibilityRole="button"
      testID={`row-reminder-${missed ? 'missed' : 'today'}-${e.organismeId}-${e.date}`}
      style={({ pressed }) => ({ backgroundColor: pressed ? C.accent : missed ? C.destructiveSoft : C.card, borderWidth: 1, borderColor: missed ? C.destructive : C.border, borderLeftWidth: 3, borderLeftColor: col, borderRadius: 2, padding: 12, gap: 4 })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt w="b" numberOfLines={1} style={{ flex: 1 }}>{`${e.prenom} ${e.nom}`}</Txt>
        <Money value={e.restantCentimes} size={15} color={col} />
      </View>
      <Txt size={12} muted numberOfLines={1}>{`${e.organismeNom}${missed ? ` · ${formatDate(e.date)}` : ''}`}</Txt>
      <Txt size={12} muted>{`objectif ${fmt(e.montantCentimes)} · encaissé ${fmt(e.encaisseCentimes)}`}</Txt>
    </Pressable>
  );
}
function fmt(v: string) {
  try {
    const b = BigInt(v);
    return `${(b / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${(b % 100n).toString().padStart(2, '0')}`;
  } catch {
    return '—';
  }
}
