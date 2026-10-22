import React, { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import { FlatList, Platform, Pressable, RefreshControl, View } from 'react-native';
import { router } from 'expo-router';
import { getGetCollectionsQueryKey, getGetDossierQueryKey, getListClientsQueryKey, useGetCollections, useGetDossier, useListClients, type CollectionEntry, type GetCollectionsEncaisseur, type GetCollectionsParams } from '@workspace/api-client-react';
import { Btn, Card, Chip, Empty, OptionRow, Sheet, ErrorState, Field, Label, Money, Pager, Pill, Row, Segmented, SkeletonList, Txt } from '@/components/ui';
import { TabHeader } from '@/components/Screen';
import colorsConst from '@/constants/colors';
import { collectorLabel, formatDate, formatDateTime } from '@/lib/core';

const C = colorsConst.light;
type Enc = '' | GetCollectionsEncaisseur;
const ENC: { value: Enc; label: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'UTILISATEUR_1', label: 'Util. 1' },
  { value: 'UTILISATEUR_2', label: 'Util. 2' },
  { value: 'NON_ATTRIBUE', label: 'N/A' },
];
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

export default function CollectionsScreen() {
  const [enc, setEnc] = useState<Enc>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [offset, setOffset] = useState(0);
  const [showDates, setShowDates] = useState(false);
  const [clientId, setClientId] = useState<number | null>(null);
  const [orgId, setOrgId] = useState<number | null>(null);
  const [picking, setPicking] = useState(false);
  const [pickSearch, setPickSearch] = useState('');

  const active = useListClients({ filter: 'all' }, { query: { queryKey: getListClientsQueryKey({ filter: 'all' }), refetchInterval: 30_000 } });
  const archived = useListClients({ filter: 'archived' }, { query: { queryKey: getListClientsQueryKey({ filter: 'archived' }), refetchInterval: 30_000 } });
  const clients = useMemo(() => {
    const m = new Map<number, { id: number; label: string }>();
    for (const c of [...(active.data?.clients ?? []), ...(archived.data?.clients ?? [])]) m.set(c.id, { id: c.id, label: `${c.prenom} ${c.nom}${c.archivedAt ? ' (archivé)' : ''}` });
    return [...m.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
  }, [active.data, archived.data]);
  const cid = clientId ?? 0;
  const dossier = useGetDossier(cid, { query: { queryKey: getGetDossierQueryKey(cid), enabled: cid > 0 } });
  const clientLabel = clients.find((c) => c.id === clientId)?.label ?? (clientId ? `Client #${clientId}` : 'Tous les clients');
  const norm = (v: string) => v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const shown = pickSearch.trim() ? clients.filter((c) => norm(c.label).includes(norm(pickSearch.trim()))) : clients;

  const fromOk = !from || isDate(from);
  const toOk = !to || isDate(to);
  const params: GetCollectionsParams = {
    ...(enc ? { encaisseur: enc } : {}),
    ...(clientId ? { clientId } : {}),
    ...(clientId && orgId ? { organismeId: orgId } : {}),
    ...(from && fromOk ? { from } : {}),
    ...(to && toOk ? { to } : {}),
    ...(offset ? { offset } : {}),
  };
  const q = useGetCollections(params, { query: { queryKey: getGetCollectionsQueryKey(params), refetchInterval: 30_000, placeholderData: (p) => p } });
  const r = q.data;
  const filtered = !!(enc || from || to || clientId);

  const header = (
    <View style={{ gap: 12, paddingBottom: 6 }}>
      <Segmented options={ENC} value={enc} onChange={(v) => { setEnc(v); setOffset(0); }} testID="filter-encaisseur" />
      <Btn compact variant="outline" icon="user" label={clientLabel} onPress={() => { setPickSearch(''); setPicking(true); }} testID="filter-client" />
      {clientId && dossier.data && dossier.data.organismes.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Tous organismes" active={orgId === null} onPress={() => { setOrgId(null); setOffset(0); }} testID="filter-org-all" />
          {dossier.data.organismes.map((o) => (
            <Chip key={o.id} label={o.nom} active={orgId === o.id} onPress={() => { setOrgId(o.id); setOffset(0); }} testID={`filter-org-${o.id}`} />
          ))}
        </ScrollView>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Btn compact variant="outline" icon="calendar" label={showDates ? 'Masquer dates' : 'Période'} onPress={() => setShowDates(!showDates)} testID="button-toggle-dates" style={{ flex: 1 }} />
        {filtered && <Btn compact variant="ghost" icon="x" label="Réinitialiser" onPress={() => { setEnc(''); setFrom(''); setTo(''); setClientId(null); setOrgId(null); setOffset(0); }} testID="button-reset-filters" />}
      </View>
      {showDates && (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <Field label="Du" value={from} onChangeText={(t) => { setFrom(t); setOffset(0); }} placeholder="AAAA-MM-JJ" maxLength={10} keyboardType="numbers-and-punctuation" error={fromOk ? undefined : 'AAAA-MM-JJ'} testID="filter-from" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Au" value={to} onChangeText={(t) => { setTo(t); setOffset(0); }} placeholder="AAAA-MM-JJ" maxLength={10} keyboardType="numbers-and-punctuation" error={toOk ? undefined : 'AAAA-MM-JJ'} testID="filter-to" />
          </View>
        </View>
      )}
      {r && (
        <Card accent={C.primary} style={{ gap: 8 }} testID="card-collection-totals">
          <Label>Total encaissé {filtered ? '(filtre)' : ''}</Label>
          <Money value={r.totals.totalCentimes} size={28} color={C.settled} testID="text-total-collected" />
          <Row label="Utilisateur 1"><Money value={r.totals.utilisateur1Centimes} size={14} /></Row>
          <Row label="Utilisateur 2"><Money value={r.totals.utilisateur2Centimes} size={14} /></Row>
          <Row label="Non attribué"><Money value={r.totals.nonAttribueCentimes} size={14} /></Row>
          <Txt size={11} muted>Totaux sur toutes les pages, annulations exclues. Sommes récupérées, pas dossiers soldés.</Txt>
        </Card>
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <TabHeader title="Encaissements" />
      <FlatList
        data={r?.entries ?? []}
        keyExtractor={(e) => String(e.lineId)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: Platform.OS === 'web' ? 120 : 40 }}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={C.primary} colors={[C.primary]} progressBackgroundColor={C.card} />}
        renderItem={({ item }) => <EntryRow e={item} />}
        ListEmptyComponent={
          q.isLoading ? <SkeletonList n={5} /> : q.error ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : <Empty icon="download" title="Aucun encaissement" text={filtered ? 'Aucun résultat pour ces filtres.' : 'Les paiements enregistrés apparaîtront ici.'} testID="state-collections-empty" />
        }
        ListFooterComponent={
          r ? <Pager offset={r.offset} limit={r.limit} total={r.totalRows} count={r.entries.length} busy={q.isFetching} onPrev={() => setOffset(Math.max(0, offset - r.limit))} onNext={() => setOffset(offset + r.limit)} testID="pager-collections" /> : null
        }
      />
      {picking && (
        <Sheet title="Filtrer par client" onClose={() => setPicking(false)} testID="sheet-pick-client">
          <Field label="Recherche" value={pickSearch} onChangeText={setPickSearch} placeholder="Nom ou prénom" autoCorrect={false} testID="input-pick-client" />
          <OptionRow label="Tous les clients" active={clientId === null} onPress={() => { setClientId(null); setOrgId(null); setOffset(0); setPicking(false); }} testID="pick-client-all" />
          {active.isLoading || archived.isLoading ? <SkeletonList n={3} h={56} /> : null}
          {shown.map((c) => (
            <OptionRow key={c.id} label={c.label} active={clientId === c.id} onPress={() => { setClientId(c.id); setOrgId(null); setOffset(0); setPicking(false); }} testID={`pick-client-${c.id}`} />
          ))}
          {!active.isLoading && shown.length === 0 ? <Txt size={13} muted>Aucun client.</Txt> : null}
        </Sheet>
      )}
    </View>
  );
}

function EntryRow({ e }: { e: CollectionEntry }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/client/[id]', params: { id: String(e.clientId) } })}
      accessibilityRole="button"
      testID={`row-collection-${e.lineId}`}
      style={({ pressed }) => ({ backgroundColor: pressed ? C.accent : C.card, borderWidth: 1, borderColor: C.border, borderRadius: 2, padding: 12, gap: 4, opacity: e.annulee ? 0.6 : 1 })}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt w="b" numberOfLines={1} style={{ flex: 1, textDecorationLine: e.annulee ? 'line-through' : 'none' }}>{`${e.prenom} ${e.nom}`}</Txt>
        <Txt w="b" size={15} color={e.annulee ? C.mutedForeground : C.settled} style={{ textDecorationLine: e.annulee ? 'line-through' : 'none' }}>
          {`+${formatChfInline(e.montantCentimes)}`}
        </Txt>
      </View>
      <Txt size={12} muted numberOfLines={1}>{`${e.organismeNom} · ${formatDate(e.date)}`}</Txt>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
        <Pill label={collectorLabel(e.encaisseur)} tone={e.encaisseur ? 'ok' : 'muted'} />
        {e.annulee && <Pill label="Annulé" tone="danger" />}
      </View>
      {e.annulee && <Txt size={12} color={C.destructive}>{`Annulé ${e.annuleeAt ? formatDateTime(e.annuleeAt) : ''} — ${e.annuleeMotif ?? ''}`}</Txt>}
    </Pressable>
  );
}
function formatChfInline(v: string) {
  const n = v.replace('-', '');
  try {
    const b = BigInt(n);
    return `${(b / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")}.${(b % 100n).toString().padStart(2, '0')} CHF`;
  } catch {
    return '—';
  }
}
