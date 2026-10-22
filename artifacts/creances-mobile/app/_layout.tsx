import React, { useEffect, useRef, useState } from 'react';
import { AppState, Platform, View } from 'react-native';
import { focusManager, MutationCache, QueryCache, QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
  useFonts,
} from '@expo-google-fonts/ibm-plex-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { getGetSessionQueryKey, getSession, setAuthTokenGetter, setBaseUrl, useGetSession } from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState, F, SkeletonList, ToastProvider } from '@/components/ui';
import LoginScreen from '@/components/LoginScreen';
import colorsConst from '@/constants/colors';
import { ActivityContext, clearToken, getToken, hydrateToken, LOGGED_OUT, SessionContext } from '@/lib/auth';
import { apiStatus, isSessionKey } from '@/lib/core';
import { ReminderProvider } from '@/lib/reminders';

const C = colorsConst.light;

// API : même backend que le web, URL absolue + jeton Bearer fourni avant chaque requête.
setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);
setAuthTokenGetter(async () => getToken());

SplashScreen.preventAutoHideAsync();

function on401(e: unknown) {
  if (apiStatus(e) === 401) void signOutLocally();
}
async function signOutLocally() {
  await clearToken();
  queryClient.removeQueries({ predicate: (q) => !isSessionKey(q.queryKey) });
  queryClient.setQueryData(getGetSessionQueryKey(), LOGGED_OUT);
}

const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({ onError: on401 }),
  mutationCache: new MutationCache({ onError: on401 }),
  defaultOptions: {
    queries: { staleTime: 5_000, retry: (n, e) => apiStatus(e) !== 401 && apiStatus(e) !== 404 && n < 2 },
    mutations: { retry: false },
  },
});

// Rafraîchit au retour au premier plan (lecture seule, ne compte pas comme activité).
if (Platform.OS !== 'web') {
  focusManager.setEventListener((handle) => {
    const sub = AppState.addEventListener('change', (st) => handle(st === 'active'));
    return () => sub.remove();
  });
}

function Gate() {
  const qc = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    hydrateToken().finally(() => setHydrated(true));
  }, []);
  const s = useGetSession({ query: { queryKey: getGetSessionQueryKey(), enabled: hydrated, refetchInterval: 60_000, retry: false } });
  const hadSession = useRef(false);
  if (s.data?.authenticated) hadSession.current = true;
  const authed = !!s.data?.authenticated;

  useEffect(() => {
    if (s.data && !s.data.authenticated) {
      void clearToken();
      qc.removeQueries({ predicate: (q) => !isSessionKey(q.queryKey) });
    }
  }, [s.data, qc]);

  // Activité réelle uniquement (toucher), limitée à 1 ping / 60 s. Le polling n'envoie jamais cet en-tête.
  const lastPing = useRef(Date.now());
  const onTouch = () => {
    if (!authed) return;
    const now = Date.now();
    if (now - lastPing.current < 60_000) return;
    lastPing.current = now;
    getSession({ headers: { 'x-user-activity': '1' } })
      .then((info) => qc.setQueryData(getGetSessionQueryKey(), { ...info, token: undefined }))
      .catch((e) => on401(e));
  };

  if (!hydrated || s.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, padding: 24, paddingTop: 120 }}>
        <SkeletonList n={3} />
      </View>
    );
  }
  if (apiStatus(s.error) === 401 || (s.data && !s.data.authenticated)) {
    return <LoginScreen expired={hadSession.current} />;
  }
  if (s.error && !s.data) {
    return (
      <View style={{ flex: 1, backgroundColor: C.background, padding: 24, paddingTop: 120 }}>
        <ErrorState error={s.error} onRetry={() => s.refetch()} />
      </View>
    );
  }
  return (
    <SessionContext.Provider value={s.data ?? LOGGED_OUT}>
      <ActivityContext.Provider value={onTouch}>
      <ReminderProvider>
      <View style={{ flex: 1, backgroundColor: C.background }} onTouchStart={onTouch}>
        <Stack
          screenOptions={{
            headerBackTitle: 'Retour',
            headerStyle: { backgroundColor: C.background },
            headerTintColor: C.primary,
            headerTitleStyle: { fontFamily: F.b, color: C.foreground, fontSize: 16 },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: C.background },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="client/[id]" options={{ title: 'Dossier' }} />
        </Stack>
      </View>
      </ReminderProvider>
      </ActivityContext.Provider>
    </SessionContext.Provider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <GestureHandlerRootView style={{ flex: 1, backgroundColor: C.background }}>
            <KeyboardProvider>
              <ToastProvider>
                <StatusBar style="light" />
                <Gate />
              </ToastProvider>
            </KeyboardProvider>
          </GestureHandlerRootView>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
