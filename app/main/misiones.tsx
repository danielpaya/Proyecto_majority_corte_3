import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

// Avatar (opcional)
import { AvatarPreview } from '../../components/AvatarPreview';
import { catalog_tmplx01 } from '../data/avatarCatalog';
import type { AvatarLayer } from '../data/avatarCatalog';

/* =========================
   Tipos estrictos del SELECT
   ========================= */

type MissionRow = {
  id: string;
  title: string;
  category?: string | null;
  points: number;
  difficulty?: number | null;
};

type UserMissionRowDB = {
  id: string;
  status: 'pendiente' | 'en_curso' | 'completada' | 'cancelada' | 'vencida';
  points_awarded: number;
  missions: { id: string; title: string; points: number } | null;
};

type UserMissionRow = UserMissionRowDB;

export default function MisionesScreen() {
  const { profile } = useAuth();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const [suggested, setSuggested] = useState<MissionRow[]>([]);
  const [myMissions, setMyMissions] = useState<UserMissionRow[]>([]);

  // Avatar seleccionado (si el usuario ya guardó uno)
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

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1) Misiones sugeridas (vista -> fallback)
      let unlocked: MissionRow[] = [];
      {
        const viewQ = supabase
          .from('v_missions_unlocked')
          .select('id, title, category, points, difficulty')
          .order('category', { ascending: true })
          .order('title', { ascending: true })
          .returns<MissionRow[]>();

        const { data: viewData, error: viewErr } = await viewQ;
        if (!viewErr && viewData) {
          unlocked = viewData;
        } else {
          const baseQ = supabase
            .from('missions')
            .select('id, title, category, points, difficulty')
            .eq('active', true)
            .order('category', { ascending: true })
            .order('title', { ascending: true })
            .returns<MissionRow[]>();

          const { data } = await baseQ;
          unlocked = data ?? [];
        }
      }
      setSuggested(unlocked);

      // 2) Misiones del usuario (pendientes/en_curso) + join a missions
      const yoursQ = supabase
        .from('user_misiones')
        .select('id, status, points_awarded, missions:mission_id(id, title, points)')
        .in('status', ['pendiente', 'en_curso'])
        .order('status', { ascending: true })
        .order('id', { ascending: true })
        .returns<UserMissionRowDB[]>();

      const { data: yours, error: myErr } = await yoursQ;
      if (!myErr) setMyMissions(yours ?? []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
          <ActivityIndicator color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={{ marginTop: 8 }}>Cargando…</ThemedText>
        </View>
      </SafeAreaView>
    );
    }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <FlatList
        data={[]}
        ListHeaderComponent={
          <ThemedView style={styles.container}>
            {/* Header de perfil */}
            <ThemedText type="title" style={styles.h1}>Hola, {profile?.name ?? 'Explorador'} 👋</ThemedText>
            <ThemedText style={styles.meta}>{profile?.email}</ThemedText>

            <View style={styles.infoRow}>
              <ThemedView 
                style={styles.badge}
                lightColor="#eef4ff"
                darkColor="#2a2a3e">
                <ThemedText 
                  style={styles.badgeLabel}
                  lightColor="#0a7aff"
                  darkColor="#4a9eff">
                  Nivel {profile?.level ?? 1}
                </ThemedText>
              </ThemedView>
              <ThemedView 
                style={styles.badge}
                lightColor="#eef4ff"
                darkColor="#2a2a3e">
                <ThemedText 
                  style={styles.badgeLabel}
                  lightColor="#0a7aff"
                  darkColor="#4a9eff">
                  {profile?.points ?? 0} pts
                </ThemedText>
              </ThemedView>
            </View>

            {/* Avatar (si existe configuración) */}
            {avatarSelected && (
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <AvatarPreview catalog={catalog_tmplx01} selected={avatarSelected} size={140} />
              </View>
            )}

            {/* Misiones del usuario */}
            <ThemedText type="subtitle" style={[styles.h2, { marginTop: 16 }]}>Tus misiones</ThemedText>
            {myMissions.length === 0 ? (
              <ThemedText style={styles.empty}>No tienes misiones en curso. ¡Toma alguna sugerida! ✨</ThemedText>
            ) : (
              <View style={{ gap: 8 }}>
                {myMissions.map((m) => (
                  <ThemedView 
                    key={m.id} 
                    style={[styles.card, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                    lightColor="#fafafa"
                    darkColor="#1a1a2e">
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                      {m.missions?.title ?? 'Misión'}
                    </ThemedText>
                    <ThemedText style={styles.cardSub}>
                      Estado: {m.status} · {m.points_awarded} pts
                    </ThemedText>
                  </ThemedView>
                ))}
              </View>
            )}

            {/* Misiones sugeridas */}
            <ThemedText type="subtitle" style={[styles.h2, { marginTop: 16 }]}>Sugeridas para ti</ThemedText>
            {suggested.length === 0 ? (
              <ThemedText style={styles.empty}>Sin sugerencias por ahora.</ThemedText>
            ) : (
              <View style={{ gap: 8 }}>
                {suggested.slice(0, 8).map((m) => (
                  <ThemedView 
                    key={m.id} 
                    style={[styles.card, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                    lightColor="#fafafa"
                    darkColor="#1a1a2e">
                    <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                      {m.title}
                    </ThemedText>
                    <ThemedText style={styles.cardSub}>
                      {m.category ?? 'General'} · {m.points} pts {m.difficulty ? `· D${m.difficulty}` : ''}
                    </ThemedText>
                  </ThemedView>
                ))}
              </View>
            )}
          </ThemedView>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        renderItem={null as any}
        keyExtractor={(_, i) => String(i)}
        ListEmptyComponent={null}
        contentContainerStyle={{ paddingBottom: 24 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { padding: 16 },
  h1: { fontSize: 22, fontWeight: '800' },
  meta: { marginTop: 2, marginBottom: 8, opacity: 0.7 },
  infoRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeLabel: { fontWeight: '700', fontSize: 14 },

  h2: { fontSize: 18, fontWeight: '800' },
  empty: { marginTop: 6, opacity: 0.7 },

  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: { fontWeight: '700', fontSize: 15, marginBottom: 2 },
  cardSub: { opacity: 0.7, fontSize: 14 },
});

