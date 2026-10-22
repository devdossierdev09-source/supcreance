import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetDossierQueryKey,
  getGetHistoryQueryKey,
  useCancelOperation,
  useCreateClient,
  useCreateOperation,
  useCreateOrganisme,
  useDeleteClient,
  usePreviewPayment,
  useReplacePayment,
  useUpdateClient,
  useUpdateOrganisme,
  type Client,
  type Dossier,
  type Operation,
  type Organisme,
  type PaymentPreview,
} from '@workspace/api-client-react';
import { z } from 'zod';
import { preparePaymentSound, playPaymentSound } from '@/lib/payment-sound';
import colorsConst from '@/constants/colors';
import { Actions, Btn, Card, CollectorPicker, DateField, Field, Label, Money, Notice, OptionRow, Row, Sheet, Skeleton, Txt, useToast } from '@/components/ui';
import {
  amountSchema,
  apiCode,
  apiStatus,
  centimesToRaw,
  collectorLabel,
  dateSchema,
  dateWarning,
  encaisseurSchema,
  errorMessage,
  formatChf,
  formatDate,
  isPositive,
  isZero,
  motifSchema,
  nameSchema,
  newReference,
  noteSchema,
  parseAmount,
  refreshAll,
  TYPE_LABEL,
  validate,
  type Collector,
} from '@/lib/core';

const C = colorsConst.light;

/** Version vue à l'ouverture du formulaire : le polling ne la modifie jamais. Seul un 409 explicite la renouvelle. */
function useConfirmedVersion(id: number | undefined, initial = 0) {
  const qc = useQueryClient();
  const [expectedVersion, setVersion] = useState(initial);
  const reconfirm = async () => {
    if (id === undefined) return;
    await refreshAll(qc);
    const fresh = qc.getQueryData<Dossier>(getGetDossierQueryKey(id));
    if (fresh) setVersion(fresh.client.version);
  };
  return { expectedVersion, reconfirm };
}

// ======================= Client : création / renommage =======================
const clientSchema = z.object({ nom: nameSchema, prenom: nameSchema });

