// app/(auth)/register.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';

/* ===== Helpers de fecha (DD/MM/AAAA) ===== */
function maskDMY(input: string) {
  const digits = input.replace(/\D/g, '').slice(0, 8);
  const parts: string[] = [];
  if (digits.length <= 2) parts.push(digits);
  else if (digits.length <= 4) parts.push(digits.slice(0, 2), digits.slice(2));
  else parts.push(digits.slice(0, 2), digits.slice(2, 4), digits.slice(4));
  return parts.join('/');
}

function dmyToISO(dmy: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  const maxByMonth = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (mm < 1 || mm > 12 || dd < 1 || dd > maxByMonth[mm - 1]) return null;
  return `${yyyy.toString().padStart(4, '0')}-${mm
    .toString()
    .padStart(2, '0')}-${dd.toString().padStart(2, '0')}`;
}

/* ===== Clave de administrador demo ===== */
const ADMIN_CODE = '1091971106';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState<'Masculino' | 'Femenino' | 'Otro' | ''>('');
  const [dobMask, setDobMask] = useState('');
  const [role, setRole] = useState<'CLIENT' | 'ADMIN' | ''>('');
  const [loading, setLoading] = useState(false);

  // modal admin
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [adminError, setAdminError] = useState('');

  // refs para navegar entre inputs
  const passRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const lastRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);

  async function doRegister(finalRole: 'CLIENT' | 'ADMIN') {
    if (!email || !password) {
      Alert.alert('Campos requeridos', 'Correo y contraseña son obligatorios');
      return;
    }

    let birth_date: string | undefined = undefined;
    if (dobMask) {
      const iso = dmyToISO(dobMask);
      if (!iso) {
        Alert.alert('Fecha inválida', 'Usa el formato DD/MM/AAAA (ej: 20/05/2000)');
        return;
      }
      birth_date = iso;
    }

    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        name,
        last_name: lastName,
        gender: gender || undefined,
        birth_date,
        role: finalRole,
      } as any); // cast rápido mientras el tipo se adapta

      Alert.alert(
        'Cuenta creada',
        'Si la confirmación por correo está activada, revisa tu bandeja de entrada.'
      );
      router.replace('/(auth)/login');
    } catch (err: any) {
      console.log('[register] error:', err);
      Alert.alert('Error al registrarse', err?.message ?? 'No se pudo crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (!role) {
      Alert.alert('Rol requerido', 'Selecciona si eres Usuario o Administrador.');
      return;
    }

    if (role === 'ADMIN') {
      setAdminError('');
      setShowAdminModal(true);
      return;
    }

    await doRegister('CLIENT');
  }

  const GenderOption = ({
    value,
    label,
  }: {
    value: 'Masculino' | 'Femenino' | 'Otro';
    label: string;
  }) => {
    const selected = gender === value;
    return (
      <Pressable
        onPress={() => setGender(value)}
        style={[styles.pill, selected && styles.pillSelected]}
      >
        <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <LinearGradient
      colors={['#0C5C66', '#3AD9C2', '#4C39C3']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Completa tus datos para registrarte</Text>

          <View style={styles.form}>
            <TextInput
              placeholder="Correo electrónico"
              placeholderTextColor="rgba(0,0,0,0.35)"
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              returnKeyType="next"
              onSubmitEditing={() => passRef.current?.focus()}
            />

            <View style={styles.passwordRow}>
              <TextInput
                ref={passRef}
                placeholder="Contraseña"
                placeholderTextColor="rgba(0,0,0,0.35)"
                value={password}
                onChangeText={setPassword}
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                secureTextEntry={secure}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.showButton}
                onPress={() => setSecure(s => !s)}
              >
                <Text style={styles.showButtonText}>{secure ? '👁' : '🙈'}</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              ref={nameRef}
              placeholder="Nombre"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.input}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
            />

            <TextInput
              ref={lastRef}
              placeholder="Apellido"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              returnKeyType="next"
            />

            <TextInput
              ref={dobRef}
              placeholder="Fecha de nacimiento (DD/MM/AAAA)"
              placeholderTextColor="rgba(0,0,0,0.35)"
              style={styles.input}
              keyboardType="number-pad"
              value={dobMask}
              onChangeText={txt => setDobMask(maskDMY(txt))}
              maxLength={10}
            />

            <View style={{ marginTop: 6, marginBottom: 6 }}>
              <Text style={{ fontWeight: '600', marginBottom: 6 }}>Género</Text>
              <View style={styles.pillsRow}>
                <GenderOption value="Masculino" label="Hombre" />
                <GenderOption value="Femenino" label="Mujer" />
                <GenderOption value="Otro" label="Otro" />
              </View>
            </View>

            <View style={{ marginTop: 6 }}>
              <Text style={{ fontWeight: '600', marginBottom: 6 }}>Rol</Text>
              <View style={styles.pillsRow}>
                <Pressable
                  onPress={() => setRole('CLIENT')}
                  style={[styles.pill, role === 'CLIENT' && styles.pillSelected]}
                >
                  <Text style={[styles.pillText, role === 'CLIENT' && styles.pillTextSelected]}>Usuario</Text>
                </Pressable>

                <Pressable
                  onPress={() => setRole('ADMIN')}
                  style={[styles.pill, role === 'ADMIN' && styles.pillSelected]}
                >
                  <Text style={[styles.pillText, role === 'ADMIN' && styles.pillTextSelected]}>Administrador</Text>
                </Pressable>
              </View>
            </View>

            {/* Modal admin (kept intact) */}
            <Modal
              visible={showAdminModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowAdminModal(false)}
            >
              <View style={styles.modalBackdrop}>
                <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Verificación de administrador</Text>
                  <Text style={styles.modalSubtitle}>
                    Ingresa la contraseña de administrador para continuar.
                  </Text>

                  <TextInput
                    style={styles.modalInput}
                    secureTextEntry
                    value={adminCode}
                    onChangeText={t => {
                      setAdminCode(t);
                      if (adminError) setAdminError('');
                    }}
                    placeholder="Contraseña"
                  />

                  {!!adminError && (
                    <Text style={styles.modalError}>{adminError}</Text>
                  )}

                  <View style={styles.modalButtons}>
                    <Pressable
                      style={[styles.modalBtn, styles.modalBtnCancel]}
                      onPress={() => {
                        setShowAdminModal(false);
                        setAdminCode('');
                        setAdminError('');
                        setRole('');
                      }}
                    >
                      <Text style={styles.modalBtnTextCancel}>Cancelar</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.modalBtn, styles.modalBtnConfirm]}
                      onPress={async () => {
                        if (adminCode !== ADMIN_CODE) {
                          setAdminError('Contraseña incorrecta');
                          return;
                        }
                        setShowAdminModal(false);
                        await doRegister('ADMIN');
                      }}
                    >
                      <Text style={styles.modalBtnTextConfirm}>Confirmar</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </Modal>

            <TouchableOpacity
              style={styles.button}
              onPress={handleRegister}
              disabled={loading || !role}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Registrarse</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.linkText}>
                ¿Ya tienes cuenta? <Text style={styles.bold}>Ingresar</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  title: {
    fontSize: 36,
    color: '#ffffff',
    fontWeight: '700',
    marginBottom: 6,
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: { fontSize: 16, color: '#E0F8F6', marginBottom: 24 },

  form: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3.84,
  },

  input: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    color: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },

  passwordRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  showButton: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)' },
  showButtonText: { color: '#fff', fontWeight: '600', fontSize: 12 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8, marginTop: 6 },
  pill: { paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 999, backgroundColor: '#EEF7F1' },
  pillSelected: { backgroundColor: '#437057', borderColor: '#437057' },
  pillText: { color: '#437057', fontWeight: '700' },
  pillTextSelected: { color: 'white', fontWeight: '700' },

  button: { backgroundColor: '#0C5C66', paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginBottom: 10 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  linkText: { color: '#fff', textAlign: 'center', fontSize: 14 },
  bold: { fontWeight: '700', color: '#4C39C3' },

  /* Modal admin */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '92%', backgroundColor: 'white', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 5, borderWidth: 1, borderColor: '#F1F5F9' },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: '#0F172A' },
  modalSubtitle: { fontSize: 13, color: '#6b7280', marginTop: 4, marginBottom: 10, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 10, backgroundColor: '#fafafa', color: '#0F172A' },
  modalError: { color: '#c00', textAlign: 'center', marginTop: 6 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 12 },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#eee' },
  modalBtnConfirm: { backgroundColor: '#437057' },
  modalBtnTextCancel: { color: '#0F172A', fontWeight: '700' },
  modalBtnTextConfirm: { color: 'white', fontWeight: '800' },
});
