import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { AvatarLayer } from '@/app/data/avatarCatalog';
import { catalog_tmplx01 } from '@/app/data/avatarCatalog';
import { AvatarPreview } from '@/components/AvatarPreview';
import { FabChat } from '@/components/FabChat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

const MAX_LEVEL = 100;

/**
 * Calcula el XP del nivel actual (mínimo para estar en ese nivel)
 * Fórmula: XP_total = 100 * (N-1) * N / 2
 * Nivel 1: 0 puntos
 * Nivel 2: 100 puntos (100 * 1 * 2 / 2)
 * Nivel 3: 300 puntos (100 * 2 * 3 / 2)
 * Nivel 4: 600 puntos (100 * 3 * 4 / 2)
 * ...
 * Nivel 100: 495,000 puntos (100 * 99 * 100 / 2)
 */
function getXPForCurrentLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > MAX_LEVEL) return 100 * (MAX_LEVEL - 1) * MAX_LEVEL / 2;
  return 100 * (level - 1) * level / 2;
}

/**
 * Calcula el XP necesario para el siguiente nivel
 * Fórmula: XP_total_siguiente = 100 * N * (N+1) / 2
 */
function getXPForNextLevel(level: number): number {
  if (level >= MAX_LEVEL) return 0; // No hay siguiente nivel
  return 100 * level * (level + 1) / 2;
}

/**
 * Calcula el porcentaje de progreso hacia el siguiente nivel
 * Si está en nivel máximo, retorna 0 (sin progreso)
 */
function getProgressPercentage(points: number, level: number): number {
  if (level >= MAX_LEVEL) return 0; // Nivel máximo, sin progreso
  
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpInCurrentLevel = points - currentLevelXP;
  const xpNeededForNext = nextLevelXP - currentLevelXP;
  
  if (xpNeededForNext <= 0) return 0;
  
  const percentage = Math.min(100, Math.max(0, (xpInCurrentLevel / xpNeededForNext) * 100));
  return percentage;
}

/**
 * Obtiene el nombre del nivel (muestra "Nivel Máximo" para nivel 100)
 */
function getLevelDisplayName(level: number): string {
  if (level >= MAX_LEVEL) return 'Nivel Máximo';
  return `Nivel ${level}`;
}

