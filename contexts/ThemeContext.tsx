import React, { createContext, useContext, useMemo, useEffect, useState, PropsWithChildren } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';
import { useAuth } from './AuthContext';

type Theme = 'light' | 'dark';

type ThemeContextType = {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: PropsWithChildren) {
  const { profile } = useAuth();
  const systemColorScheme = useRNColorScheme();

  // Determinar el tema basado en:
  // 1. Preferencia del perfil (dark_mode) desde la base de datos - PRIORIDAD
  // 2. Tema del sistema como fallback
  const theme = useMemo(() => {
    // Si hay un perfil con preferencia de tema guardada en la BD, usarla
    if (profile?.dark_mode !== undefined && profile.dark_mode !== null) {
      return profile.dark_mode ? 'dark' : 'light';
    }
    // Fallback al tema del sistema si no hay perfil o no tiene preferencia
    return (systemColorScheme ?? 'light') as Theme;
  }, [profile?.dark_mode, systemColorScheme]);

  const isDark = theme === 'dark';

  const value = useMemo(
    () => ({
      theme,
      isDark,
      // Esta función ya no se usa, el tema siempre viene de la BD
      setTheme: (_newTheme: Theme) => {
        // No hacer nada, el tema se actualiza desde la BD
        console.warn('setTheme no debe usarse directamente. Use updateDarkMode en AuthContext.');
      },
    }),
    [theme, isDark]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

