import { useCustomAlert } from '@/components/CustomAlert';
import { ThemedButton } from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth, type FontSize } from '../../contexts/AuthContext';

export default function ConfiguracionScreen() {
  const { profile, updateDarkMode, updateFontSize, refreshProfile, logout } = useAuth();
  const alert = useCustomAlert();
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  const [darkMode, setDarkMode] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>('medium');

  // Cargar configuración del perfil
  useEffect(() => {
    if (profile) {
      setDarkMode(profile.dark_mode ?? false);
      setFontSize(profile.font_size ?? 'medium');
    }
  }, [profile]);

  const handleDarkModeToggle = async (value: boolean) => {
    try {
      setSavingConfig(true);
      // Actualizar en la base de datos
      await updateDarkMode(value);
      // Actualizar el estado local
      setDarkMode(value);
      // refreshProfile ya se llama dentro de updateDarkMode, pero lo llamamos de nuevo
      // para asegurar que el ThemeContext se actualice inmediatamente
      await refreshProfile();
      // El ThemeContext se actualizará automáticamente cuando cambie el perfil
      await alert.show({ title: 'Éxito', message: 'Modo oscuro actualizado correctamente.', buttons: [{ text: 'OK' }] });
    } catch (error: any) {
      console.error('[Configuración] Error al actualizar modo oscuro:', error);
      await alert.show({ title: 'Error', message: error.message ?? 'No se pudo actualizar la configuración', buttons: [{ text: 'OK' }] });
      // Revertir el cambio si falla
      setDarkMode(!value);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleFontSizeChange = async (value: FontSize) => {
    if (value === fontSize) return;
    try {
      setSavingConfig(true);
      await updateFontSize(value);
      setFontSize(value);
      await refreshProfile();
      await alert.show({
        title: 'Éxito',
        message: 'Tamaño de letra actualizado correctamente.',
        buttons: [{ text: 'OK' }],
      });
    } catch (error: any) {
      console.error('[Configuración] Error al actualizar tamaño de letra:', error);
      await alert.show({
        title: 'Error',
        message: error.message ?? 'No se pudo actualizar el tamaño de letra',
        buttons: [{ text: 'OK' }],
      });
    } finally {
      setSavingConfig(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={isDark ? Colors.dark.tint : Colors.light.tint} />
          <ThemedText style={styles.loadingText}>Cargando configuración...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          activeOpacity={0.7}>
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={isDark ? Colors.dark.text : Colors.light.text}
          />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.headerTitle}>
          Configuración
        </ThemedText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        
        {/* Sección de Apariencia */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Apariencia
          </ThemedText>

          {/* Modo Oscuro */}
          <ThemedView
            style={[styles.configOption, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#fafafa"
            darkColor="#1a1a2e">
            <View style={styles.configOptionContent}>
              <View style={styles.configOptionInfo}>
                <MaterialIcons
                  name="dark-mode"
                  size={24}
                  color={isDark ? Colors.dark.icon : Colors.light.icon}
                />
                <View style={styles.configOptionText}>
                  <ThemedText type="defaultSemiBold" style={styles.configOptionTitle}>
                    Modo Oscuro
                  </ThemedText>
                  <ThemedText style={styles.configOptionDescription}>
                    Activa el tema oscuro para la aplicación
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={handleDarkModeToggle}
                disabled={savingConfig}
                trackColor={{ false: '#767577', true: Colors[theme].tint }}
                thumbColor={darkMode ? '#fff' : '#f4f3f4'}
              />
            </View>
          </ThemedView>
        </ThemedView>

        {/* Tamaño de letra */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Tamaño de letra
          </ThemedText>

          <ThemedView
            style={[styles.configOption, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#fafafa"
            darkColor="#1a1a2e">
            <View style={styles.configOptionContent}>
              <View style={styles.configOptionInfo}>
                <MaterialIcons
                  name="text-fields"
                  size={24}
                  color={isDark ? Colors.dark.icon : Colors.light.icon}
                />
                <View style={styles.configOptionText}>
                  <ThemedText type="defaultSemiBold" style={styles.configOptionTitle}>
                    Tamaño de letra
                  </ThemedText>
                  <ThemedText style={styles.configOptionDescription}>
                    Ajusta el tamaño del texto en los botones principales
                  </ThemedText>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <ThemedButton
                  title="Pequeña"
                  onPress={() => handleFontSizeChange('small')}
                  disabled={savingConfig}
                  style={{ opacity: fontSize === 'small' ? 1 : 0.6, paddingHorizontal: 10 }}
                />
                <ThemedButton
                  title="Media"
                  onPress={() => handleFontSizeChange('medium')}
                  disabled={savingConfig}
                  style={{ opacity: fontSize === 'medium' ? 1 : 0.6, paddingHorizontal: 10 }}
                />
                <ThemedButton
                  title="Grande"
                  onPress={() => handleFontSizeChange('large')}
                  disabled={savingConfig}
                  style={{ opacity: fontSize === 'large' ? 1 : 0.6, paddingHorizontal: 10 }}
                />
              </View>
            </View>
          </ThemedView>
        </ThemedView>

        {/* Información adicional */}
        <ThemedView
          style={[styles.infoCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
          lightColor="#f9f9f9"
          darkColor="#1a1a2e">
          <MaterialIcons
            name="info"
            size={20}
            color={isDark ? Colors.dark.icon : Colors.light.icon}
            style={styles.infoIcon}
          />
          <ThemedText style={styles.infoText}>
            💡 Algunos cambios pueden requerir reiniciar la aplicación para aplicarse completamente.
          </ThemedText>
        </ThemedView>

        {/* Información de la cuenta */}
        <ThemedView style={styles.section}>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Información de la cuenta
          </ThemedText>
          <ThemedView
            style={[styles.infoCard, { borderColor: isDark ? '#2a2a3e' : '#e0e0e0' }]}
            lightColor="#f9f9f9"
            darkColor="#1a1a2e">
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Email:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.email ?? 'No disponible'}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Rol:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.role}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Nivel:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.level ?? 1}</ThemedText>
            </View>
            <View style={styles.infoRow}>
              <ThemedText style={styles.infoLabel}>Puntos:</ThemedText>
              <ThemedText style={styles.infoValue}>{profile.points?.toLocaleString() ?? 0}</ThemedText>
            </View>
          </ThemedView>
        </ThemedView>
        {/* Botón de cerrar sesión */}
        <ThemedView style={{ marginBottom: 24 }}>
          <ThemedButton
            title="Cerrar sesión"
            onPress={async () => {
              try {
                const idx = await alert.show({
                  title: 'Cerrar sesión',
                  message: '¿Deseas cerrar sesión?',
                  buttons: [ { text: 'Cancelar', style: 'cancel' }, { text: 'Cerrar sesión', style: 'destructive' } ]
                });
                if (idx === 1) {
                  await logout();
                  router.replace('/(auth)/login');
                }
              } catch (e) {
                console.warn('Logout error', e);
                await alert.show({ title: 'Error', message: 'No se pudo cerrar la sesión', buttons: [{ text: 'OK' }] });
              }
            }}
            style={{ marginHorizontal: 16 }}
          />
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    marginBottom: 16,
    fontSize: 18,
  },
  configOption: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  configOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  configOptionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 16,
  },
  configOptionText: {
    marginLeft: 12,
    flex: 1,
  },
  configOptionTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  configOptionDescription: {
    fontSize: 14,
    opacity: 0.7,
  },
  infoCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  infoIcon: {
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
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
});

