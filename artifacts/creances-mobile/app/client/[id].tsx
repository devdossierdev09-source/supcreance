import React, { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import {
  exportDossier,
  getGetDossierQueryKey,
  getGetHistoryQueryKey,
  useGetDossier,
  useGetHistory,
  type Dossier,
  type GetHistoryParams,
  type GetHistoryType,
  type Operation,
  type Organisme,
} from '@workspace/api-client-react';
import { Btn, Card, Chip, Empty, ErrorState, Field, Forecast, IconBtn, Label, Money, Pill, ProgressBar, Row, SectionTitle, Sheet, SkeletonList, Txt } from '@/components/ui';
import {
  ArchiveClientSheet,
  ArchiveOrganismeSheet,
  CancelOperationSheet,
  ClientSheet,
  CreateOrganismeSheet,
  DeleteClientSheet,
  PaymentSheet,
  RelanceSheet,
  RenameOrganismeSheet,
  ReplacePaymentSheet,
  type PayMode,
} from '@/components/sheets';
import colorsConst from '@/constants/colors';
import { useToday } from '@/lib/auth';
import { saveAndShare, ShareUnavailableError } from '@/lib/files';
import { useToast } from '@/components/ui';
import { apiStatus, errorMessage, collectorLabel, formatChf, formatDate, formatDateTime, isPayment, isPositive, isZero, TYPE_LABEL } from '@/lib/core';

const C = colorsConst.light;

type SheetState =
  | { k: 'pay'; mode: PayMode; orgId?: number }
  | { k: 'editClient' }
  | { k: 'archiveClient' }
  | { k: 'deleteClient' }
  | { k: 'menu' }
  | { k: 'createOrg' }
  | { k: 'renameOrg'; org: Organisme }
  | { k: 'archiveOrg'; org: Organisme }
  | { k: 'relance'; org: Organisme }
  | { k: 'cancelOp'; op: Operation }
  | { k: 'replaceOp'; op: Operation }
  | null;

export default function DossierScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const id = Number(idParam);
  const valid = Number.isInteger(id) && id > 0;
  const today = useToday();
  const q = useGetDossier(id, { query: { queryKey: getGetDossierQueryKey(id), enabled: valid, refetchInterval: 30_000 } });
  const [sheet, setSheet] = useState<SheetState>(null);
  const d = q.data;
  const close = () => setSheet(null);

  if (!valid || apiStatus(q.error) === 404) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, padding: 16 }}>
        <Stack.Screen options={{ title: 'Introuvable' }} />
        <Empty icon="x-square" title="Dossier introuvable" text="Ce client a peut-être été supprimé." action={<Btn label="Retour aux clients" onPress={() => router.replace('/')} />} testID="state-dossier-404" />
      </View>
    );
  }

  const readOnly = !!d?.client.archivedAt;
  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <Stack.Screen
        options={{
          title: d ? `${d.client.prenom} ${d.client.nom}` : 'Dossier',
          headerRight: () => (d ? <IconBtn icon="more-vertical" label="Actions du client" onPress={() => setSheet({ k: 'menu' })} testID="button-client-menu" /> : null),
        }}
      />
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: Platform.OS === 'web' ? 120 : 48 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching && !q.isLoading} onRefresh={() => void q.refetch()} tintColor={C.primary} colors={[C.primary]} progressBackgroundColor={C.card} />}
      >
        {q.isLoading ? (
          <SkeletonList n={4} h={96} />
        ) : q.error && !d ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : d ? (
          <>
            {readOnly && <Txt size={13} color={C.warn} testID="notice-archived">{`ARCHIVÉ le ${formatDateTime(d.client.archivedAt ?? '')} — lecture seule`}</Txt>}
            <Summary d={d} />
            {!readOnly && (
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn label="Paiement" icon="arrow-down-left" onPress={() => setSheet({ k: 'pay', mode: 'ORGANISME' })} style={{ flex: 1 }} testID="button-pay-target" disabled={!isPositive(d.remainingCentimes)} />
                  <Btn label="Global" icon="git-merge" variant="outline" onPress={() => setSheet({ k: 'pay', mode: 'GLOBAL' })} style={{ flex: 1 }} testID="button-pay-global" disabled={!isPositive(d.remainingCentimes)} />
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Btn compact label="Ajouter dette" icon="plus" variant="outline" onPress={() => setSheet({ k: 'pay', mode: 'AJOUT' })} style={{ flex: 1 }} testID="button-add-debt" />
                  <Btn compact label="Organisme" icon="folder-plus" variant="outline" onPress={() => setSheet({ k: 'createOrg' })} style={{ flex: 1 }} testID="button-add-org" />
                </View>
              </View>
            )}
            <Forecast clientId={d.client.id} />
            <SectionTitle>{`Organismes (${d.organismes.length})`}</SectionTitle>
            {d.organismes.length === 0 ? (
              <Empty icon="folder" title="Aucun organisme" text="Ajoutez un organisme avec son montant dû." action={!readOnly ? <Btn compact label="Ajouter un organisme" icon="plus" onPress={() => setSheet({ k: 'createOrg' })} /> : undefined} testID="state-orgs-empty" />
            ) : (
              d.organismes.map((o) => <OrgCard key={o.id} o={o} readOnly={readOnly} onAction={setSheet} />)
            )}
            <History dossier={d} readOnly={readOnly} onAction={setSheet} />
          </>
        ) : null}
      </ScrollView>

      {d && sheet?.k === 'pay' && <PaymentSheet mode={sheet.mode} dossier={d} organismeId={sheet.orgId} today={today} onClose={close} />}
      {d && sheet?.k === 'editClient' && <ClientSheet client={d.client} onClose={close} />}
      {d && sheet?.k === 'archiveClient' && <ArchiveClientSheet dossier={d} onClose={close} />}
      {d && sheet?.k === 'deleteClient' && <DeleteClientSheet dossier={d} onClose={close} />}
      {d && sheet?.k === 'createOrg' && <CreateOrganismeSheet dossier={d} onClose={close} />}
      {d && sheet?.k === 'renameOrg' && <RenameOrganismeSheet dossier={d} organisme={sheet.org} onClose={close} />}
      {d && sheet?.k === 'archiveOrg' && <ArchiveOrganismeSheet dossier={d} organisme={sheet.org} onClose={close} />}
      {d && sheet?.k === 'relance' && <RelanceSheet dossier={d} organisme={sheet.org} onClose={close} />}
      {d && sheet?.k === 'cancelOp' && <CancelOperationSheet dossier={d} op={sheet.op} onClose={close} />}
      {d && sheet?.k === 'replaceOp' && <ReplacePaymentSheet dossier={d} op={sheet.op} today={today} onClose={close} />}
      {d && sheet?.k === 'menu' && (
        <Sheet title={`${d.client.prenom} ${d.client.nom}`} subtitle={`Créé le ${formatDateTime(d.client.createdAt)}`} onClose={close}>
          <MenuItem icon="edit-2" label="Modifier le nom" onPress={() => setSheet({ k: 'editClient' })} disabled={readOnly} testID="menu-edit-client" />
          <MenuItem icon="archive" label={readOnly ? 'Désarchiver' : 'Archiver'} onPress={() => setSheet({ k: 'archiveClient' })} testID="menu-archive-client" />
          <MenuItem icon="trash-2" label="Supprimer définitivement" danger onPress={() => setSheet({ k: 'deleteClient' })} testID="menu-delete-client" />
        </Sheet>
      )}
    </View>
  );
}

