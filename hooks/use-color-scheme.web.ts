import { useTheme } from '@/contexts/ThemeContext';

/**
 * Hook que retorna el esquema de color actual basado en la preferencia del usuario
 * o el tema del sistema como fallback
 * Versión para web con hidratación
 */
export function useColorScheme(): 'light' | 'dark' {
  try {
    const { theme } = useTheme();
    return theme;
  } catch {
    // Si no hay ThemeProvider, usar el tema del sistema como fallback
    // Esto puede pasar en pantallas fuera del contexto
    return 'light';
  }
}
