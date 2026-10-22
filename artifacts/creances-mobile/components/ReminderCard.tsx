import React from 'react';
import { Linking, Switch, View } from 'react-native';
import { Btn, Card, Label, Notice, Row, Txt } from '@/components/ui';
import colorsConst from '@/constants/colors';
import { isExpoGo } from '@/lib/notifications';
import { useReminders } from '@/lib/reminders';

const C = colorsConst.light;

const fmtHorizon = (ms: number) =>
  new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(ms));

export function ReminderCard() {
  const r = useReminders();
  const on = r.enabled && r.permission === 'granted';
  return (
    <Card style={{ gap: 10 }} testID="card-reminders-settings">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Label color={C.primary}>Rappels 09:00 et 17:00</Label>
          <Txt size={12} muted>Heure de Zurich · réglage de cet appareil</Txt>
        </View>
        <Switch
          testID="switch-reminders"
          value={on}
          disabled={!r.ready || r.busy || !r.supported}
          onValueChange={(v) => void (v ? r.enable() : r.disable())}
          trackColor={{ false: C.muted, true: C.primary }}
          thumbColor={on ? C.primaryForeground : C.mutedForeground}
          accessibilityLabel="Activer les rappels"
        />
      </View>
      {!r.supported ? (
        <Notice tone="info">Indisponible dans l’aperçu web : utilisez l’application Android.</Notice>
      ) : (
        <>
          <Txt size={12} muted>
            Rappels programmés localement sur l’appareil, pas des soldes en direct : application fermée, le texte reste générique et sans montant. Aucune notification serveur.
          </Txt>
          {on && (
            <Row label="Programmés jusqu’au">
              <Txt w="s" size={13} testID="text-reminder-horizon">{r.horizon ? fmtHorizon(r.horizon) : '—'}</Txt>
            </Row>
          )}
          {on && <Txt size={11} muted>Prolongé automatiquement (~30 jours) à chaque ouverture de l’application. Les rappels du jour sont omis si rien ne reste dû au moment de l’ouverture.</Txt>}
          {on && <Txt size={11} muted>{isExpoGo ? 'Expo Go : son standard. Le son personnalisé n’existe que dans l’application compilée.' : 'Son personnalisé de l’application.'}</Txt>}
          {r.permission === 'denied' && (
            <>
              <Notice tone="warn">Notifications refusées : aucun rappel ne sera affiché. Autorisez-les dans les réglages du système.</Notice>
              <Btn compact variant="outline" label="Ouvrir les réglages" onPress={() => void Linking.openSettings()} testID="button-open-settings" />
            </>
          )}
          {r.error && <Notice tone="error">{r.error}</Notice>}
          {on && <Btn compact variant="ghost" label="Reprogrammer maintenant" onPress={() => void r.renew()} loading={r.busy} testID="button-renew-reminders" />}
        </>
      )}
    </Card>
  );
}
