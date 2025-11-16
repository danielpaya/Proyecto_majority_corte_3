import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginScreen() {
  const router = useRouter();
  const { login, refreshProfile } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Campos incompletos', 'Por favor completa todos los campos.');
      return;
    }

    try {
      setLoading(true);

      // 1) Login a través del AuthContext (signIn + upsert de perfil)
      await login(email.trim(), password);

      // 2) Traer el perfil actualizado desde public.profiles
      const profile = await refreshProfile();

      if (!profile) {
        Alert.alert(
          'Error',
          'No se encontró el perfil asociado al usuario. Intenta cerrar sesión y volver a entrar.'
        );
        return;
      }

      // 3) Navegación según onboarding_complete
      if (!profile.onboarding_complete) {
        Alert.alert(
          'Bienvenido 👋',
          'Parece que aún no has completado tu configuración inicial.'
        );
        router.replace('/onboarding/avatar');
      } else {
        Alert.alert('Inicio de sesión exitoso', 'Bienvenido a Majority Quest 🎯');
        router.replace('/main/misiones');
      }
    } catch (error: any) {
      console.log('[Login] error:', error);
      Alert.alert('Error de autenticación', error.message ?? 'No se pudo iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0C5C66', '#3AD9C2', '#4C39C3']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.inner}
      >
        <Text style={styles.title}>Majority Quest</Text>
        <Text style={styles.subtitle}>Inicia sesión para continuar</Text>

        <View style={styles.form}>
          <TextInput
            placeholder="Correo electrónico"
            placeholderTextColor="#d8f3f0"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View style={styles.passwordRow}>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor="#d8f3f0"
              value={password}
              onChangeText={setPassword}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.showButton}
              onPress={() => setShowPassword((prev) => !prev)}
            >
              <Text style={styles.showButtonText}>
                {showPassword ? '👁' : '🙈'}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Ingresar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.linkText}>
              ¿No tienes cuenta? <Text style={styles.bold}>Regístrate</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 36,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#E0F8F6',
    marginBottom: 32,
  },
  form: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    columnGap: 8,
  },
  showButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  showButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  button: {
    backgroundColor: '#0C5C66',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkText: {
    color: '#fff',
    textAlign: 'center',
    fontSize: 14,
  },
  bold: {
    fontWeight: '700',
    color: '#4C39C3',
  },
});
