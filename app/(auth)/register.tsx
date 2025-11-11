// app/(auth)/register.tsx
import React, { useRef, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
    <SafeAreaView style={styles.safe}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <View style={styles.card}>
              <Text style={styles.title}>Crear cuenta</Text>
              <Text style={styles.subtitle}>Completa tus datos para registrarte.</Text>

              {/* Email */}
              <Text style={styles.label}>Correo</Text>
              <TextInput
                style={styles.input}
                placeholder="tu@email.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                returnKeyType="next"
                textContentType="emailAddress"
                onSubmitEditing={() => passRef.current?.focus()}
              />

              {/* Password */}
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  ref={passRef}
                  style={[styles.input, styles.inputPassword]}
                  placeholder="••••••••"
                  secureTextEntry={secure}
                  value={password}
                  onChangeText={setPassword}
                  returnKeyType="next"
                  textContentType="password"
                  onSubmitEditing={() => nameRef.current?.focus()}
                />
                <Pressable onPress={() => setSecure(s => !s)} style={styles.eye}>
                  <Text style={styles.eyeIcon}>{secure ? '👁' : '🙈'}</Text>
                </Pressable>
              </View>

              {/* Nombre / Apellido */}
              <Text style={styles.label}>Nombre</Text>
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={name}
                onChangeText={setName}
                returnKeyType="next"
                onSubmitEditing={() => lastRef.current?.focus()}
              />

              <Text style={styles.label}>Apellido</Text>
              <TextInput
                ref={lastRef}
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                returnKeyType="next"
                onSubmitEditing={() => dobRef.current?.focus()}
              />

              {/* Fecha de nacimiento */}
              <Text style={styles.label}>Fecha de nacimiento (DD/MM/AAAA)</Text>
              <TextInput
                ref={dobRef}
                style={styles.input}
                placeholder="__/__/____"
                keyboardType="number-pad"
                value={dobMask}
                onChangeText={txt => setDobMask(maskDMY(txt))}
                maxLength={10}
                returnKeyType="done"
              />

              {/* Género */}
              <Text style={styles.label}>Género</Text>
              <View style={styles.pillsRow}>
                <GenderOption value="Masculino" label="Hombre" />
                <GenderOption value="Femenino" label="Mujer" />
                <GenderOption value="Otro" label="Otro" />
              </View>

              {/* Rol */}
              <Text style={styles.label}>Rol</Text>
              <View style={styles.pillsRow}>
                <Pressable
                  onPress={() => setRole('CLIENT')}
                  style={[styles.pill, role === 'CLIENT' && styles.pillSelected]}
                >
                  <Text
                    style={[styles.pillText, role === 'CLIENT' && styles.pillTextSelected]}
                  >
                    Usuario
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setRole('ADMIN')}
                  style={[styles.pill, role === 'ADMIN' && styles.pillSelected]}
                >
                  <Text
                    style={[styles.pillText, role === 'ADMIN' && styles.pillTextSelected]}
                  >
                    Administrador
                  </Text>
                </Pressable>
              </View>

              {/* Modal admin */}
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

              {/* Botón principal */}
              <Pressable
                style={[styles.button, (loading || !role) && { opacity: 0.7 }]}
                onPress={handleRegister}
                disabled={loading || !role}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Registrando usuario…' : 'Registrarse'}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
    </SafeAreaView>
  );
}

/* ==== Estilos (alineados con login.tsx) ==== */
const colors = {
  bg: '#f3f4f6',
  card: '#ffffff',
  primary: '#437057',
  primarySoft: '#97B067',
  text: '#0F172A',
  subtext: '#6b7280',
  divider: '#E5E7EB',
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 16 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', color: colors.text },
  subtitle: {
    fontSize: 14,
    color: colors.subtext,
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 12,
  },

  label: { fontSize: 13, fontWeight: '600', marginTop: 10, color: colors.text },
  input: {
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    marginTop: 6,
    backgroundColor: 'white',
    color: colors.text,
  },

  passwordRow: { position: 'relative' },
  inputPassword: { paddingRight: 44 },
  eye: { position: 'absolute', right: 10, top: 14, padding: 6, borderRadius: 8 },
  eyeIcon: { fontSize: 16 },

  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4, marginTop: 6 },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 999,
    backgroundColor: '#EEF7F1',
  },
  pillSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  pillText: { color: colors.primary, fontWeight: '700' },
  pillTextSelected: { color: 'white', fontWeight: '700' },

  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },

  /* Modal admin */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '92%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  modalTitle: { fontSize: 18, fontWeight: '800', textAlign: 'center', color: colors.text },
  modalSubtitle: {
    fontSize: 13,
    color: colors.subtext,
    marginTop: 4,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 10,
    padding: 10,
    backgroundColor: '#fafafa',
    color: colors.text,
  },
  modalError: { color: '#c00', textAlign: 'center', marginTop: 6 },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 12,
  },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#eee' },
  modalBtnConfirm: { backgroundColor: colors.primary },
  modalBtnTextCancel: { color: colors.text, fontWeight: '700' },
  modalBtnTextConfirm: { color: 'white', fontWeight: '800' },
});
