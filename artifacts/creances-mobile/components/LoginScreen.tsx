import React, { useState } from 'react';
import { Image, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSessionQueryKey, useLogin } from '@workspace/api-client-react';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { Btn, Field, IconBtn, Notice, Txt } from '@/components/ui';
import colorsConst from '@/constants/colors';
import { dismissStorageError, storeToken, useStorageError } from '@/lib/auth';
import { apiStatus, errorMessage } from '@/lib/core';

const C = colorsConst.light;

export default function LoginScreen({ expired }: { expired?: boolean }) {
  const qc = useQueryClient();
  const insets = useSafeAreaInsets();
  const login = useLogin();
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const storageErr = useStorageError();

  const submit = async () => {
    if (login.isPending) return;
    if (!password) return setErr('Saisissez le mot de passe.');
    setErr(null);
    try {
      const info = await login.mutateAsync({ data: { password, mobile: true } });
      if (!info.authenticated) return setErr('Connexion refusée.');
      if (!info.token) return setErr('Le serveur n’a pas fourni de jeton mobile. Connexion impossible sur cet appareil.');
      try {
        await storeToken(info.token);
      } catch {
        return setErr('Le coffre sécurisé de l’appareil refuse d’enregistrer la session. Connexion annulée : rien n’est conservé. Réessayez ou libérez de l’espace.');
      }
      setPassword('');
      // Le jeton n'est jamais conservé dans le cache de requêtes.
      qc.setQueryData(getGetSessionQueryKey(), { ...info, token: undefined });
    } catch (e) {
      setErr(apiStatus(e) === 401 ? 'Mot de passe incorrect.' : errorMessage(e));
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
      <KeyboardAwareScrollViewCompat
        bottomOffset={40}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          padding: 24,
          paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 24),
          paddingBottom: insets.bottom + 34,
          gap: 22,
        }}
      >
        <View style={{ gap: 14 }}>
          <Image source={require('../assets/images/creances-icon.png')} style={{ width: 72, height: 72, borderRadius: 2, borderWidth: 1, borderColor: C.border }} accessibilityIgnoresInvertColors />
          <Txt w="b" size={30} color={C.primary}>CRÉANCES·CHF</Txt>
          <Txt size={14} muted>{'> journal partagé — accès commun\n> montants exacts au centime'}</Txt>
        </View>
        {storageErr && (
          <Notice tone="error" testID="notice-storage-error">
            <Txt size={13} color={C.destructive}>{storageErr}</Txt>
          </Notice>
        )}
        {storageErr && <Btn compact variant="ghost" label="Masquer l’alerte" onPress={dismissStorageError} testID="button-dismiss-storage-error" />}
        {expired && <Notice tone="warn" testID="notice-expired">Session expirée après inactivité. Reconnectez-vous.</Notice>}
        <Field
          label="Mot de passe"
          value={password}
          onChangeText={(t) => { setPassword(t); setErr(null); }}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          error={err ?? undefined}
          testID="input-password"
          right={<IconBtn icon={show ? 'eye-off' : 'eye'} label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'} onPress={() => setShow(!show)} testID="button-toggle-password" />}
        />
        <Btn label="Se connecter" icon="log-in" onPress={() => void submit()} loading={login.isPending} testID="button-login" />
        <Txt size={11} muted>Déconnexion automatique après 30 minutes d’inactivité. Le mot de passe n’est jamais enregistré sur l’appareil.</Txt>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}