export function ProgressScreen() {
  const { profile, refreshProfile } = useAuth();
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  }, [refreshProfile]);

  // Avatar seleccionado
  const avatarSelected = useMemo(() => {
    if (profile?.avatar_template_id === 'tmplx01') {
      const defaults = catalog_tmplx01.defaults;
      const cfg = (profile?.avatar_config as Record<AvatarLayer, string> | null) ?? null;
      return {
        skin_base: cfg?.skin_base ?? defaults.skin_base,
        skin_overlay: cfg?.skin_overlay ?? defaults.skin_overlay,
        eyes: cfg?.eyes ?? defaults.eyes,
        outline: cfg?.outline ?? defaults.outline,
      };
    }
    return null;
  }, [profile?.avatar_template_id, profile?.avatar_config]);

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Cargando progreso...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const level = Math.min(profile.level ?? 1, MAX_LEVEL);
  const points = profile.points ?? 0;
  const coins = Math.floor(points / 10); // Asumiendo 1 moneda por cada 10 puntos

  const isMaxLevel = level >= MAX_LEVEL;
  const currentLevelXP = getXPForCurrentLevel(level);
  const nextLevelXP = getXPForNextLevel(level);
  const xpInCurrentLevel = points - currentLevelXP;
  const xpNeededForNext = isMaxLevel ? 0 : (nextLevelXP - currentLevelXP);
  const progressPercentage = getProgressPercentage(points, level);
  const xpRemaining = isMaxLevel ? 0 : Math.max(0, xpNeededForNext - xpInCurrentLevel);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        
        {/* Header con Avatar */}
        <ThemedView style={styles.header}>
          {avatarSelected ? (
            <View style={styles.avatarContainer}>
              <AvatarPreview catalog={catalog_tmplx01} selected={avatarSelected} size={120} />
            </View>
          ) : null}
          <ThemedText type="title" style={styles.userName}>
            {profile.name ?? 'Explorador'}
          </ThemedText>
          <ThemedText style={styles.userEmail}>{profile.email}</ThemedText>
        </ThemedView>

        {/* Nivel Principal */}
        <ThemedView style={styles.levelCard}>
          <LinearGradient
            colors={isDark ? ['#1a1a2e', '#16213e'] : ['#667eea', '#764ba2']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.levelGradient}>
            <ThemedText style={styles.levelLabel}>NIVEL ACTUAL</ThemedText>
            <ThemedText style={[styles.levelNumber, { color: '#fff' }]}>
              {isMaxLevel ? 'MAX' : level}
            </ThemedText>
            <ThemedText style={[styles.levelSubtext, { color: '#fff', opacity: 0.9 }]}>
              {points.toLocaleString()} XP totales
            </ThemedText>
            {isMaxLevel && (
              <ThemedText style={[styles.levelSubtext, { color: '#fff', opacity: 0.8, fontSize: 14, marginTop: 4 }]}>
                Has alcanzado el nivel máximo
              </ThemedText>
            )}
          </LinearGradient>
        </ThemedView>

        {/* Barra de Progreso XP */}
        {!isMaxLevel ? (
          <ThemedView style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ThemedText type="defaultSemiBold" style={styles.progressTitle}>
                Progreso al Nivel {level + 1}
              </ThemedText>
              <ThemedText style={styles.progressPercentage}>
                {progressPercentage.toFixed(1)}%
              </ThemedText>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressBarFill, { width: `${progressPercentage}%` }]}
              />
            </View>
            
            <View style={styles.progressStats}>
              <ThemedText style={styles.progressStatText}>
                {xpInCurrentLevel.toLocaleString()} / {xpNeededForNext.toLocaleString()} XP
              </ThemedText>
              <ThemedText style={styles.progressStatText}>
                Faltan {xpRemaining.toLocaleString()} XP
              </ThemedText>
            </View>
          </ThemedView>
        ) : (
          <ThemedView style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ThemedText type="defaultSemiBold" style={styles.progressTitle}>
                Nivel Máximo Alcanzado
              </ThemedText>
            </View>
            <ThemedText style={[styles.progressStatText, { textAlign: 'center', marginTop: 8 }]}>
              Has alcanzado el nivel máximo. Los puntos se siguen acumulando pero no hay más niveles disponibles.
            </ThemedText>
          </ThemedView>
        )}

        {/* Monedas */}
        <ThemedView style={styles.coinsCard}>
          <View style={styles.coinsContent}>
            <View style={[styles.coinIcon, { backgroundColor: isDark ? '#3a3a4e' : '#ffd700' }]}>
              <ThemedText style={[styles.coinEmoji, { color: isDark ? '#ffd700' : '#000' }]}>
                🪙
              </ThemedText>
            </View>
            <View style={styles.coinsInfo}>
              <ThemedText type="defaultSemiBold" style={styles.coinsLabel}>
                Monedas
              </ThemedText>
              <ThemedText style={styles.coinsAmount}>
                {coins.toLocaleString()}
              </ThemedText>
            </View>
          </View>
        </ThemedView>

        {/* Estadísticas Adicionales */}
        <ThemedView style={styles.statsCard}>
          <ThemedText type="subtitle" style={styles.statsTitle}>
            Estadísticas
          </ThemedText>
          
          <View style={styles.statsGrid}>
            <ThemedView 
              style={styles.statItem}
              lightColor="#f5f5f5"
              darkColor="#2a2a3e">
              <ThemedText style={styles.statValue}>{isMaxLevel ? 'MAX' : level}</ThemedText>
              <ThemedText style={styles.statLabel}>{getLevelDisplayName(level)}</ThemedText>
            </ThemedView>
            
            <ThemedView 
              style={styles.statItem}
              lightColor="#f5f5f5"
              darkColor="#2a2a3e">
              <ThemedText style={styles.statValue}>{points.toLocaleString()}</ThemedText>
              <ThemedText style={styles.statLabel}>XP Total</ThemedText>
            </ThemedView>
            
            <ThemedView 
              style={styles.statItem}
              lightColor="#f5f5f5"
              darkColor="#2a2a3e">
              <ThemedText style={styles.statValue}>{coins.toLocaleString()}</ThemedText>
              <ThemedText style={styles.statLabel}>Monedas</ThemedText>
            </ThemedView>
            
            <ThemedView 
              style={styles.statItem}
              lightColor="#f5f5f5"
              darkColor="#2a2a3e">
              <ThemedText style={styles.statValue}>
                {profile.onboarding_complete ? '✓' : '—'}
              </ThemedText>
              <ThemedText style={styles.statLabel}>Onboarding</ThemedText>
            </ThemedView>
          </View>
        </ThemedView>

        {/* Información de Próximo Nivel */}
        {!isMaxLevel && (
          <ThemedView 
            style={styles.nextLevelCard}
            lightColor="#f9f9f9"
            darkColor="#1a1a2e">
            <ThemedText type="defaultSemiBold" style={styles.nextLevelTitle}>
              Próximo Nivel
            </ThemedText>
            <ThemedText style={styles.nextLevelText}>
              Nivel {level + 1} requiere {nextLevelXP.toLocaleString()} XP totales
            </ThemedText>
            <ThemedText style={styles.nextLevelSubtext}>
              Te faltan {xpRemaining.toLocaleString()} XP para subir de nivel
            </ThemedText>
          </ThemedView>
        )}

      </ScrollView>
      <FabChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
  },
  avatarContainer: {
    marginBottom: 12,
  },
  userName: {
    marginTop: 8,
    textAlign: 'center',
  },
  userEmail: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  levelCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  levelGradient: {
    padding: 24,
    alignItems: 'center',
  },
  levelLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.9,
    marginBottom: 8,
  },
  levelNumber: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  levelSubtext: {
    fontSize: 16,
    fontWeight: '500',
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    fontSize: 16,
  },
  progressPercentage: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
  },
  progressBarContainer: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStatText: {
    fontSize: 14,
    opacity: 0.7,
  },
  coinsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  coinsContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  coinEmoji: {
    fontSize: 32,
  },
  coinsInfo: {
    flex: 1,
  },
  coinsLabel: {
    fontSize: 14,
    opacity: 0.7,
    marginBottom: 4,
  },
  coinsAmount: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  statsCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statsTitle: {
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.7,
    textAlign: 'center',
  },
  nextLevelCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  nextLevelTitle: {
    fontSize: 16,
    marginBottom: 8,
  },
  nextLevelText: {
    fontSize: 14,
    marginBottom: 4,
  },
  nextLevelSubtext: {
    fontSize: 14,
    opacity: 0.7,
  },
});