export function ClientSheet({ client, onClose, onCreated }: { client?: Client; onClose: () => void; onCreated?: (c: Client) => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(client?.id, client?.version);
  const create = useCreateClient();
  const update = useUpdateClient();
  const [prenom, setPrenom] = useState(client?.prenom ?? '');
  const [nom, setNom] = useState(client?.nom ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [homonym, setHomonym] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const busy = create.isPending || update.isPending;

  const submit = async (confirmDuplicate = false) => {
    if (busy) return;
    const v = validate(clientSchema, { nom, prenom });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setErr(null);
    try {
      if (client) {
        await update.mutateAsync({ id: client.id, data: { nom: v.data.nom, prenom: v.data.prenom, expectedVersion } });
        await refreshAll(qc);
        toast({ tone: 'ok', title: 'Nom modifié' });
        onClose();
      } else {
        const c = await create.mutateAsync({ data: { nom: v.data.nom, prenom: v.data.prenom, ...(confirmDuplicate ? { confirmDuplicate: true } : {}) } });
        await refreshAll(qc);
        toast({ tone: 'ok', title: 'Client créé', desc: `${c.prenom} ${c.nom}` });
        onCreated?.(c);
      }
    } catch (ex) {
      if (apiStatus(ex) === 409 && apiCode(ex) === 'HOMONYM') setHomonym(true);
      else {
        if (client && apiStatus(ex) === 409) await reconfirm();
        setErr(errorMessage(ex));
      }
    }
  };

  return (
    <Sheet title={client ? 'Modifier le client' : 'Nouveau client'} onClose={onClose} dismissable={!busy} testID="sheet-client">
      <Field label="Prénom" value={prenom} onChangeText={(t) => { setPrenom(t); setHomonym(false); }} autoFocus maxLength={120} error={errors.prenom} testID="input-prenom" autoCapitalize="words" returnKeyType="next" />
      <Field label="Nom" value={nom} onChangeText={(t) => { setNom(t); setHomonym(false); }} maxLength={120} error={errors.nom} testID="input-nom" autoCapitalize="words" returnKeyType="done" onSubmitEditing={() => void submit()} />
      {err && <Notice tone="error">{err}</Notice>}
      {homonym && <Notice tone="warn">{`Un client nommé « ${prenom.trim()} ${nom.trim()} » existe déjà. Homonyme ? Vous pouvez créer ce nouveau client quand même.`}</Notice>}
      <Actions>
        {homonym ? (
          <Btn label="Créer quand même" onPress={() => void submit(true)} loading={busy} testID="button-confirm-duplicate" />
        ) : (
          <Btn label={client ? 'Enregistrer' : 'Créer le client'} onPress={() => void submit()} loading={busy} testID="button-save-client" />
        )}
        <Btn label="Annuler" variant="outline" onPress={onClose} disabled={busy} />
      </Actions>
    </Sheet>
  );
}

// ======================= Archivage client =======================
export function ArchiveClientSheet({ dossier, onClose }: { dossier: Dossier; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const upd = useUpdateClient();
  const [err, setErr] = useState<string | null>(null);
  const archived = !!dossier.client.archivedAt;
  const go = async () => {
    if (upd.isPending) return;
    setErr(null);
    try {
      await upd.mutateAsync({ id: dossier.client.id, data: { archived: !archived, expectedVersion } });
      await refreshAll(qc);
      toast({ tone: 'ok', title: archived ? 'Client désarchivé' : 'Client archivé' });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setErr(errorMessage(ex) + ' Dossier actualisé : confirmez à nouveau.');
      } else setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title={archived ? 'Désarchiver ce client ?' : 'Archiver ce client ?'} onClose={onClose} dismissable={!upd.isPending}>
      <Txt size={14} muted>
        {archived
          ? 'Le dossier redeviendra modifiable. Les relances ne sont pas réactivées automatiquement.'
          : 'Le dossier passera en lecture seule et les nouvelles relances s’arrêtent. Rien n’est supprimé.'}
      </Txt>
      {err && <Notice tone="error">{err}</Notice>}
      <Actions>
        <Btn label={archived ? 'Désarchiver' : 'Archiver'} onPress={go} loading={upd.isPending} testID="button-confirm-archive-client" />
        <Btn label="Annuler" variant="outline" onPress={onClose} disabled={upd.isPending} />
      </Actions>
    </Sheet>
  );
}

// ======================= Suppression définitive =======================
export function DeleteClientSheet({ dossier, onClose }: { dossier: Dossier; onClose: () => void }) {
  const { client } = dossier;
  const fullName = `${client.prenom} ${client.nom}`;
  const qc = useQueryClient();
  const toast = useToast();
  const mutation = useDeleteClient();
  const { expectedVersion, reconfirm } = useConfirmedVersion(client.id, client.version);
  const [confirmation, setConfirmation] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const forgetAndLeave = async () => {
    onClose();
    router.replace('/');
    qc.removeQueries({ queryKey: getGetDossierQueryKey(client.id) });
    qc.removeQueries({ queryKey: getGetHistoryQueryKey(client.id) });
    await refreshAll(qc);
  };
  const submit = async () => {
    if (busy) return;
    if (confirmation.trim() !== fullName) {
      setFieldError('Saisissez exactement le prénom et le nom indiqués.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await mutation.mutateAsync({ id: client.id, data: { confirmation: confirmation.trim(), expectedVersion } });
      await forgetAndLeave();
      toast({ tone: 'ok', title: 'Client supprimé', desc: 'Dossier, organismes et encaissements supprimés.' });
    } catch (ex) {
      if (apiStatus(ex) === 404) {
        await forgetAndLeave();
        toast({ tone: 'ok', title: 'Dossier introuvable', desc: 'Ce client a déjà été supprimé.' });
      } else if (apiStatus(ex) === 409) {
        await reconfirm();
        setConfirmation('');
        setError('Ce dossier a changé. Les montants ont été actualisés : vérifiez-les avant de confirmer à nouveau.');
      } else setError(errorMessage(ex));
    } finally {
      setBusy(false);
    }
  };
  const fresh = qc.getQueryData<Dossier>(getGetDossierQueryKey(client.id)) ?? dossier;
  return (
    <Sheet title="Suppression définitive" subtitle="Irréversible dans l’application" onClose={onClose} dismissable={!busy} testID="sheet-delete">
      <Notice tone="error">
        <Txt size={14} color={C.destructive}>
          <Txt w="b" size={14} color={C.destructive}>{fullName}</Txt> et toutes ses données seront effacés : organismes, montants dus, paiements, encaissements, historique et relances. Ce n’est pas un archivage.
        </Txt>
      </Notice>
      <Card style={{ gap: 8 }}>
        <Row label="Organismes à supprimer"><Txt w="b">{fresh.organismes.length}</Txt></Row>
        <Row label="Reste dû retiré"><Money value={fresh.remainingCentimes} size={14} /></Row>
        <Row label="Encaissements retirés"><Money value={fresh.paidCentimes} size={14} /></Row>
      </Card>
      <Txt size={12} muted>Les sauvegardes déjà exportées ne sont pas effacées ; les importer peut recréer ce dossier.</Txt>
      <Field
        label={`Saisissez : ${fullName}`}
        value={confirmation}
        onChangeText={(t) => { setConfirmation(t); setFieldError(''); }}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={201}
        editable={!busy}
        error={fieldError || undefined}
        testID="input-delete-confirmation"
      />
      {error ? <Notice tone="warn">{error}</Notice> : null}
      <Actions>
        <Btn label="Supprimer définitivement" variant="danger" icon="trash-2" onPress={submit} loading={busy} disabled={!confirmation.trim()} testID="button-confirm-delete-client" />
        <Btn label="Conserver le client" variant="outline" onPress={onClose} disabled={busy} />
      </Actions>
    </Sheet>
  );
}

// ======================= Organismes =======================
const orgSchema = z.object({ nom: nameSchema, montant: amountSchema });

export function CreateOrganismeSheet({ dossier, onClose }: { dossier: Dossier; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const create = useCreateOrganisme();
  const [nom, setNom] = useState('');
  const [montant, setMontant] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<string | null>(null);

  const submit = async () => {
    if (create.isPending) return;
    const v = validate(orgSchema, { nom, montant });
    if (!v.ok) return setErrors(v.errors);
    if (dossier.organismes.some((o) => o.nom.trim().toLowerCase() === v.data.nom.toLowerCase())) return setErrors({ nom: 'Un organisme porte déjà ce nom dans ce dossier.' });
    setErrors({});
    setErr(null);
    ref.current ??= newReference();
    try {
      const d = await create.mutateAsync({ id: dossier.client.id, data: { nom: v.data.nom, montant: v.data.montant.trim(), referenceUnique: ref.current, expectedVersion } });
      qc.setQueryData(getGetDossierQueryKey(dossier.client.id), d);
      await refreshAll(qc);
      toast({ tone: 'ok', title: 'Organisme ajouté', desc: v.data.nom });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setErr(errorMessage(ex) + ' Le dossier a été actualisé : vérifiez puis validez à nouveau.');
      } else setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title="Ajouter un organisme" subtitle="Le montant dû est enregistré comme montant initial." onClose={onClose} dismissable={!create.isPending}>
      <Field label="Nom de l'organisme" value={nom} onChangeText={(t) => { setNom(t); ref.current = null; }} autoFocus maxLength={120} error={errors.nom} testID="input-org-nom" />
      <Field label="Montant dû (CHF)" value={montant} onChangeText={(t) => { setMontant(t); ref.current = null; }} keyboardType="decimal-pad" big error={errors.montant} hint="Ex. 1234.50 ou 1'234,50" testID="input-org-montant" />
      {err && <Notice tone="error">{err}</Notice>}
      <Actions>
        <Btn label="Ajouter" onPress={submit} loading={create.isPending} testID="button-save-org" />
        <Btn label="Annuler" variant="outline" onPress={onClose} disabled={create.isPending} />
      </Actions>
    </Sheet>
  );
}

export function RenameOrganismeSheet({ dossier, organisme, onClose }: { dossier: Dossier; organisme: Organisme; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const upd = useUpdateOrganisme();
  const [nom, setNom] = useState(organisme.nom);
  const [error, setError] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (upd.isPending) return;
    const v = validate(z.object({ nom: nameSchema }), { nom });
    if (!v.ok) return setError(v.errors.nom);
    if (dossier.organismes.some((o) => o.id !== organisme.id && o.nom.trim().toLowerCase() === v.data.nom.toLowerCase())) return setError('Un organisme porte déjà ce nom.');
    setError(undefined);
    setErr(null);
    try {
      await upd.mutateAsync({ id: organisme.id, data: { nom: v.data.nom, expectedVersion } });
      await refreshAll(qc);
      toast({ tone: 'ok', title: 'Organisme renommé' });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setErr(errorMessage(ex) + ' Dossier actualisé : validez à nouveau.');
      } else setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title="Renommer l'organisme" onClose={onClose} dismissable={!upd.isPending}>
      <Field label="Nom" value={nom} onChangeText={setNom} autoFocus maxLength={120} error={error} testID="input-rename-org" />
      {err && <Notice tone="error">{err}</Notice>}
      <Actions>
        <Btn label="Enregistrer" onPress={submit} loading={upd.isPending} testID="button-save-rename-org" />
        <Btn label="Annuler" variant="outline" onPress={onClose} disabled={upd.isPending} />
      </Actions>
    </Sheet>
  );
}

export function ArchiveOrganismeSheet({ dossier, organisme, onClose }: { dossier: Dossier; organisme: Organisme; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const upd = useUpdateOrganisme();
  const [err, setErr] = useState<string | null>(null);
  const zero = isZero(organisme.remainingCentimes);
  const go = async () => {
    if (upd.isPending) return;
    setErr(null);
    try {
      await upd.mutateAsync({ id: organisme.id, data: { archived: true, expectedVersion } });
      await refreshAll(qc);
      toast({ tone: 'ok', title: 'Organisme archivé', desc: organisme.nom });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setErr(errorMessage(ex) + ' Dossier actualisé : confirmez à nouveau.');
      } else setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title={zero ? 'Archiver cet organisme ?' : 'Archivage impossible'} onClose={onClose} dismissable={!upd.isPending}>
      {zero ? (
        <Txt size={14}>{`« ${organisme.nom} » est soldé. Il sera masqué des paiements ; son historique reste conservé.`}</Txt>
      ) : (
        <Notice tone="warn">{`« ${organisme.nom} » doit encore ${formatChf(organisme.remainingCentimes)}. Archivage possible uniquement à reste dû nul.`}</Notice>
      )}
      {err && <Notice tone="error">{err}</Notice>}
      <Actions>
        {zero && <Btn label="Archiver" onPress={go} loading={upd.isPending} testID="button-confirm-archive-org" />}
        <Btn label={zero ? 'Annuler' : 'Compris'} variant="outline" onPress={onClose} disabled={upd.isPending} />
      </Actions>
    </Sheet>
  );
}

export function RelanceSheet({ dossier, organisme, onClose }: { dossier: Dossier; organisme: Organisme; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const upd = useUpdateOrganisme();
  const [active, setActive] = useState(organisme.relanceActive);
  const [montant, setMontant] = useState(isPositive(organisme.relanceMontantCentimes) ? centimesToRaw(organisme.relanceMontantCentimes) : '200.00');
  const [error, setError] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const submit = async () => {
    if (upd.isPending) return;
    let raw = centimesToRaw(organisme.relanceMontantCentimes);
    if (active || montant.trim()) {
      const p = parseAmount(montant);
      if (!p.ok) return setError(p.error);
      raw = p.raw;
    } else if (active) return setError('Montant requis.');
    setError(undefined);
    setErr(null);
    try {
      await upd.mutateAsync({ id: organisme.id, data: { relanceActive: active, relanceMontant: raw, expectedVersion } });
      await refreshAll(qc);
      toast({ tone: 'ok', title: active ? 'Relance enregistrée' : 'Relance désactivée', desc: active ? `${raw} CHF par jour` : organisme.nom });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setErr(errorMessage(ex) + ' Le dossier a été actualisé : vérifiez puis validez à nouveau.');
      } else setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title={`Relance · ${organisme.nom}`} subtitle="Objectif quotidien, Europe/Zurich, week-ends compris." onClose={onClose} dismissable={!upd.isPending}>
      <Pressable onPress={() => setActive(!active)} accessibilityRole="switch" accessibilityState={{ checked: active }} testID="checkbox-relance-active" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: active ? C.primary : C.border, padding: 14, minHeight: 60, borderRadius: 2 }}>
        <Txt w="b">Relance active</Txt>
        <Switch value={active} onValueChange={setActive} trackColor={{ false: C.muted, true: C.input }} thumbColor={active ? C.primary : C.mutedForeground} />
      </Pressable>
      <Field label="Montant par jour (CHF)" value={montant} onChangeText={setMontant} keyboardType="decimal-pad" big error={error} hint="Par défaut 200.00" testID="input-relance-montant" />
      <Row label="Enregistré actuellement"><Money value={organisme.relanceMontantCentimes} size={14} /></Row>
      <Txt size={12} muted>Un jour manqué ne se reporte pas. Aucun paiement n’est créé automatiquement. Le suivi commence à l’activation.</Txt>
      {err && <Notice tone="error">{err}</Notice>}
      <Actions>
        <Btn label="Enregistrer" onPress={submit} loading={upd.isPending} testID="button-save-relance" />
        <Btn label="Annuler" variant="outline" onPress={onClose} disabled={upd.isPending} />
      </Actions>
    </Sheet>
  );
}

// ======================= Paiement / Ajout =======================
export type PayMode = 'ORGANISME' | 'GLOBAL' | 'AJOUT';
const baseSchema = z.object({ montant: amountSchema, date: dateSchema, note: noteSchema });
const paySchema = baseSchema.extend({ encaisseur: encaisseurSchema });

function PreviewList({ preview }: { preview: PaymentPreview }) {
  return (
    <View style={{ gap: 8 }} testID="list-preview">
      {preview.rows.map((r) => (
        <Card key={r.organismeId} style={{ gap: 4, padding: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
            <Txt w="s" numberOfLines={1} style={{ flex: 1 }}>{r.nom}</Txt>
            <Money value={r.deductionCentimes.replace('-', '')} sign="−" size={14} color={C.settled} />
          </View>
          <Txt size={12} muted>
            {formatChf(r.beforeCentimes)} {'->'} <Txt w="b" size={12}>{formatChf(r.afterCentimes)}</Txt> · {r.appliedPercent} %
          </Txt>
        </Card>
      ))}
    </View>
  );
}

export function PaymentSheet({ mode, dossier, organismeId, today, onClose }: { mode: PayMode; dossier: Dossier; organismeId?: number; today: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const previewMut = usePreviewPayment();
  const createOp = useCreateOperation();
  const previewRef = useRef(previewMut.mutateAsync);
  previewRef.current = previewMut.mutateAsync;
  const clientId = dossier.client.id;

  const active = dossier.organismes.filter((o) => !o.archivedAt);
  const choices = mode === 'AJOUT' ? active : active.filter((o) => isPositive(o.remainingCentimes));
  const [orgId, setOrgId] = useState<number | undefined>(organismeId ?? (choices.length === 1 ? choices[0]?.id : undefined));
  const org = dossier.organismes.find((o) => o.id === orgId);
  const [montant, setMontant] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');
  const [encaisseur, setEncaisseur] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [preview, setPreview] = useState<PaymentPreview | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refId = useRef<string | null>(null);
  const seq = useRef(0);

  const isPay = mode !== 'AJOUT';
  const parsed = parseAmount(montant);
  const typeKey = mode === 'GLOBAL' ? 'PAIEMENT_GLOBAL' : 'PAIEMENT_ORGANISME';
  const warn = dateWarning(date, today, dossier.client.createdAt);

  const fetchPreview = async (raw: string, oid: number | undefined) => {
    const id = ++seq.current;
    setPreviewing(true);
    try {
      const p = await previewRef.current({ id: clientId, data: { montant: raw, type: typeKey, ...(mode === 'ORGANISME' ? { organismeId: oid } : {}) } });
      if (id !== seq.current) return null;
      setPreview(p);
      setPreviewErr(null);
      return p;
    } catch (e) {
      if (id !== seq.current) return null;
      setPreview(null);
      setPreviewErr(errorMessage(e));
      return null;
    } finally {
      if (id === seq.current) setPreviewing(false);
    }
  };
  const fetchRef = useRef(fetchPreview);
  fetchRef.current = fetchPreview;

  // Aperçu serveur en direct, temporisé.
  useEffect(() => {
    if (!isPay || step !== 'form') return;
    const p = parseAmount(montant);
    if (!p.ok || (mode === 'ORGANISME' && !orgId)) {
      seq.current++;
      setPreview(null);
      setPreviewErr(null);
      setPreviewing(false);
      return;
    }
    const raw = p.raw;
    const t = setTimeout(() => void fetchRef.current(raw, orgId), 350);
    return () => clearTimeout(t);
  }, [montant, orgId, mode, step, isPay]);

  const edited = () => {
    seq.current++;
    setPreview(null);
    setPreviewErr(null);
    setPreviewing(false);
    refId.current = null; // toute modification du contenu => nouvelle clé d'idempotence
    setConflict(false);
    setFormErr(null);
  };

  const settleValue = mode === 'GLOBAL' ? dossier.remainingCentimes : org?.remainingCentimes;

  const next = async () => {
    const v = isPay ? validate(paySchema, { montant, date, note, encaisseur }) : validate(baseSchema, { montant, date, note });
    const errs: Record<string, string> = v.ok ? {} : { ...v.errors };
    if (mode !== 'GLOBAL' && !orgId) errs.org = 'Choisissez un organisme.';
    setErrors(errs);
    if (Object.keys(errs).length || !parsed.ok) return;
    if (isPay) {
      const p = await fetchPreview(parsed.raw, orgId);
      if (!p) return;
    }
    setStep('confirm');
  };

  const confirm = async () => {
    if (busy || !parsed.ok) return;
    if (isPay && !preview) return;
    if (isPay) preparePaymentSound();
    refId.current ??= newReference(); // même UUID conservé pour chaque nouvel essai du même contenu
    setBusy(true);
    setFormErr(null);
    try {
      await createOp.mutateAsync({
        id: clientId,
        data: {
          type: mode === 'AJOUT' ? 'AJOUT_MONTANT' : typeKey,
          montant: parsed.raw,
          ...(isPay ? { encaisseur: encaisseur as Collector } : {}),
          ...(mode === 'GLOBAL' ? {} : { organismeId: orgId }),
          date,
          ...(note.trim() ? { note: note.trim() } : {}),
          referenceUnique: refId.current,
          expectedVersion: isPay && preview ? preview.version : expectedVersion,
        },
      });
      if (isPay) playPaymentSound(refId.current!);
      await refreshAll(qc);
      toast({ tone: 'ok', title: mode === 'AJOUT' ? 'Montant ajouté' : 'Paiement enregistré', desc: formatChf(parsed.centimes) });
      onClose();
    } catch (e) {
      if (apiStatus(e) === 409) {
        await reconfirm();
        setConflict(true);
        if (isPay) await fetchPreview(parsed.raw, orgId);
      } else setFormErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'GLOBAL' ? 'Paiement global' : mode === 'AJOUT' ? 'Ajouter un montant' : 'Paiement ciblé';

  if (mode !== 'GLOBAL' && choices.length === 0) {
    return (
      <Sheet title={title} onClose={onClose}>
        <Notice tone="info">{mode === 'AJOUT' ? 'Aucun organisme actif dans ce dossier.' : 'Aucun organisme n’a de reste dû : rien à payer.'}</Notice>
        <Btn label="Fermer" onPress={onClose} />
      </Sheet>
    );
  }

  return (
    <Sheet
      title={title}
      subtitle={mode === 'GLOBAL' ? 'Réparti au prorata des restes dus (calcul serveur).' : `${dossier.client.prenom} ${dossier.client.nom}`}
      onClose={onClose}
      dismissable={!busy}
      testID="sheet-payment"
    >
      {step === 'form' ? (
        <>
          {mode !== 'GLOBAL' && (
            <View style={{ gap: 8 }}>
              <Label color={errors.org ? C.destructive : undefined}>Organisme</Label>
              {choices.map((o) => (
                <OptionRow
                  key={o.id}
                  label={o.nom}
                  sub={`Reste ${formatChf(o.remainingCentimes)}`}
                  active={orgId === o.id}
                  onPress={() => { setOrgId(o.id); edited(); }}
                  testID={`select-organisme-${o.id}`}
                />
              ))}
              {errors.org ? <Txt size={13} color={C.destructive}>{errors.org}</Txt> : null}
            </View>
          )}
          {settleValue !== undefined && (
            <Row label={mode === 'GLOBAL' ? 'Reste dû total' : 'Reste dû actuel'} testID="text-current-remaining">
              <Money value={settleValue} size={15} color={C.debt} />
            </Row>
          )}
          <Field
            label="Montant (CHF)"
            value={montant}
            onChangeText={(t) => { setMontant(t); edited(); }}
            keyboardType="decimal-pad"
            big
            autoFocus={mode === 'GLOBAL' || !!orgId}
            error={errors.montant}
            hint="Ex. 1234.50, 1234,5 ou 1'234.50"
            testID="input-montant"
          />
          {isPay && settleValue !== undefined && isPositive(settleValue) && (
            <Btn compact variant="outline" icon="check-circle" label={mode === 'GLOBAL' ? 'Tout solder' : 'Solder cet organisme'} onPress={() => { setMontant(centimesToRaw(settleValue)); edited(); }} testID="button-settle" />
          )}
          {isPay && <CollectorPicker value={encaisseur} error={errors.encaisseur} onChange={(v) => { setEncaisseur(v); edited(); }} />}
          <DateField label="Date" value={date} onChange={(v) => { setDate(v); edited(); }} today={today} error={errors.date} testID="input-date" />
          <Field label="Note (facultatif)" value={note} onChangeText={(t) => { setNote(t); edited(); }} maxLength={2000} error={errors.note} testID="input-note" />
          {warn && <Notice tone="warn">{warn}</Notice>}
          {isPay && parsed.ok && (
            <View style={{ gap: 8 }} accessibilityLiveRegion="polite">
              <Label>Aperçu serveur</Label>
              {previewing && !preview && <Skeleton h={60} />}
              {previewErr && <Notice tone="error">{previewErr}</Notice>}
              {preview && !previewErr && <PreviewList preview={preview} />}
            </View>
          )}
          <Actions>
            <Btn label="Continuer" onPress={() => void next()} loading={previewing} testID="button-continue" />
            <Btn label="Annuler" variant="outline" onPress={onClose} />
          </Actions>
        </>
      ) : (
        <View style={{ gap: 14 }} testID="step-confirm">
          {conflict && (
            <Notice tone="warn">
              {`Le dossier a changé pendant la saisie (autre appareil).${isPay ? ' L’aperçu a été recalculé.' : ''} Vérifiez les chiffres puis confirmez à nouveau. Rien n’a été enregistré.`}
            </Notice>
          )}
          {formErr && <Notice tone="error">{`${formErr} Vous pouvez réessayer : la même référence sera réutilisée, sans doublon.`}</Notice>}
          {isPay && !preview && <Notice tone="error">{previewErr ?? 'La répartition doit être recalculée avant de confirmer.'}</Notice>}
          {isPay && preview ? (
            <>
              <Card accent={C.primary} style={{ gap: 6 }}>
                <Label>Paiement de</Label>
                <Money value={preview.totalCentimes} size={28} color={C.settled} testID="text-confirm-total" />
                <Row label="Avant"><Money value={preview.beforeCentimes} size={14} /></Row>
                <Row label="Après"><Money value={preview.afterCentimes} size={14} /></Row>
              </Card>
              <PreviewList preview={preview} />
            </>
          ) : (
            !isPay &&
            parsed.ok && (
              <Card accent={C.primary} style={{ gap: 6 }}>
                <Label>Ajout de dette</Label>
                <Money value={parsed.centimes} size={28} color={C.debt} />
                <Txt size={14}>sur <Txt w="b" size={14}>{org?.nom}</Txt></Txt>
                <Txt size={12} muted>La dette de cet organisme augmentera. Tracé dans l’historique.</Txt>
              </Card>
            )
          )}
          {isPay && (
            <Row label="Encaissé par" testID="text-confirm-encaisseur">
              <Txt w="b">{collectorLabel(encaisseur)}</Txt>
            </Row>
          )}
          <Row label="Date"><Txt w="s">{formatDate(date)}</Txt></Row>
          {note.trim() ? <Row label="Note"><Txt size={13} style={{ flexShrink: 1 }}>{note.trim()}</Txt></Row> : null}
          {warn && <Notice tone="warn">{warn}</Notice>}
          <Actions>
            <Btn label={conflict ? 'Confirmer à nouveau' : 'Confirmer'} onPress={confirm} loading={busy} disabled={isPay && !preview} testID="button-confirm" />
            <Btn label="Modifier" variant="outline" disabled={busy} onPress={() => { setStep('form'); setConflict(false); }} testID="button-back-edit" />
          </Actions>
        </View>
      )}
    </Sheet>
  );
}

// ======================= Journal : annulation / correction =======================
export function CancelOperationSheet({ dossier, op, onClose }: { dossier: Dossier; op: Operation; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const cancel = useCancelOperation();
  const [motif, setMotif] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const go = async () => {
    if (cancel.isPending) return;
    const v = validate(z.object({ motif: motifSchema }), { motif });
    if (!v.ok) return setError(v.errors.motif);
    setError(undefined);
    setErr(null);
    try {
      await cancel.mutateAsync({ id: op.id, data: { motif: v.data.motif, expectedVersion } });
      await refreshAll(qc);
      toast({ tone: 'ok', title: 'Opération annulée', desc: 'Elle reste visible dans l’historique.' });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setStale(true);
      }
      setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title="Annuler cette opération ?" subtitle="Irréversible : elle restera visible, barrée." onClose={onClose} dismissable={!cancel.isPending}>
      <Card style={{ gap: 4 }}>
        <Txt size={13} muted>{TYPE_LABEL[op.type]} du {formatDate(op.date)}</Txt>
        <Money value={op.totalCentimes.replace('-', '')} size={20} />
        {op.encaisseur ? <Txt size={12} muted>Encaissé par : {collectorLabel(op.encaisseur)}</Txt> : null}
      </Card>
      <Field label="Motif de l'annulation" value={motif} onChangeText={setMotif} multiline maxLength={1000} autoFocus error={error} testID="input-motif" />
      {err && <Notice tone={stale ? 'warn' : 'error'}>{`${err}${stale ? ' Données actualisées : vérifiez puis confirmez à nouveau.' : ''}`}</Notice>}
      <Actions>
        <Btn label={stale ? 'Confirmer à nouveau' : 'Annuler l’opération'} variant="danger" onPress={go} loading={cancel.isPending} testID="button-confirm-cancel" />
        <Btn label="Garder l'opération" variant="outline" onPress={onClose} disabled={cancel.isPending} />
      </Actions>
    </Sheet>
  );
}

const replaceSchema = z.object({ encaisseur: encaisseurSchema, montant: amountSchema, date: dateSchema, note: noteSchema, motif: motifSchema });

export function ReplacePaymentSheet({ dossier, op, today, onClose }: { dossier: Dossier; op: Operation; today: string; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { expectedVersion, reconfirm } = useConfirmedVersion(dossier.client.id, dossier.client.version);
  const rep = useReplacePayment();
  const [montant, setMontant] = useState(centimesToRaw(op.totalCentimes));
  const [date, setDate] = useState(op.date);
  const [note, setNote] = useState(op.note ?? '');
  const [motif, setMotif] = useState('');
  const [encaisseur, setEncaisseur] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [err, setErr] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const ref = useRef<string | null>(null);
  const touch = () => {
    ref.current = null;
    setStale(false);
    setErr(null);
  };
  const warn = dateWarning(date, today, dossier.client.createdAt);
  const parsed = parseAmount(montant);
  const next = () => {
    const v = validate(replaceSchema, { encaisseur, montant, date, note, motif });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setStep('confirm');
  };
  const go = async () => {
    if (rep.isPending) return;
    const v = validate(replaceSchema, { encaisseur, montant, date, note, motif });
    if (!v.ok || !parsed.ok) return;
    ref.current ??= newReference();
    setErr(null);
    try {
      await rep.mutateAsync({
        id: op.id,
        data: {
          encaisseur: v.data.encaisseur,
          montant: parsed.raw,
          date: v.data.date,
          ...(v.data.note.trim() ? { note: v.data.note.trim() } : {}),
          motif: v.data.motif,
          referenceUnique: ref.current,
          expectedVersion,
        },
      });
      await refreshAll(qc);
      toast({ tone: 'ok', title: 'Paiement corrigé', desc: 'L’ancien paiement est annulé et remplacé.' });
      onClose();
    } catch (ex) {
      if (apiStatus(ex) === 409) {
        await reconfirm();
        setStale(true);
      }
      setErr(errorMessage(ex));
    }
  };
  return (
    <Sheet title="Corriger ce paiement" subtitle={`${TYPE_LABEL[op.type]} du ${formatDate(op.date)} — même type et organisme(s)`} onClose={onClose} dismissable={!rep.isPending}>
      {step === 'form' ? (
        <>
          <CollectorPicker value={encaisseur} error={errors.encaisseur} onChange={(v) => { setEncaisseur(v); touch(); }} />
          <Field label="Montant (CHF)" value={montant} onChangeText={(t) => { setMontant(t); touch(); }} keyboardType="decimal-pad" big error={errors.montant} testID="input-replace-montant" />
          <DateField label="Date" value={date} onChange={(v) => { setDate(v); touch(); }} today={today} error={errors.date} testID="input-replace-date" />
          <Field label="Note (facultatif)" value={note} onChangeText={(t) => { setNote(t); touch(); }} maxLength={2000} error={errors.note} />
          <Field label="Motif de la correction" value={motif} onChangeText={(t) => { setMotif(t); touch(); }} maxLength={1000} error={errors.motif} testID="input-replace-motif" />
          {warn && <Notice tone="warn">{warn}</Notice>}
          <Actions>
            <Btn label="Continuer" onPress={next} testID="button-replace-next" />
            <Btn label="Annuler" variant="outline" onPress={onClose} />
          </Actions>
        </>
      ) : (
        <>
          <Notice tone="warn">{`Irréversible : l'ancien paiement de ${formatChf(op.totalCentimes.replace('-', ''))} sera annulé (visible, barré) et un nouveau paiement créé.`}</Notice>
          {stale && <Notice tone="warn">Le dossier a changé et a été actualisé. Vérifiez puis confirmez à nouveau.</Notice>}
          {err && <Notice tone="error">{err}</Notice>}
          <Card style={{ gap: 8 }}>
            <Row label="Nouveau montant">{parsed.ok ? <Money value={parsed.centimes} size={15} color={C.settled} /> : <Txt>—</Txt>}</Row>
            <Row label="Encaissé par"><Txt w="b">{collectorLabel(encaisseur)}</Txt></Row>
            <Row label="Date"><Txt w="s">{formatDate(date)}</Txt></Row>
            <Row label="Motif"><Txt size={13} style={{ flexShrink: 1 }}>{motif.trim()}</Txt></Row>
          </Card>
          <Actions>
            <Btn label={stale ? 'Confirmer à nouveau' : 'Annuler et recréer'} onPress={go} loading={rep.isPending} testID="button-confirm-replace" />
            <Btn label="Retour" variant="outline" onPress={() => setStep('form')} disabled={rep.isPending} />
          </Actions>
        </>
      )}
    </Sheet>
  );
}