function MenuItem({ icon, label, onPress, danger, disabled, testID }: { icon: keyof typeof Feather.glyphMap; label: string; onPress: () => void; danger?: boolean; disabled?: boolean; testID?: string }) {
  const col = danger ? C.destructive : C.foreground;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      testID={testID}
      style={({ pressed }) => ({ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: danger ? C.destructive : C.border, borderRadius: 2, backgroundColor: pressed ? C.accent : C.card, opacity: disabled ? 0.4 : 1 })}
    >
      <Feather name={icon} size={20} color={col} />
      <Txt w="s" color={col}>{label}</Txt>
    </Pressable>
  );
}

function Summary({ d }: { d: Dossier }) {
  const pct = Number.parseFloat(d.repaidPercent);
  const settled = isZero(d.remainingCentimes);
  return (
    <Card accent={settled ? C.primary : C.border} style={{ gap: 10 }} testID="card-summary">
      <Label>Reste dû</Label>
      <Money value={d.remainingCentimes} size={32} color={settled ? C.settled : C.debt} testID="text-remaining" />
      <ProgressBar percent={Number.isFinite(pct) ? pct : 0} />
      <Txt size={12} muted>{`${d.repaidPercent} % remboursé`}</Txt>
      <Row label="Montant initial"><Money value={d.initialCentimes} size={14} /></Row>
      <Row label="Ajouts"><Money value={d.addedCentimes} size={14} /></Row>
      <Row label="Payé"><Money value={d.paidCentimes} size={14} color={C.settled} /></Row>
    </Card>
  );
}

