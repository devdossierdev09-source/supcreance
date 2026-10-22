import React, { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { getListClientsQueryKey, useListClients, type ClientSummary, type ListClientsFilter, type ListClientsSort } from '@workspace/api-client-react';
import { Card, Empty, ErrorState, Field, Forecast, IconBtn, Label, Money, Pill, Segmented, SkeletonList, Txt } from '@/components/ui';
import { CollectionCounter } from '@/components/CollectionCounter';
import { ClientSheet } from '@/components/sheets';
import { TabHeader } from '@/components/Screen';
import colorsConst from '@/constants/colors';
import { formatDate, isZero } from '@/lib/core';

const C = colorsConst.light;

const FILTERS: { value: ListClientsFilter; label: string }[] = [
  { value: 'all', label: 'Actifs' },
  { value: 'debt', label: 'Dette' },
  { value: 'settled', label: 'Soldés' },
  { value: 'archived', label: 'Archives' },
];
const SORTS: { value: ListClientsSort; label: string }[] = [
  { value: 'name', label: 'Nom' },
  { value: 'balance', label: 'Solde' },
  { value: 'activity', label: 'Activité' },
];

export default function ClientsScreen() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [filter, setFilter] = useState<ListClientsFilter>('all');
  const [sort, setSort] = useState<ListClientsSort>('name');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const params = { ...(debounced ? { search: debounced } : {}), filter, sort };
  const q = useListClients(params, { query: { queryKey: getListClientsQueryKey(params), refetchInterval: 30_000, placeholderData: (prev) => prev } });
  const totals = useListClients({ filter: 'all' }, { query: { queryKey: getListClientsQueryKey({ filter: 'all' }), refetchInterval: 30_000 } });
  const list = q.data?.clients ?? [];

  const header = (
    <View style={{ gap: 14, paddingBottom: 6 }}>
      {totals.data ? (
        <Card accent={C.primary} style={{ gap: 10 }} testID="card-totals">
          <Label>Reste dû · dossiers actifs</Label>
          <Money value={totals.data.totalRemainingCentimes} size={30} color={C.debt} testID="text-total-remaining" />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Txt size={11} muted>ENCAISSÉ</Txt>
              <Money value={totals.data.totalPaidCentimes} size={14} color={C.settled} />
            </View>
            <View>
              <Txt size={11} muted>AVEC DETTE</Txt>
              <Txt w="b">{totals.data.activeCount}</Txt>
            </View>
            <View>
              <Txt size={11} muted>SOLDÉS</Txt>
              <Txt w="b">{totals.data.settledCount}</Txt>
            </View>
          </View>
        </Card>
      ) : totals.isLoading ? (
        <SkeletonList n={1} h={110} />
      ) : null}
      <Forecast />
      <CollectionCounter />
      <Field label="Recherche" value={search} onChangeText={setSearch} placeholder="Nom ou prénom" autoCorrect={false} returnKeyType="search" testID="input-search" />
      <Segmented options={FILTERS} value={filter} onChange={setFilter} testID="filter-clients" />
      <Segmented options={SORTS} value={sort} onChange={setSort} testID="sort-clients" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <TabHeader title="Clients" right={<IconBtn icon="user-plus" label="Nouveau client" onPress={() => setCreating(true)} color={C.primary} testID="button-new-client" />} />
      <FlatList
        data={q.error && !q.data ? [] : list}
        keyExtractor={(c) => String(c.id)}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: Platform.OS === 'web' ? 120 : 100 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => { void q.refetch(); void totals.refetch(); }} tintColor={C.primary} colors={[C.primary]} progressBackgroundColor={C.card} />}
        renderItem={({ item }) => <ClientRow c={item} />}
        ListEmptyComponent={
          q.isLoading ? (
            <SkeletonList n={5} />
          ) : q.error ? (
            <ErrorState error={q.error} onRetry={() => q.refetch()} />
          ) : (
            <Empty
              icon="inbox"
              title={debounced ? 'Aucun résultat' : filter === 'archived' ? 'Aucun client archivé' : 'Aucun client ici'}
              text={debounced ? `Rien ne correspond à « ${debounced} ».` : 'Créez un client pour commencer le suivi.'}
              testID="state-clients-empty"
            />
          )
        }
      />
      <Pressable
        onPress={() => setCreating(true)}
        accessibilityRole="button"
        accessibilityLabel="Nouveau client"
        testID="fab-new-client"
        style={({ pressed }) => ({
          position: 'absolute',
          right: 16,
          bottom: Platform.OS === 'web' ? 34 + 16 : 16,
          width: 60,
          height: 60,
          borderRadius: 2,
          backgroundColor: C.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Feather name="plus" size={28} color={C.primaryForeground} />
      </Pressable>
      {creating && (
        <ClientSheet
          onClose={() => setCreating(false)}
          onCreated={(c) => {
            setCreating(false);
            router.push({ pathname: '/client/[id]', params: { id: String(c.id) } });
          }}
        />
      )}
    </View>
  );
}

function ClientRow({ c }: { c: ClientSummary }) {
  const settled = isZero(c.remainingCentimes);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/client/[id]', params: { id: String(c.id) } })}
      accessibilityRole="button"
      accessibilityLabel={`${c.prenom} ${c.nom}`}
      testID={`row-client-${c.id}`}
      style={({ pressed }) => ({
        backgroundColor: pressed ? C.accent : C.card,
        borderWidth: 1,
        borderColor: C.border,
        borderLeftWidth: 3,
        borderLeftColor: c.archivedAt ? C.mutedForeground : settled ? C.primary : C.debt,
        borderRadius: 2,
        padding: 14,
        minHeight: 72,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
      })}
    >
      <View style={{ flex: 1, gap: 3 }}>
        <Txt w="b" size={16} numberOfLines={1}>{`${c.prenom} ${c.nom}`}</Txt>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <Txt size={12} muted>{`${c.organismeCount} org. · ${formatDate(c.lastActivity)}`}</Txt>
          {c.archivedAt ? <Pill label="Archivé" /> : settled ? <Pill label="Soldé" tone="ok" /> : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Money value={c.remainingCentimes} size={15} color={settled ? C.settled : C.debt} />
        <Txt size={11} muted>reste dû</Txt>
      </View>
    </Pressable>
  );
}
