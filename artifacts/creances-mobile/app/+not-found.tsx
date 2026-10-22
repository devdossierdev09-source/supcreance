import { router, Stack } from 'expo-router';
import { View } from 'react-native';
import { Btn, Empty } from '@/components/ui';
import colorsConst from '@/constants/colors';

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: colorsConst.light.background, padding: 16, justifyContent: 'center' }}>
      <Stack.Screen options={{ title: 'Introuvable' }} />
      <Empty icon="alert-circle" title="Écran introuvable" action={<Btn label="Retour aux clients" onPress={() => router.replace('/')} />} />
    </View>
  );
}