function OrgCard({ o, readOnly, onAction }: { o: Organisme; readOnly: boolean; onAction: (s: SheetState) => void }) {
  const archived = !!o.archivedAt;
  const settled = isZero(o.remainingCentimes);
  const editable = !readOnly && !archived;
  return (
    <Card testID={`card-org-${o.id}`} style={{ gap: 8, opacity: archived ? 0.6 : 1, borderLeftWidth: 3, borderLeftColor: settled ? C.primary : C.debt }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <Txt w="b" size={16} numberOfLines={2}>{o.nom}</Txt>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {archived && <Pill label="Archivé" />}
            {settled && !archived && <Pill label="Soldé" tone="ok" />}
            {o.relanceActive ? <Pill label={`Relance ${formatChf(o.relanceMontantCentimes)}/j`} tone="warn" /> : <Pill label="Relance off" />}
          </View>
        </View>
        <Money value={o.remainingCentimes} size={16} color={settled ? C.settled : C.debt} />
      </View>
      <Txt size={12} muted>{`initial ${formatChf(o.initialCentimes)} · ajouts ${formatChf(o.addedCentimes)} · payé ${formatChf(o.paidCentimes)}`}</Txt>
      {o.relanceActive && o.relanceDepuis ? <Txt size={11} muted>{`Relance depuis le ${formatDate(o.relanceDepuis)}`}</Txt> : null}
      {editable && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 }}>
          {!settled && <Chip label="Payer" onPress={() => onAction({ k: 'pay', mode: 'ORGANISME', orgId: o.id })} testID={`button-pay-org-${o.id}`} />}
          <Chip label="+ Dette" onPress={() => onAction({ k: 'pay', mode: 'AJOUT', orgId: o.id })} testID={`button-add-org-${o.id}`} />
          <Chip label="Relance" onPress={() => onAction({ k: 'relance', org: o })} testID={`button-relance-${o.id}`} />
          <Chip label="Renommer" onPress={() => onAction({ k: 'renameOrg', org: o })} testID={`button-rename-org-${o.id}`} />
          <Chip label="Archiver" onPress={() => onAction({ k: 'archiveOrg', org: o })} testID={`button-archive-org-${o.id}`} />
        </View>
      )}
    </Card>
  );
}

const TYPES: { value: '' | GetHistoryType; label: string }[] = [
  { value: '', label: 'Tout' },
  { value: 'PAIEMENT_ORGANISME', label: 'Paiements' },
  { value: 'PAIEMENT_GLOBAL', label: 'Globaux' },
  { value: 'AJOUT_MONTANT', label: 'Ajouts' },
  { value: 'MONTANT_INITIAL', label: 'Initiaux' },
];

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

