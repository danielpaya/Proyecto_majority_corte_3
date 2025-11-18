import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../utils/supabase';
import { ThemedButton } from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { MissionLocationPicker, type MissionCoordinate } from '@/components/MissionLocationPicker';
import { useRouter } from 'expo-router';

import { AvatarPreview } from '../../components/AvatarPreview';
import { catalog_tmplx01 } from '../data/avatarCatalog';
import type { AvatarLayer } from '../data/avatarCatalog';

type MissionRow = {
  id: string;
  title: string;
  category?: string | null;
  points: number;
  difficulty?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  is_system?: boolean | null;
};

type UserMissionRow = {
  id: string;
  mission_id: string;
  status: 'pendiente' | 'en_curso' | 'completada' | 'cancelada' | 'vencida';
  points_awarded: number;
  missions: {
    id: string;
    title: string;
    points: number;
    location_lat?: number | null;
    location_lng?: number | null;
    location_label?: string | null;
  } | null;
};

export default function MisionesScreen() {
  const { profile, takeMission, completeMission } = useAuth();
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const isAdmin = profile?.role === 'ADMIN';

  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [suggested, setSuggested] = useState<MissionRow[]>([]);
  const [myMissions, setMyMissions] = useState<UserMissionRow[]>([]);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [creatingMission, setCreatingMission] = useState(false);
  const [missionForm, setMissionForm] = useState({
    title: '',
    description: '',
    category: '',
    points: '10',
    difficulty: '1',
    locationLabel: '',
  });
  const [missionLocation, setMissionLocation] = useState<MissionCoordinate | null>(null);

  const profileId = profile?.id ?? null;
  const resetMissionForm = useCallback(() => {
    setMissionForm({
      title: '',
      description: '',
      category: '',
      points: '10',
      difficulty: '1',
      locationLabel: '',
    });
    setMissionLocation(null);
  }, []);

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
    if (!profileId) {
      setLoading(false);
      setRefreshing(false);
      setSuggested([]);
      setMyMissions([]);
      return;
    }

    setRefreshing(true);
    try {
      let unlocked: MissionRow[] | null = null;
      try {
        const { data, error: rpcErr } = await supabase
          .rpc('missions_public')
          .returns<MissionRow[]>();
        if (rpcErr) {
          throw rpcErr;
        }
        unlocked = data ?? [];
      } catch (rpcError) {
        console.log('[Misiones] missions_public rpc fallback', rpcError);
        const { data, error: baseErr } = await supabase
          .from('missions')
          .select('id, title, category, points, difficulty, location_lat, location_lng, location_label, is_system')
          .eq('active', true)
          .order('category', { ascending: true })
          .order('title', { ascending: true })
          .returns<MissionRow[]>();
        if (baseErr) throw baseErr;
        unlocked = data ?? [];
      }
      const allMissions = unlocked ?? [];

      const { data: completedRows, error: completedErr } = await supabase
        .from('user_misiones')
        .select('mission_id, status')
        .eq('user_id', profileId)
        .eq('status', 'completada');
      if (completedErr) throw completedErr;
      const completedSet = new Set((completedRows ?? []).map((row) => row.mission_id));

      const filteredMissions = allMissions.filter((mission) => {
        if (mission.is_system) return true;
        return !completedSet.has(mission.id);
      });

      setSuggested(filteredMissions);

      const yoursQ = supabase
        .from('user_misiones')
        .select('id, mission_id, status, points_awarded, missions:mission_id(id, title, points, location_lat, location_lng, location_label)')
        .eq('user_id', profileId)
        .in('status', ['pendiente', 'en_curso'])
        .order('status', { ascending: true })
        .order('id', { ascending: true })
        .returns<UserMissionRow[]>();

      const { data: yours, error: myErr } = await yoursQ;
      if (!myErr && yours) {
        setMyMissions(yours);
      } else if (myErr) {
        throw myErr;
      }
    } catch (err) {
      console.log('[Misiones] loadData error', err);
      Alert.alert('Error', 'No se pudo cargar misiones, intenta de nuevo.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [profileId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const takenMissionIds = useMemo(
    () => new Set(myMissions.map((m) => m.mission_id)),
    [myMissions]
  );

  const handleViewMissionLocation = useCallback(
    (mission?: MissionRow | UserMissionRow['missions'] | null) => {
      if (!mission || mission.location_lat == null || mission.location_lng == null) {
        Alert.alert('Ubicacion no disponible', 'Esta mision aun no tiene una ubicacion configurada.');
        return;
      }
      const label = mission.location_label ?? mission.title ?? 'Mision';
      router.push({
        pathname: '/main/map',
        params: {
          missionLat: String(mission.location_lat),
          missionLng: String(mission.location_lng),
          missionName: label,
          missionToken: String(Date.now()),
        },
      });
    },
    [router]
  );

  const handleAcceptMission = useCallback(
    async (missionId: string) => {
      try {
        setAcceptingId(missionId);
        await takeMission(missionId);
        await loadData();
      } catch (err: any) {
        console.log('[Misiones] accept mission error', err);
        const message = err?.message ?? 'No se pudo aceptar la mision.';
        Alert.alert('Error', message);
      } finally {
        setAcceptingId(null);
      }
    },
    [loadData, takeMission]
  );

  const handleCompleteMission = useCallback(
    async (missionId: string) => {
      try {
        setCompletingId(missionId);
        await completeMission(missionId);
        await loadData();
        Alert.alert('Completada', 'Sumamos los puntos de la mision.');
      } catch (err: any) {
        console.log('[Misiones] complete mission error', err);
        const message = err?.message ?? 'No se pudo completar la mision.';
        Alert.alert('Error', message);
      } finally {
        setCompletingId(null);
      }
    },
    [completeMission, loadData]
  );

  const handleCreateMission = useCallback(async () => {
    if (!isAdmin) return;
    if (!profile?.id) {
      Alert.alert('Sesion requerida', 'Debes estar autenticado para crear misiones.');
      return;
    }

    const title = missionForm.title.trim();
    if (!title) {
      Alert.alert('Campo requerido', 'La mision necesita un titulo.');
      return;
    }

    if (!missionLocation) {
      Alert.alert('Ubicacion requerida', 'Selecciona un punto en el mapa para la mision.');
      return;
    }

    const pointsRaw = Number.parseInt(missionForm.points, 10);
    if (!Number.isFinite(pointsRaw) || pointsRaw <= 0) {
      Alert.alert('Puntos invalidos', 'Ingresa un valor de puntos mayor que cero.');
      return;
    }

    const difficultyInput = missionForm.difficulty.trim();
    let difficultyValue: number | null = null;
    if (difficultyInput) {
      const parsed = Number.parseInt(difficultyInput, 10);
      if (!Number.isNaN(parsed)) {
        difficultyValue = Math.max(1, Math.min(5, parsed));
      }
    }

    const slugBase = slugify(title);
    const slug = slugBase ? `${slugBase}-${Date.now()}` : `mision-${Date.now()}`;

    const payload = {
      slug,
      title,
      description: missionForm.description.trim() || null,
      category: missionForm.category.trim() || null,
      difficulty: difficultyValue,
      points: pointsRaw,
      created_by: profile.id,
      is_system: true,
      location_lat: missionLocation.latitude,
      location_lng: missionLocation.longitude,
      location_label: missionForm.locationLabel.trim() || null,
      active: true,
    };

    try {
      setCreatingMission(true);
      const { error } = await supabase.from('missions').insert(payload);
      if (error) throw error;
      Alert.alert('Mision creada', 'La mision se guardo con la ubicacion seleccionada.');
      resetMissionForm();
      await loadData();
    } catch (err: any) {
      console.log('[Misiones] create mission error', err);
      Alert.alert('Error', err?.message ?? 'No se pudo crear la mision.');
    } finally {
      setCreatingMission(false);
    }
  }, [isAdmin, profile?.id, missionForm, missionLocation, resetMissionForm, loadData]);

  if (loading) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}
      >
        <View style={[styles.container, { alignItems: 'center', justifyContent: 'center', flex: 1 }]}>
          <ActivityIndicator color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={{ marginTop: 8 }}>Cargando...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}
    >
      <FlatList
        data={[]}
        ListHeaderComponent={
          <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.h1}>
              Hola, {profile?.name ?? 'Explorador'}
            </ThemedText>
            <ThemedText style={styles.meta}>{profile?.email ?? ''}</ThemedText>

            <View style={styles.infoRow}>
              <ThemedView style={styles.badge} lightColor="#eef4ff" darkColor="#2a2a3e">
                <ThemedText style={styles.badgeLabel} lightColor="#0a7aff" darkColor="#4a9eff">
                  Nivel {profile?.level ?? 1}
                </ThemedText>
              </ThemedView>
              <ThemedView style={styles.badge} lightColor="#eef4ff" darkColor="#2a2a3e">
                <ThemedText style={styles.badgeLabel} lightColor="#0a7aff" darkColor="#4a9eff">
                  {profile?.points ?? 0} pts
                </ThemedText>
              </ThemedView>
            </View>

            {avatarSelected && (
              <View style={{ alignItems: 'center', marginTop: 8 }}>
                <AvatarPreview catalog={catalog_tmplx01} selected={avatarSelected} size={140} />
              </View>
            )}

            {isAdmin && (
              <ThemedView
                style={[styles.adminCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                lightColor="#ffffff"
                darkColor="#121224"
              >
                <ThemedText type="subtitle" style={styles.h2}>
                  Crear nueva mision
                </ThemedText>
                <ThemedText style={styles.adminHint}>
                  Define los datos basicos y selecciona el punto en el mapa.
                </ThemedText>

                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Titulo"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={missionForm.title}
                  onChangeText={(text) => setMissionForm((prev) => ({ ...prev, title: text }))}
                />
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight, styles.multiline]}
                  placeholder="Descripcion"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={missionForm.description}
                  onChangeText={(text) => setMissionForm((prev) => ({ ...prev, description: text }))}
                  multiline
                />
                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Categoria"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={missionForm.category}
                  onChangeText={(text) => setMissionForm((prev) => ({ ...prev, category: text }))}
                />

                <View style={styles.adminRow}>
                  <View style={{ flex: 1, marginRight: 6 }}>
                    <TextInput
                      style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                      placeholder="Puntos"
                      placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                      keyboardType="numeric"
                      value={missionForm.points}
                      onChangeText={(text) => setMissionForm((prev) => ({ ...prev, points: text }))}
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 6 }}>
                    <TextInput
                      style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                      placeholder="Dificultad (1-5)"
                      placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                      keyboardType="numeric"
                      value={missionForm.difficulty}
                      onChangeText={(text) => setMissionForm((prev) => ({ ...prev, difficulty: text }))}
                    />
                  </View>
                </View>

                <TextInput
                  style={[styles.input, isDark ? styles.inputDark : styles.inputLight]}
                  placeholder="Etiqueta de la ubicacion (opcional)"
                  placeholderTextColor={isDark ? '#8a8a8a' : '#8c8c8c'}
                  value={missionForm.locationLabel}
                  onChangeText={(text) => setMissionForm((prev) => ({ ...prev, locationLabel: text }))}
                />

                <View style={{ marginTop: 12 }}>
                  <MissionLocationPicker value={missionLocation} onChange={setMissionLocation} />
                  {missionLocation ? (
                    <ThemedText style={styles.adminHint}>
                      Lat: {missionLocation.latitude.toFixed(5)} / Lng: {missionLocation.longitude.toFixed(5)}
                    </ThemedText>
                  ) : (
                    <ThemedText style={styles.adminHint}>Toca el mapa para colocar el pin de la mision.</ThemedText>
                  )}
                </View>

                <View style={{ marginTop: 12 }}>
                  <ThemedButton
                    title="Guardar mision"
                    onPress={handleCreateMission}
                    loading={creatingMission}
                    disabled={creatingMission}
                  />
                </View>
              </ThemedView>
            )}

            <ThemedText type="subtitle" style={[styles.h2, { marginTop: 16 }]}>
              Tus misiones
            </ThemedText>
            {myMissions.length === 0 ? (
              <ThemedText style={styles.empty}>No tienes misiones en curso. Acepta alguna sugerida.</ThemedText>
            ) : (
              <View style={{ gap: 8 }}>
                {myMissions.map((m) => {
                  const canComplete = m.status === 'pendiente' || m.status === 'en_curso';
                  const displayPoints = m.points_awarded > 0 ? m.points_awarded : m.missions?.points ?? 0;
                  const missionHasLocation =
                    m.missions?.location_lat != null && m.missions?.location_lng != null;
                  return (
                    <ThemedView
                      key={m.id}
                      style={[styles.card, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                      lightColor="#fafafa"
                      darkColor="#1a1a2e"
                    >
                      <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                        {m.missions?.title ?? 'Mision'}
                      </ThemedText>
                      <ThemedText style={styles.cardSub}>
                        Estado: {m.status} - {displayPoints} pts
                      </ThemedText>
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <ThemedButton
                          title="Ver ubicacion"
                          highlight={false}
                          disabled={!missionHasLocation}
                          onPress={() => handleViewMissionLocation(m.missions)}
                        />
                        {canComplete && (
                          <ThemedButton
                            title="Completar mision"
                            loading={completingId === m.mission_id}
                            onPress={() => handleCompleteMission(m.mission_id)}
                          />
                        )}
                      </View>
                    </ThemedView>
                  );
                })}
              </View>
            )}

            <ThemedText type="subtitle" style={[styles.h2, { marginTop: 16 }]}>
              Sugeridas para ti
            </ThemedText>
            {suggested.length === 0 ? (
              <ThemedText style={styles.empty}>Sin sugerencias por ahora.</ThemedText>
            ) : (
              <View style={{ gap: 8 }}>
                {suggested.map((m) => {
                  const alreadyTaken = takenMissionIds.has(m.id);
                  const hasCoords = m.location_lat != null && m.location_lng != null;
                  return (
                    <ThemedView
                      key={m.id}
                      style={[styles.card, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                      lightColor="#fafafa"
                      darkColor="#1a1a2e"
                    >
                      <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                        {m.title}
                      </ThemedText>
                      <ThemedText style={styles.cardSub}>
                        {(m.category ?? 'General') + ` - ${m.points} pts`}{' '}
                        {m.difficulty ? `(D${m.difficulty})` : ''}
                      </ThemedText>
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <ThemedButton
                          title="Ver ubicacion"
                          highlight={false}
                          disabled={!hasCoords}
                          onPress={() => handleViewMissionLocation(m)}
                        />
                        <ThemedButton
                          title={alreadyTaken ? 'Ya aceptada' : 'Aceptar mision'}
                          disabled={alreadyTaken}
                          loading={acceptingId === m.id}
                          onPress={() => handleAcceptMission(m.id)}
                        />
                      </View>
                    </ThemedView>
                  );
                })}
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
  adminCard: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  adminHint: {
    marginTop: 6,
    fontSize: 13,
    opacity: 0.7,
  },
  adminRow: {
    flexDirection: 'row',
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginTop: 12,
  },
  inputDark: {
    borderColor: '#2a2a3e',
    backgroundColor: '#0d0f1f',
    color: '#f4f4f4',
  },
  inputLight: {
    borderColor: '#d5d8e3',
    backgroundColor: '#ffffff',
    color: '#1c1c1c',
  },
  multiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
