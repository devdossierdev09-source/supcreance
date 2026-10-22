import React, { type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '@/components/ui';
import colorsConst from '@/constants/colors';
import { formatDate } from '@/lib/core';
import { useToday } from '@/lib/auth';

const C = colorsConst.light;

/** En-tête de terminal pour les onglets : invite + titre + date du jour Europe/Zurich. */
export function TabHeader({ title, right }: { title: string; right?: ReactNode }) {
  const insets = useSafeAreaInsets();
  const today = useToday();
  return (
    <View
      style={{
        paddingTop: insets.top + (Platform.OS === 'web' ? 67 : 10),
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        backgroundColor: C.background,
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt size={11} muted>{`créances@chf:~$ ${formatDate(today)}`}</Txt>
        <Txt w="b" size={24} color={C.primary}>{title}</Txt>
      </View>
      {right}
    </View>
  );
}
