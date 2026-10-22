import React, { useState } from 'react';
import { Platform, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { saveAndShare, ShareUnavailableError } from '@/lib/files';
import { exportBackup, getGetSessionQueryKey, useImportBackup, useLogout, type BackupDocument, type ImportResult } from '@workspace/api-client-react';
import { z } from 'zod';
import { Actions, Btn, Card, Label, Notice, Row, Sheet, Txt, useToast } from '@/components/ui';
import { TabHeader } from '@/components/Screen';
import { ReminderCard } from '@/components/ReminderCard';
import colorsConst from '@/constants/colors';
import { clearToken, dismissStorageError, LOGGED_OUT, useSessionInfo, useStorageError } from '@/lib/auth';
import { errorMessage, formatDate, isSessionKey, refreshAll } from '@/lib/core';

const C = colorsConst.light;

const docSchema = z.object({
  format: z.literal('creances-chf-v1'),
  exportedAt: z.string(),
  clients: z.array(z.record(z.string(), z.unknown())),
  organismes: z.array(z.record(z.string(), z.unknown())),
  operations: z.array(z.record(z.string(), z.unknown())),
  lignes: z.array(z.record(z.string(), z.unknown())),
  relances: z.array(z.record(z.string(), z.unknown())).optional(),
});

export default function SettingsScreen() {
  const qc = useQueryClient();
  const toast = useToast();
  const session = useSessionInfo();
  const logout = useLogout();
  const imp = useImportBackup();
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<{ doc: BackupDocument; name: string } | null>(null);
  const [fileErr, setFileErr] = useState<string | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const storageErr = useStorageError();

  const doExport = async () => {
    if (exporting) return;
    setExporting(true);
    setExportErr(null);
    try {
      const doc = await exportBackup();
      const json = JSON.stringify(doc, null, 2);
      const name = `creances-chf-sauvegarde-${session.today || 'export'}.json`;
      await saveAndShare(name, 'application/json', json, 'Enregistrer la sauvegarde');
      toast({ tone: 'ok', title: 'Sauvegarde exportée', desc: `${doc.clients.length} client(s), ${doc.operations.length} opération(s).` });
    } catch (e) {
      setExportErr(e instanceof ShareUnavailableError ? 'Le partage de fichiers n’est pas disponible sur cet appareil.' : errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const pick = async () => {
    if (picking) return;
    setPicking(true);
    setFileErr(null);
    setResult(null);
    setImportErr(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const json: unknown = JSON.parse(text);
      if (!docSchema.safeParse(json).success) throw new Error('format');
      setPending({ doc: json as BackupDocument, name: asset.name });
    } catch {
      setFileErr("Ce fichier n'est pas une sauvegarde Créances · CHF valide.");
    } finally {
      setPicking(false);
    }
  };

  const doImport = async () => {
    if (!pending || imp.isPending) return;
    setImportErr(null);
    try {
      const r = await imp.mutateAsync({ data: pending.doc });
      await refreshAll(qc);
      setResult(r);
      setPending(null);
      toast({ tone: 'ok', title: 'Import terminé', desc: r.message });
    } catch (e) {
      setImportErr(errorMessage(e));
    }
  };

  const doLogout = async () => {
    try {
      await logout.mutateAsync();
    } catch {
      // Même si le serveur est injoignable, l'appareil oublie le jeton.
    }
    // En cas d'échec, clearToken signale l'erreur (affichée à l'écran de connexion) ; le jeton mémoire est déjà oublié.
    await clearToken();
    qc.removeQueries({ predicate: (q) => !isSessionKey(q.queryKey) });
    qc.setQueryData(getGetSessionQueryKey(), LOGGED_OUT);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <TabHeader title="Réglages" />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Platform.OS === 'web' ? 120 : 40 }}>
        {storageErr && (
          <Notice tone="error" testID="notice-storage-error">
            <Txt size={13} color={C.destructive}>{storageErr}</Txt>
          </Notice>
        )}
        {storageErr && <Btn compact variant="ghost" label="Masquer l’alerte" onPress={dismissStorageError} />}
        <Card style={{ gap: 8 }}>
          <Label color={C.primary}>Session</Label>
          <Row label="Date (Europe/Zurich)"><Txt w="b">{formatDate(session.today)}</Txt></Row>
          <Row label="Déconnexion après"><Txt w="b">{`${session.inactivityMinutes} min d’inactivité`}</Txt></Row>
          <Row label="Stockage du jeton"><Txt w="s" size={13}>{Platform.OS === 'web' ? 'Mémoire (aperçu web)' : 'Coffre sécurisé Android'}</Txt></Row>
        </Card>

        <ReminderCard />

        <Card style={{ gap: 12 }}>
          <Label color={C.primary}>Sauvegarde JSON</Label>
          <Txt size={13} muted>Contient des données personnelles. Le fichier est remis au système de partage : choisissez un emplacement sûr.</Txt>
          <Btn label="Exporter la sauvegarde" icon="upload" variant="outline" onPress={doExport} loading={exporting} testID="button-export-backup" />
          {exportErr && <Notice tone="error">{exportErr}</Notice>}
          <Txt size={13} muted>L’import fusionne : il ajoute sans jamais supprimer ni écraser. Une collision refuse tout l’import.</Txt>
          <Btn label="Importer un fichier" icon="download" variant="outline" onPress={pick} loading={picking} testID="button-import-backup" />
          {fileErr && <Notice tone="error">{fileErr}</Notice>}
          {result && <Notice tone="ok" testID="text-import-result">{`${result.message} — ${result.clientsImported} client(s), ${result.operationsImported} opération(s).`}</Notice>}
        </Card>

        <Btn label="Se déconnecter" icon="log-out" variant="dangerOutline" onPress={() => setConfirmLogout(true)} testID="button-logout" />
        <Txt size={11} muted style={{ textAlign: 'center' }}>Créances · CHF — application Android</Txt>
      </ScrollView>

      {pending && (
        <Sheet title="Importer cette sauvegarde ?" subtitle={pending.name} onClose={() => setPending(null)} dismissable={!imp.isPending}>
          <Card style={{ gap: 6 }}>
            <Row label="Exportée le"><Txt w="s" size={13}>{pending.doc.exportedAt.slice(0, 10)}</Txt></Row>
            <Row label="Clients"><Txt w="b">{pending.doc.clients.length}</Txt></Row>
            <Row label="Organismes"><Txt w="b">{pending.doc.organismes.length}</Txt></Row>
            <Row label="Opérations"><Txt w="b">{pending.doc.operations.length}</Txt></Row>
          </Card>
          <Notice tone="warn">Fusion par identifiants : rien n’est supprimé ni écrasé. Un ancien dossier supprimé peut être recréé.</Notice>
          {importErr && <Notice tone="error">{importErr}</Notice>}
          <Actions>
            <Btn label="Importer" onPress={doImport} loading={imp.isPending} testID="button-confirm-import" />
            <Btn label="Annuler" variant="outline" onPress={() => setPending(null)} disabled={imp.isPending} />
          </Actions>
        </Sheet>
      )}
      {confirmLogout && (
        <Sheet title="Se déconnecter ?" onClose={() => setConfirmLogout(false)}>
          <Txt size={14} muted>La session est révoquée sur le serveur et le jeton effacé de l’appareil.</Txt>
          <Actions>
            <Btn label="Se déconnecter" variant="danger" onPress={doLogout} loading={logout.isPending} testID="button-confirm-logout" />
            <Btn label="Rester connecté" variant="outline" onPress={() => setConfirmLogout(false)} />
          </Actions>
        </Sheet>
      )}
    </View>
  );
}