function ExportBar({ dossier }: { dossier: Dossier }) {
  const toast = useToast();
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (kind: 'pdf' | 'csv') => {
    if (busy) return;
    setBusy(kind);
    setErr(null);
    try {
      const data: Blob | string = await exportDossier(dossier.client.id, kind);
      const name = `dossier-${dossier.client.id}-${dossier.client.nom}.${kind}`.replace(/[^\w.-]+/g, '_');
      await saveAndShare(name, kind === 'pdf' ? 'application/pdf' : 'text/csv', data, kind === 'pdf' ? 'Partager le PDF' : 'Partager le CSV');
      toast({ tone: 'ok', title: kind === 'pdf' ? 'PDF prêt' : 'CSV prêt', desc: name });
    } catch (e) {
      setErr(e instanceof ShareUnavailableError ? 'Le partage de fichiers n’est pas disponible sur cet appareil.' : errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn compact variant="outline" icon="file-text" label="PDF" onPress={() => void run('pdf')} loading={busy === 'pdf'} disabled={!!busy} style={{ flex: 1 }} testID="button-export-pdf" />
        <Btn compact variant="outline" icon="grid" label="CSV" onPress={() => void run('csv')} loading={busy === 'csv'} disabled={!!busy} style={{ flex: 1 }} testID="button-export-csv" />
      </View>
      {err ? <Txt size={13} color={C.destructive}>{err}</Txt> : null}
    </View>
  );
}

function History({ dossier, readOnly, onAction }: { dossier: Dossier; readOnly: boolean; onAction: (s: SheetState) => void }) {
  const id = dossier.client.id;
  const [type, setType] = useState<'' | GetHistoryType>('');
  const [org, setOrg] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const fromOk = !from || isDate(from);
  const toOk = !to || isDate(to);
  const params: GetHistoryParams = {
    ...(type ? { type } : {}),
    ...(org ? { organismeId: org } : {}),
    ...(from && fromOk ? { from } : {}),
    ...(to && toOk ? { to } : {}),
  };
  const filtered = !!(type || org || from || to);
  const q = useGetHistory(id, params, { query: { queryKey: getGetHistoryQueryKey(id, params), refetchInterval: 30_000, placeholderData: (p) => p } });
  return (
    <View style={{ gap: 10 }}>
      <SectionTitle>Journal</SectionTitle>
      <ExportBar dossier={dossier} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {TYPES.map((t) => (
          <Chip key={t.value || 'all'} label={t.label} active={type === t.value} onPress={() => setType(t.value)} testID={`filter-type-${t.value || 'all'}`} />
        ))}
      </ScrollView>
      {dossier.organismes.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Tous organismes" active={org === null} onPress={() => setOrg(null)} testID="filter-org-all" />
          {dossier.organismes.map((o) => (
            <Chip key={o.id} label={o.nom} active={org === o.id} onPress={() => setOrg(o.id)} testID={`filter-org-${o.id}`} />
          ))}
        </ScrollView>
      )}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Du" value={from} onChangeText={setFrom} placeholder="AAAA-MM-JJ" maxLength={10} keyboardType="numbers-and-punctuation" error={fromOk ? undefined : 'AAAA-MM-JJ'} testID="filter-from" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Au" value={to} onChangeText={setTo} placeholder="AAAA-MM-JJ" maxLength={10} keyboardType="numbers-and-punctuation" error={toOk ? undefined : 'AAAA-MM-JJ'} testID="filter-to" />
        </View>
      </View>
      {fromOk && toOk && from && to && from > to ? <Txt size={13} color={C.destructive}>La date de début est après la date de fin.</Txt> : null}
      {filtered && <Btn compact variant="ghost" icon="x" label="Réinitialiser les filtres" onPress={() => { setType(''); setOrg(null); setFrom(''); setTo(''); }} testID="button-reset-filters" />}
      {filtered && q.data ? (
        <Row label="Total filtré (hors annulations)"><Money value={q.data.totalFilteredCentimes.replace('-', '')} size={14} /></Row>
      ) : null}
      {q.isLoading ? (
        <SkeletonList n={3} />
      ) : q.error && !q.data ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.data && q.data.operations.length === 0 ? (
        <Empty icon="list" title="Aucune opération" text={filtered ? 'Aucune opération pour ces filtres.' : 'Le journal est vide.'} testID="state-history-empty" />
      ) : (
        q.data?.operations.map((op) => <OpRow key={op.id} op={op} readOnly={readOnly} onAction={onAction} />)
      )}
    </View>
  );
}

function OpRow({ op, readOnly, onAction }: { op: Operation; readOnly: boolean; onAction: (s: SheetState) => void }) {
  const [open, setOpen] = useState(false);
  const pay = isPayment(op.type);
  const strike = op.annulee ? ({ textDecorationLine: 'line-through' } as const) : undefined;
  const names = [...new Set(op.lines.map((l) => l.nom))];
  const orgLabel = op.type === 'PAIEMENT_GLOBAL' ? `Réparti sur ${op.lines.length} organisme${op.lines.length > 1 ? 's' : ''}` : names.join(', ') || '—';
  return (
    <Card testID={`row-op-${op.id}`} style={{ gap: 6, padding: 12, opacity: op.annulee ? 0.7 : 1 }}>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Txt size={12} muted>{formatDate(op.date)}</Txt>
        <Pill label={TYPE_LABEL[op.type] ?? op.type} tone={pay ? 'ok' : 'muted'} />
        {op.annulee && <Pill label="Annulée" tone="danger" />}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
        <Txt w="s" size={14} numberOfLines={2} style={[{ flex: 1 }, strike]}>{orgLabel}</Txt>
        <Txt w="b" size={15} color={op.annulee ? C.mutedForeground : pay ? C.settled : C.debt} style={strike}>
          {`${pay ? '−' : '+'}${formatChf(op.totalCentimes.replace('-', ''))}`}
        </Txt>
      </View>
      {pay && <Txt size={12} muted testID={`text-encaisseur-${op.id}`}>{`Encaissé par : ${collectorLabel(op.encaisseur)}`}</Txt>}
      {op.note ? <Txt size={12} muted style={strike}>{op.note}</Txt> : null}
      {op.annulee && <Txt size={12} color={C.destructive} testID={`text-cancel-${op.id}`}>{`Annulée le ${op.annuleeAt ? formatDateTime(op.annuleeAt) : '—'} — motif : ${op.annuleeMotif ?? '—'}`}</Txt>}
      {open && (
        <View style={{ borderTopWidth: 1, borderTopColor: C.border, paddingTop: 6, gap: 4 }}>
          {op.lines.map((l) => (
            <Row key={l.id} label={l.nom}><Money value={l.montantCentimes.replace('-', '')} size={13} /></Row>
          ))}
        </View>
      )}
      {(op.type === 'PAIEMENT_GLOBAL' || (!readOnly && !op.annulee)) && (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          {op.type === 'PAIEMENT_GLOBAL' && <Chip label={open ? 'Masquer répartition' : 'Répartition'} active={open} onPress={() => setOpen(!open)} testID={`button-expand-${op.id}`} />}
          {!readOnly && !op.annulee && pay && <Chip label="Corriger" onPress={() => onAction({ k: 'replaceOp', op })} testID={`button-edit-${op.id}`} />}
          {!readOnly && !op.annulee && <Chip label="Annuler" tone="danger" onPress={() => onAction({ k: 'cancelOp', op })} testID={`button-cancel-${op.id}`} />}
        </View>
      )}
    </Card>
  );
}
