import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
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

import { FabChat } from '@/components/FabChat';
import {
  fetchQuestions,
  fetchUserAdulthoodAnswers,
  normalizeAdulthoodSlug,
  type Answer,
  type RawQuestion,
} from '../data/adulthoodApi';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

type MissionRow = {
  id: string;
  slug?: string | null;
  title: string;
  description?: string | null;
  category?: string | null;
  points: number;
  difficulty?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_label?: string | null;
  is_system?: boolean | null;
  created_by?: string | null;
  image_url?: string | null;
  prerequisite_mission?: {
    id: string;
    title: string;
  } | null;
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
  const [selectedMission, setSelectedMission] = useState<MissionRow | null>(null);
  const [showMissionModal, setShowMissionModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'incomplete' | 'with_prerequisites'>('all');
  const [missionImage, setMissionImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

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
    setMissionImage(null);
  }, []);


  // Función para subir imagen a Supabase Storage y retornar la URL pública
  const uploadMissionImage = useCallback(async (imageUri: string, missionId: string): Promise<string | null> => {
    if (!profileId) {
      throw new Error('No hay usuario autenticado');
    }

    if (!isAdmin) {
      throw new Error('Solo los administradores pueden subir imágenes');
    }

    try {
      setUploadingImage(true);

      // Generar nombre único para el archivo
      const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `mission-${missionId}-${Date.now()}.${fileExt}`;
      const filePath = `missions/${fileName}`;

      // En React Native, leer el archivo usando fetch y convertir a ArrayBuffer
      // arrayBuffer() está disponible en React Native (no blob())
      const response = await fetch(imageUri);
      if (!response.ok) {
        throw new Error('No se pudo leer la imagen');
      }

      // Convertir la respuesta a ArrayBuffer (compatible con React Native)
      const arrayBuffer = await response.arrayBuffer();

      // Subir a Supabase Storage usando el ArrayBuffer
      // Supabase Storage acepta ArrayBuffer en React Native
      const { data, error } = await supabase.storage
        .from('images')
        .upload(filePath, arrayBuffer, {
          contentType: `image/${fileExt}`,
          upsert: false,
        });

      if (error) {
        console.log('[Misiones] upload error', error);
        // Mensajes de error más descriptivos
        if (error.message?.includes('new row violates row-level security')) {
          throw new Error('No tienes permisos para subir imágenes. Verifica que seas administrador y que las políticas de storage estén configuradas.');
        }
        if (error.message?.includes('Bucket not found')) {
          throw new Error('El bucket "images" no existe. Ejecuta la migración 018_setup_images_bucket.sql');
        }
        throw new Error(`Error al subir imagen: ${error.message || 'Error desconocido'}`);
      }

      if (!data) {
        throw new Error('No se recibió confirmación de la subida');
      }

      // Obtener la URL pública del archivo subido
      const { data: urlData } = supabase.storage.from('images').getPublicUrl(filePath);
      
      if (urlData?.publicUrl) {
        console.log('[Misiones] Image uploaded successfully, public URL:', urlData.publicUrl);
        return urlData.publicUrl;
      }

      // Si no hay URL pública, intentar generar URL firmada como fallback
      const { data: signedData, error: signedError } = await supabase.storage
        .from('images')
        .createSignedUrl(filePath, 31536000); // 1 año

      if (signedError || !signedData) {
        console.log('[Misiones] error getting signed URL', signedError);
        throw new Error('No se pudo obtener la URL de la imagen después de subirla');
      }

      console.log('[Misiones] Image uploaded successfully, signed URL:', signedData.signedUrl);
      return signedData.signedUrl;
    } catch (error: any) {
      console.log('[Misiones] upload image error', error);
      throw error;
    } finally {
      setUploadingImage(false);
    }
  }, [profileId, isAdmin]);

  // Función para seleccionar imagen (cámara o galería)
  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    try {
      if (source === 'camera') {
        // Solicitar permisos de cámara
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        if (cameraStatus !== 'granted') {
          Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu cámara para tomar una foto.');
          return;
        }

        // Abrir cámara
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setMissionImage(result.assets[0].uri);
        }
      } else {
        // Solicitar permisos de galería
        const { status: galleryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (galleryStatus !== 'granted') {
          Alert.alert('Permisos requeridos', 'Necesitamos acceso a tu galería para seleccionar una imagen.');
          return;
        }

        // Abrir selector de imagen
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [16, 9],
          quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
          setMissionImage(result.assets[0].uri);
        }
      }
    } catch (error) {
      console.log('[Misiones] error picking image', error);
      Alert.alert('Error', 'No se pudo seleccionar la imagen.');
    }
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
      let adulthoodAnswers: Record<string, Answer> = {};
      let adulthoodQuestions: RawQuestion[] = [];
      try {
        adulthoodAnswers = await fetchUserAdulthoodAnswers(profileId);
      } catch (answersErr) {
        console.log('[Misiones] adulthood answers error', answersErr);
      }
      try {
        adulthoodQuestions = await fetchQuestions();
      } catch (questionsErr) {
        console.log('[Misiones] adulthood questions error', questionsErr);
      }

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
          .select('id, slug, title, description, category, points, difficulty, location_lat, location_lng, location_label, is_system, created_by, image_url')
          .eq('active', true)
          .order('category', { ascending: true })
          .order('title', { ascending: true })
          .returns<MissionRow[]>();
        if (baseErr) throw baseErr;
        unlocked = data ?? [];
      }
      
      // Cargar información de prerequisitos para todas las misiones
      const missionIds = (unlocked ?? []).map(m => m.id);
      let prerequisitesMap: Record<string, { id: string; title: string }> = {};
      
      if (missionIds.length > 0) {
        try {
          const { data: depsData, error: depsErr } = await supabase
            .from('mission_dependencies')
            .select(`
              mission_id,
              required_mission:required_mission_id (
                id,
                title
              )
            `)
            .in('mission_id', missionIds);
          
          if (!depsErr && depsData) {
            for (const dep of depsData) {
              const missionId = dep.mission_id;
              const required = dep.required_mission as { id: string; title: string } | null;
              if (missionId && required) {
                prerequisitesMap[missionId] = required;
              }
            }
          }
        } catch (depsError) {
          console.log('[Misiones] error loading prerequisites', depsError);
        }
      }
      
      // Agregar información de prerequisitos a las misiones
      // Las URLs de imágenes ya están guardadas como URLs completas en la base de datos
      const allMissions = (unlocked ?? []).map(mission => ({
        ...mission,
        prerequisite_mission: prerequisitesMap[mission.id] || null,
      }));

      const { data: completedRows, error: completedErr } = await supabase
        .from('user_misiones')
        .select('mission_id, status')
        .eq('user_id', profileId)
        .eq('status', 'completada');
      if (completedErr) throw completedErr;
      const completedSet = new Set((completedRows ?? []).map((row) => row.mission_id));

      // Crear mapas normalizados de preguntas y respuestas para matching eficiente
      const normalizedQuestionSlugs = new Set(
        adulthoodQuestions
          .map((q) => normalizeAdulthoodSlug(q.slug))
          .filter((value): value is string => Boolean(value))
      );
      const normalizedQuestionBlocks = new Set(
        adulthoodQuestions
          .map((q) => normalizeAdulthoodSlug(q.block))
          .filter((value): value is string => Boolean(value))
      );

      // Normalizar todas las claves de respuestas para matching consistente
      const normalizedAnswers: Record<string, Answer> = {};
      for (const [key, answer] of Object.entries(adulthoodAnswers)) {
        const normalized = normalizeAdulthoodSlug(key);
        if (normalized) {
          normalizedAnswers[normalized] = answer;
        }
      }

      /**
       * Resuelve la respuesta de adultez relacionada con una misión
       * Busca coincidencias por slug, category o title de la misión
       * Retorna la respuesta si encuentra una relación, null si no hay relación
       */
      const resolveAnswerForMission = (mission: MissionRow): Answer | null => {
        // Normalizar los campos de la misión
        const normalizedSlug = normalizeMissionKey(mission.slug);
        const normalizedCategory = normalizeMissionKey(mission.category);
        const normalizedTitle = normalizeMissionKey(mission.title);

        const searchKeys = [normalizedSlug, normalizedCategory, normalizedTitle].filter(
          (v): v is string => Boolean(v)
        );

        if (searchKeys.length === 0) {
          return null;
        }

        // 1. Buscar coincidencias exactas: slug de pregunta = slug/category/title de misión
        for (const key of searchKeys) {
          if (normalizedQuestionSlugs.has(key)) {
            const answer = normalizedAnswers[key];
            if (answer) {
              return answer;
            }
          }
        }

        // 2. Buscar coincidencias exactas en las respuestas normalizadas
        // (por si el question_slug coincide directamente con slug/category/title de la misión)
        for (const key of searchKeys) {
          if (normalizedAnswers[key]) {
            return normalizedAnswers[key];
          }
        }

        // 3. Buscar por bloques de preguntas
        for (const key of searchKeys) {
          if (normalizedQuestionBlocks.has(key)) {
            // Si el bloque coincide, buscar todas las respuestas de preguntas en ese bloque
            for (const question of adulthoodQuestions) {
              const normalizedQSlug = normalizeAdulthoodSlug(question.slug);
              const normalizedQBlock = normalizeAdulthoodSlug(question.block);
              
              if (normalizedQBlock === key && normalizedQSlug && normalizedAnswers[normalizedQSlug]) {
                return normalizedAnswers[normalizedQSlug];
              }
            }
          }
        }

        // 4. Buscar coincidencias parciales (más flexible)
        for (const key of searchKeys) {
          // Buscar en slugs de preguntas
          for (const qSlug of normalizedQuestionSlugs) {
            if (key.length > 3 && qSlug.length > 3) {
              if (key.includes(qSlug) || qSlug.includes(key)) {
                const answer = normalizedAnswers[qSlug];
                if (answer) {
                  return answer;
                }
              }
            }
          }
          
          // Buscar en respuestas
          for (const [answerKey, answer] of Object.entries(normalizedAnswers)) {
            if (key.length > 3 && answerKey.length > 3) {
              if (key.includes(answerKey) || answerKey.includes(key)) {
                return answer;
              }
            }
          }
        }

        return null;
      };

      /**
       * Filtra misiones basándose en:
       * 1. Misiones de admin: siempre mostrar
       * 2. Misiones completadas: no mostrar en sugeridas (a menos que el filtro sea "completadas")
       * 3. Respuestas de adultez:
       *    - Solo mostrar misiones relacionadas con preguntas de adultez
       *    - 'yes' o 'na': NO mostrar (ya está resuelto)
       *    - 'no' o 'in_progress': SÍ mostrar (necesita trabajo)
       *    - Sin respuesta relacionada: NO mostrar (solo misiones relacionadas con preguntas)
       */
      const baseFilteredMissions = allMissions.filter((mission) => {
        if (!mission) return false;

        const isAdminMission = Boolean(mission.created_by);
        const isCompleted = completedSet.has(mission.id);
        
        // Si el filtro es "completadas", incluir todas las completadas
        if (filterStatus === 'completed' && isCompleted) {
          return true;
        }
        
        // Las misiones de admin siempre se muestran (excepto si el filtro es específico)
        if (isAdminMission && filterStatus !== 'completed') {
          return true;
        }

        // No mostrar misiones ya completadas en otros filtros
        if (isCompleted && filterStatus !== 'completed') {
          return false;
        }

        // Buscar respuesta de adultez relacionada
        const answer = resolveAnswerForMission(mission);
        
        // Solo mostrar misiones que tienen una pregunta de adultez relacionada
        // Si no hay respuesta relacionada, NO mostrar la misión
        if (!answer) {
          return false;
        }

        // Si hay respuesta relacionada, mostrar solo si es 'no' o 'in_progress' (necesita trabajo)
        // Ocultar si es 'yes' o 'na' (ya está resuelto)
        return answer === 'no' || answer === 'in_progress';
      });

      // Aplicar filtros adicionales según el estado seleccionado
      let finalFilteredMissions = baseFilteredMissions;
      
      if (filterStatus === 'incomplete') {
        finalFilteredMissions = baseFilteredMissions.filter(m => !completedSet.has(m.id));
      } else if (filterStatus === 'with_prerequisites') {
        finalFilteredMissions = baseFilteredMissions.filter(m => m.prerequisite_mission !== null);
      }
      // 'all' y 'completed' ya están manejados en baseFilteredMissions

      setSuggested(finalFilteredMissions);

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
  }, [loadData, filterStatus]);

  const takenMissionIds = useMemo(
    () => new Set(myMissions.map((m) => m.mission_id)),
    [myMissions]
  );

  // Estado para misiones completadas (para verificar prerequisitos)
  const [completedMissionIdsSet, setCompletedMissionIdsSet] = useState<Set<string>>(new Set());

  // Cargar misiones completadas
  useEffect(() => {
    if (!profileId) {
      setCompletedMissionIdsSet(new Set());
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('user_misiones')
          .select('mission_id')
          .eq('user_id', profileId)
          .eq('status', 'completada');
        if (!error && data) {
          setCompletedMissionIdsSet(new Set(data.map(row => row.mission_id)));
        }
      } catch (err) {
        console.log('[Misiones] error loading completed missions', err);
      }
    })();
  }, [profileId, loadData]);

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
      // Verificar prerequisitos antes de intentar aceptar
      const mission = suggested.find(m => m.id === missionId);
      if (mission?.prerequisite_mission) {
        const prerequisiteId = mission.prerequisite_mission.id;
        if (!completedMissionIdsSet.has(prerequisiteId)) {
          Alert.alert(
            'Prerequisito requerido',
            `Debes completar primero la misión: ${mission.prerequisite_mission.title}`
          );
          return;
        }
      }

      try {
        setAcceptingId(missionId);
        await takeMission(missionId);
        await loadData();
      } catch (err: any) {
        console.log('[Misiones] accept mission error', err);
        const message = err?.message ?? 'No se pudo aceptar la mision.';
        Alert.alert('Error', message);
      } finally {
        // Asegurar que siempre se resetee el estado, incluso si hay un error
        setAcceptingId(null);
      }
    },
    [loadData, takeMission, suggested, completedMissionIdsSet]
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

    // Generar un ID temporal único para la misión (para nombrar la imagen)
    const tempMissionId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    try {
      setCreatingMission(true);

      // Subir imagen si existe (antes de crear la misión)
      let imageUrl: string | null = null;
      if (missionImage) {
        try {
          imageUrl = await uploadMissionImage(missionImage, tempMissionId);
          if (!imageUrl) {
            throw new Error('No se pudo obtener la URL de la imagen');
          }
          console.log('[Misiones] Image URL obtained:', imageUrl);
        } catch (imgErr: any) {
          console.log('[Misiones] error uploading image', imgErr);
          const errorMessage = imgErr?.message || 'No se pudo subir la imagen';
          
          // Mostrar error detallado
          Alert.alert(
            'Error al subir imagen',
            `${errorMessage}\n\nVerifica:\n- Que seas administrador\n- Que la migración 018_setup_images_bucket.sql esté ejecutada\n- Que el bucket "images" exista en Supabase Storage\n\nLa misión se creará sin imagen.`,
            [{ text: 'OK' }]
          );
          // Continuar sin imagen
          imageUrl = null;
        }
      }

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
        image_url: imageUrl, // Guardar la URL pública directamente
        active: true,
      };

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
  }, [isAdmin, profile?.id, missionForm, missionLocation, missionImage, resetMissionForm, loadData, uploadMissionImage]);

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
    style={[
      styles.safe,
      { backgroundColor: isDark ? Colors.dark.background : Colors.light.background },
    ]}
  >
    <View style={{ flex: 1 }}>
      <FlatList
        data={[]}
        ListHeaderComponent={
          <ThemedView style={styles.container}>
            {
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

                {/* Selector de imagen */}
                <View style={{ marginTop: 12 }}>
                  <ThemedText style={[styles.label, { marginBottom: 8 }]}>Imagen de la misión (opcional)</ThemedText>
                  {missionImage ? (
                    <View style={styles.imagePreviewContainer}>
                      <Image source={{ uri: missionImage }} style={styles.imagePreview} />
                      <TouchableOpacity
                        style={styles.removeImageButton}
                        onPress={() => setMissionImage(null)}>
                        <MaterialIcons name="close" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.imagePickerButtonsContainer}>
                      <TouchableOpacity
                        style={[styles.imagePickerButton, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                        onPress={() => pickImage('camera')}
                        disabled={uploadingImage}>
                        {uploadingImage ? (
                          <ActivityIndicator color={isDark ? '#4a9eff' : '#0a7aff'} />
                        ) : (
                          <>
                            <MaterialIcons
                              name="camera-alt"
                              size={24}
                              color={isDark ? '#4a9eff' : '#0a7aff'}
                              style={{ marginRight: 8 }}
                            />
                            <ThemedText style={{ color: isDark ? '#4a9eff' : '#0a7aff' }}>
                              Tomar foto
                            </ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.imagePickerButton, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                        onPress={() => pickImage('gallery')}
                        disabled={uploadingImage}>
                        {uploadingImage ? (
                          <ActivityIndicator color={isDark ? '#4a9eff' : '#0a7aff'} />
                        ) : (
                          <>
                            <MaterialIcons
                              name="image"
                              size={24}
                              color={isDark ? '#4a9eff' : '#0a7aff'}
                              style={{ marginRight: 8 }}
                            />
                            <ThemedText style={{ color: isDark ? '#4a9eff' : '#0a7aff' }}>
                              Galería
                            </ThemedText>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

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
                      darkColor="#1a1a2e">
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => {
                          console.log('[Misiones] Selected mission:', m.title, 'Image URL:', m.image_url);
                          setSelectedMission(m);
                          setShowMissionModal(true);
                        }}>
                        <ThemedText type="defaultSemiBold" style={styles.cardTitle}>
                          {m.title}
                        </ThemedText>
                        <ThemedText style={styles.cardSub}>
                          {(m.category ?? 'General') + ` - ${m.points} pts`}{' '}
                          {m.difficulty ? `(D${m.difficulty})` : ''}
                        </ThemedText>
                        {m.prerequisite_mission && (
                          <ThemedView
                            style={[styles.prerequisiteBadge, { borderColor: isDark ? '#4a9eff' : '#0a7aff' }]}
                            lightColor="#e6f0ff"
                            darkColor="#1a2a3e">
                            <MaterialIcons
                              name="lock"
                              size={16}
                              color={isDark ? '#4a9eff' : '#0a7aff'}
                              style={{ marginRight: 4 }}
                            />
                            <ThemedText style={[styles.prerequisiteText, { color: isDark ? '#4a9eff' : '#0a7aff' }]}>
                              Requiere: {m.prerequisite_mission.title}
                            </ThemedText>
                          </ThemedView>
                        )}
                      </TouchableOpacity>
                      <View style={{ marginTop: 12, gap: 8 }}>
                        <ThemedButton
                          title="Ver ubicacion"
                          highlight={false}
                          disabled={!hasCoords}
                          onPress={() => handleViewMissionLocation(m)}
                        />
                        <ThemedButton
                          title={alreadyTaken ? 'Ya aceptada' : 'Aceptar mision'}
                          disabled={
                            alreadyTaken ||
                            (m.prerequisite_mission && !completedMissionIdsSet.has(m.prerequisite_mission.id))
                          }
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

            }
          </ThemedView>
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={loadData} />}
        renderItem={null as any}
        keyExtractor={(_, i) => String(i)}
        ListEmptyComponent={null}
        contentContainerStyle={{ paddingBottom: 24 }}
      />

      {/* Botón flotante de chat que despliega el menú de Aria */}
      <FabChat />

      {/* Modal de detalles de misión */}
      <Modal
        visible={showMissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowMissionModal(false);
          setSelectedMission(null);
        }}>
        <TouchableWithoutFeedback onPress={() => {
          setShowMissionModal(false);
          setSelectedMission(null);
        }}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <ThemedView
                style={[styles.modalContent, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
                lightColor="#ffffff"
                darkColor="#121224">
                {selectedMission && (
                  <>
                    <View style={styles.modalHeader}>
                      <ThemedText type="title" style={styles.modalTitle}>
                        {selectedMission.title}
                      </ThemedText>
                      <TouchableOpacity
                        onPress={() => {
                          setShowMissionModal(false);
                          setSelectedMission(null);
                        }}
                        style={styles.modalCloseButton}>
                        <MaterialIcons
                          name="close"
                          size={24}
                          color={isDark ? Colors.dark.text : Colors.light.text}
                        />
                      </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                      {/* Imagen de la misión */}
                      {selectedMission.image_url ? (
                        <View style={styles.modalImageContainer}>
                          <Image
                            source={{ uri: selectedMission.image_url }}
                            style={styles.modalImage}
                            resizeMode="cover"
                            onError={(error) => {
                              console.log('[Misiones] Error loading image:', selectedMission.image_url, error);
                            }}
                            onLoad={() => {
                              console.log('[Misiones] Image loaded successfully:', selectedMission.image_url);
                            }}
                          />
                        </View>
                      ) : (
                        <View style={[styles.modalImageContainer, { height: 0, marginBottom: 0 }]} />
                      )}

                      <View style={styles.modalInfoRow}>
                        <ThemedView style={styles.modalBadge} lightColor="#eef4ff" darkColor="#2a2a3e">
                          <ThemedText style={styles.modalBadgeText} lightColor="#0a7aff" darkColor="#4a9eff">
                            {selectedMission.category ?? 'General'}
                          </ThemedText>
                        </ThemedView>
                        <ThemedView style={styles.modalBadge} lightColor="#eef4ff" darkColor="#2a2a3e">
                          <ThemedText style={styles.modalBadgeText} lightColor="#0a7aff" darkColor="#4a9eff">
                            {selectedMission.points} pts
                          </ThemedText>
                        </ThemedView>
                        {selectedMission.difficulty && (
                          <ThemedView style={styles.modalBadge} lightColor="#eef4ff" darkColor="#2a2a3e">
                            <ThemedText style={styles.modalBadgeText} lightColor="#0a7aff" darkColor="#4a9eff">
                              Dificultad {selectedMission.difficulty}
                            </ThemedText>
                          </ThemedView>
                        )}
                      </View>

                      {selectedMission.prerequisite_mission && (
                        <ThemedView
                          style={[styles.modalPrerequisiteBadge, { borderColor: isDark ? '#4a9eff' : '#0a7aff' }]}
                          lightColor="#e6f0ff"
                          darkColor="#1a2a3e">
                          <MaterialIcons
                            name="lock"
                            size={20}
                            color={isDark ? '#4a9eff' : '#0a7aff'}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            <ThemedText style={[styles.modalPrerequisiteLabel, { color: isDark ? '#4a9eff' : '#0a7aff' }]}>
                              Prerequisito requerido:
                            </ThemedText>
                            <ThemedText style={[styles.modalPrerequisiteText, { color: isDark ? '#4a9eff' : '#0a7aff' }]}>
                              {selectedMission.prerequisite_mission.title}
                            </ThemedText>
                          </View>
                        </ThemedView>
                      )}

                      {selectedMission.description ? (
                        <ThemedText style={styles.modalDescription}>
                          {selectedMission.description}
                        </ThemedText>
                      ) : (
                        <ThemedText style={[styles.modalDescription, { opacity: 0.6 }]}>
                          Esta misión no tiene descripción disponible.
                        </ThemedText>
                      )}

                      <View style={styles.modalButtons}>
                        {(() => {
                          const alreadyTaken = selectedMission ? takenMissionIds.has(selectedMission.id) : false;
                          const hasCoords = selectedMission
                            ? selectedMission.location_lat != null && selectedMission.location_lng != null
                            : false;

                          return (
                            <>
                              <ThemedButton
                                title="Ver ubicacion"
                                highlight={false}
                                disabled={!hasCoords}
                                onPress={() => {
                                  if (selectedMission) {
                                    setShowMissionModal(false);
                                    handleViewMissionLocation(selectedMission);
                                    setSelectedMission(null);
                                  }
                                }}
                                style={{ marginBottom: 8 }}
                              />
                              <ThemedButton
                                title={alreadyTaken ? 'Ya aceptada' : 'Aceptar mision'}
                                disabled={
                                  alreadyTaken ||
                                  (selectedMission?.prerequisite_mission &&
                                    !completedMissionIdsSet.has(selectedMission.prerequisite_mission.id))
                                }
                                loading={selectedMission ? acceptingId === selectedMission.id : false}
                                onPress={() => {
                                  if (selectedMission) {
                                    setShowMissionModal(false);
                                    handleAcceptMission(selectedMission.id);
                                    setSelectedMission(null);
                                  }
                                }}
                              />
                            </>
                          );
                        })()}
                      </View>
                    </ScrollView>
                  </>
                )}
              </ThemedView>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    maxHeight: '80%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    flex: 1,
    fontSize: 22,
    marginRight: 12,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    maxHeight: 400,
  },
  modalInfoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modalBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  modalBadgeText: {
    fontWeight: '700',
    fontSize: 14,
  },
  modalDescription: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modalButtons: {
    gap: 8,
  },
  filtersContainer: {
    marginTop: 12,
    marginBottom: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f5f5f5',
  },
  filterButtonActive: {
    backgroundColor: '#0a7aff',
    borderColor: '#0a7aff',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: '#fff',
  },
  prerequisiteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  prerequisiteText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalPrerequisiteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalPrerequisiteLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.8,
  },
  modalPrerequisiteText: {
    fontSize: 15,
    fontWeight: '700',
  },
  imagePickerButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  imagePreviewContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImageContainer: {
    width: '100%',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
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

function normalizeMissionKey(value?: string | null) {
  if (!value) return null;
  const base = slugify(value);
  if (!base) return null;
  return base.replace(/-\d+$/g, '');
}
