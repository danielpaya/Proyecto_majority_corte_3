import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuth, type AppGender } from '../../contexts/AuthContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { AvatarPreview } from '@/components/AvatarPreview';
import { catalog_tmplx01 } from '../data/avatarCatalog';
import type { AvatarLayer } from '../data/avatarCatalog';
import { FabChat } from '@/components/FabChat';

export default function PerfilScreen() {
  const { profile, updateProfile, refreshProfile } = useAuth();
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<AppGender | null>(null);
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Cargar datos del perfil
  useEffect(() => {
    if (profile) {
      setName(profile.name ?? '');
      setLastName(profile.last_name ?? '');
      setGender(profile.gender);
      if (profile.birth_date) {
        setBirthDate(new Date(profile.birth_date));
      } else {
        setBirthDate(null);
      }
      setHasChanges(false);
    }
  }, [profile]);

  // Detectar cambios
  useEffect(() => {
    if (!profile) return;
    const changed =
      name !== (profile.name ?? '') ||
      lastName !== (profile.last_name ?? '') ||
      gender !== profile.gender ||
      (birthDate
        ? birthDate.toISOString().split('T')[0] !== profile.birth_date
        : profile.birth_date !== null);
    setHasChanges(changed);
  }, [name, lastName, gender, birthDate, profile]);

  const handleSave = async () => {
    if (!hasChanges) {
      Alert.alert('Sin cambios', 'No hay cambios para guardar');
      return;
    }

    try {
      setSaving(true);

      const updates: {
        name?: string;
        last_name?: string;
        gender?: AppGender | null;
        birth_date?: string | null;
      } = {};

      if (name !== (profile?.name ?? '')) {
        updates.name = name.trim() || null;
      }
      if (lastName !== (profile?.last_name ?? '')) {
        updates.last_name = lastName.trim() || null;
      }
      if (gender !== profile?.gender) {
        updates.gender = gender;
      }
      if (birthDate) {
        const isoDate = birthDate.toISOString().split('T')[0];
        if (isoDate !== profile?.birth_date) {
          updates.birth_date = isoDate;
        }
      } else if (profile?.birth_date !== null) {
        updates.birth_date = null;
      }

      await updateProfile(updates);
      await refreshProfile();

      Alert.alert('Éxito', 'Perfil actualizado correctamente');
      setHasChanges(false);
    } catch (error: any) {
      console.error('[Perfil] Error al guardar:', error);
      Alert.alert('Error', error.message ?? 'No se pudo actualizar el perfil');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'Seleccionar fecha';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Avatar seleccionado
  const avatarSelected =
    profile?.avatar_template_id === 'tmplx01'
      ? {
          skin_base:
            (profile?.avatar_config as Record<AvatarLayer, string> | null)?.skin_base ??
            catalog_tmplx01.defaults.skin_base,
          skin_overlay:
            (profile?.avatar_config as Record<AvatarLayer, string> | null)?.skin_overlay ??
            catalog_tmplx01.defaults.skin_overlay,
          eyes:
            (profile?.avatar_config as Record<AvatarLayer, string> | null)?.eyes ??
            catalog_tmplx01.defaults.eyes,
          outline:
            (profile?.avatar_config as Record<AvatarLayer, string> | null)?.outline ??
            catalog_tmplx01.defaults.outline,
        }
      : null;

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Cargando perfil...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }


  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      {/* Header con botón de configuración */}
      <View style={styles.topBar}>
        <View style={styles.topBarSpacer} />
        <ThemedText type="title" style={styles.topBarTitle}>
          Mi Perfil
        </ThemedText>
        <TouchableOpacity
          style={styles.configButton}
          onPress={() => router.push('/main/configuracion')}
          activeOpacity={0.6}
          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
          <View style={styles.configButtonInner}>
            <MaterialIcons
              name="settings"
              size={26}
              color={isDark ? Colors.dark.icon : Colors.light.icon}
            />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        
        {/* Header con Avatar */}
        <ThemedView style={styles.header}>
          {avatarSelected && (
            <View style={styles.avatarContainer}>
              <AvatarPreview catalog={catalog_tmplx01} selected={avatarSelected} size={100} />
            </View>
          )}
        </ThemedView>

        {/* Información de cuenta (solo lectura) */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Información de cuenta
          </ThemedText>
          <ThemedView
            style={[styles.inputContainer, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#fafafa"
            darkColor="#1a1a2e">
            <ThemedText style={styles.label}>Email</ThemedText>
            <ThemedText style={styles.readOnlyValue}>{profile.email ?? 'No disponible'}</ThemedText>
            <ThemedText style={styles.readOnlyHint}>El email no se puede cambiar</ThemedText>
          </ThemedView>
        </ThemedView>

        {/* Datos personales */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Datos personales
          </ThemedText>

          {/* Nombre */}
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.label}>Nombre</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1a1a2e' : '#fff',
                  color: isDark ? Colors.dark.text : Colors.light.text,
                  borderColor: isDark ? '#2a2a3e' : '#e0e0e0',
                },
              ]}
              value={name}
              onChangeText={setName}
              placeholder="Ingresa tu nombre"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          {/* Apellido */}
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.label}>Apellido</ThemedText>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? '#1a1a2e' : '#fff',
                  color: isDark ? Colors.dark.text : Colors.light.text,
                  borderColor: isDark ? '#2a2a3e' : '#e0e0e0',
                },
              ]}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Ingresa tu apellido"
              placeholderTextColor={isDark ? '#666' : '#999'}
            />
          </View>

          {/* Género */}
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.label}>Género</ThemedText>
            <View
              style={[
                styles.pickerContainer,
                {
                  backgroundColor: isDark ? '#1a1a2e' : '#fff',
                  borderColor: isDark ? '#2a2a3e' : '#e0e0e0',
                },
              ]}>
              <Picker
                selectedValue={gender}
                onValueChange={(value) => setGender(value as AppGender | null)}
                style={{ color: isDark ? Colors.dark.text : Colors.light.text }}
                dropdownIconColor={isDark ? Colors.dark.text : Colors.light.text}>
                <Picker.Item label="Seleccionar..." value={null} />
                <Picker.Item label="Masculino" value="Masculino" />
                <Picker.Item label="Femenino" value="Femenino" />
                <Picker.Item label="Otro" value="Otro" />
              </Picker>
            </View>
          </View>

          {/* Fecha de nacimiento */}
          <View style={styles.inputWrapper}>
            <ThemedText style={styles.label}>Fecha de nacimiento</ThemedText>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={[
                styles.dateButton,
                {
                  backgroundColor: isDark ? '#1a1a2e' : '#fff',
                  borderColor: isDark ? '#2a2a3e' : '#e0e0e0',
                },
              ]}>
              <ThemedText style={[styles.dateText, { color: birthDate ? (isDark ? Colors.dark.text : Colors.light.text) : (isDark ? '#666' : '#999') }]}>
                {formatDate(birthDate)}
              </ThemedText>
              <MaterialIcons
                name="calendar-today"
                size={20}
                color={isDark ? Colors.dark.icon : Colors.light.icon}
              />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={birthDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === 'android') {
                    setShowDatePicker(false);
                  }
                  if (event.type === 'set' && selectedDate) {
                    setBirthDate(selectedDate);
                  }
                  if (Platform.OS === 'ios') {
                    // En iOS, el picker se mantiene abierto hasta que se presiona "Done"
                    // Aquí puedes agregar lógica adicional si es necesario
                  }
                }}
                maximumDate={new Date()}
              />
            )}
            {Platform.OS === 'ios' && showDatePicker && (
              <View style={styles.iosDatePickerActions}>
                <TouchableOpacity
                  style={[styles.iosDatePickerButton, { backgroundColor: Colors[theme].tint }]}
                  onPress={() => setShowDatePicker(false)}>
                  <ThemedText style={[styles.iosDatePickerButtonText, { color: '#fff' }]}>Listo</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ThemedView>

        {/* Botón de guardar */}
        <TouchableOpacity
          style={[
            styles.saveButton,
            {
              backgroundColor: hasChanges ? Colors[theme].tint : (isDark ? '#2a2a3e' : '#e0e0e0'),
              opacity: hasChanges ? 1 : 0.5,
            },
          ]}
          onPress={handleSave}
          disabled={!hasChanges || saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="save" size={20} color="#fff" />
              <ThemedText style={[styles.saveButtonText, { color: '#fff' }]}>
                Guardar cambios
              </ThemedText>
            </>
          )}
        </TouchableOpacity>

        {/* Información adicional */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Información adicional
          </ThemedText>
          <ThemedView
            style={[styles.infoCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#f9f9f9"
            darkColor="#1a1a2e">
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Nivel:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.level ?? 1}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Puntos:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.points?.toLocaleString() ?? 0}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Rol:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.role}</ThemedText>
            </View>
          </ThemedView>
        </ThemedView>

        {/* Botón de cartera */}
        <ThemedView style={styles.section}>
          <TouchableOpacity
            style={[
              styles.walletButton,
              {
                backgroundColor: isDark ? '#2a2a3e' : '#f0f0f0',
                borderColor: isDark ? '#3a3a4e' : '#e0e0e0',
              },
            ]}
            onPress={() => router.push('/main/cartera')}
            activeOpacity={0.7}>
            <View style={styles.walletButtonContent}>
              <MaterialIcons
                name="account-balance-wallet"
                size={24}
                color={isDark ? Colors.dark.tint : Colors.light.tint}
              />
              <View style={styles.walletButtonText}>
                <ThemedText type="defaultSemiBold" style={styles.walletButtonTitle}>
                  Mi Cartera
                </ThemedText>
                <ThemedText style={styles.walletButtonSubtitle}>
                  Agregar dinero y gestionar planes
                </ThemedText>
              </View>
              <MaterialIcons
                name="chevron-right"
                size={24}
                color={isDark ? Colors.dark.icon : Colors.light.icon}
              />
            </View>
          </TouchableOpacity>
        </ThemedView>
      </ScrollView>
      <FabChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    zIndex: 5,
    elevation: 5,
    backgroundColor: 'transparent',
  },
  topBarSpacer: {
    width: 40,
  },
  topBarTitle: {
    flex: 1,
    textAlign: 'center',
  },
  configButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  configButtonInner: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: 'transparent',
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
  title: {
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 18,
  },
  inputContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  readOnlyValue: {
    fontSize: 16,
    marginBottom: 4,
  },
  readOnlyHint: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    minHeight: 48,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 48,
  },
  dateText: {
    fontSize: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 24,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  iosDatePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: 8,
  },
  iosDatePickerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  iosDatePickerButtonText: {
    fontWeight: '600',
  },
  walletButton: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginTop: 8,
  },
  walletButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  walletButtonText: {
    flex: 1,
  },
  walletButtonTitle: {
    fontSize: 16,
    marginBottom: 2,
  },
  walletButtonSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
});

