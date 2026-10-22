import colors from '@/constants/colors';

/** Thème forcé noir/vert (pas de variation selon le système). */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}

export type Palette = ReturnType<typeof useColors>;
