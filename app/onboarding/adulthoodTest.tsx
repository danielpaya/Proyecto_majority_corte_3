import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../utils/supabase';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';

export default function AdulthoodTest() {
  const router = useRouter();
  const { user } = useAuth();
  const [answers, setAnswers] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState(false);

  // 🧠 Preguntas base (podrás agregar más fácilmente)
  const questions = [
    '¿Ya sacaste tu cédula de ciudadanía?',
    '¿Tienes tu libreta militar?',
    '¿Tienes una cuenta bancaria a tu nombre?',
    '¿Has pagado algún servicio (agua, luz, internet, etc.)?',
    '¿Tienes un plan de salud (EPS o medicina prepagada)?',
    '¿Has aplicado o estás estudiando en la universidad?',
    '¿Tienes o estás buscando trabajo actualmente?',
  ];

  // 🟩 Responder una pregunta
  const handleSelect = (index: number, value: string) => {
    setAnswers({ ...answers, [index]: value });
  };

  // 📊 Enviar resultados
  const handleSubmit = async () => {
    if (Object.keys(answers).length < questions.length) {
      Alert.alert('Faltan preguntas', 'Por favor responde todas las preguntas.');
      return;
    }

    try {
      setLoading(true);

      // Calcular puntaje simple
      const total = Object.values(answers).filter((a) => a === 'sí').length;
      const maturityScore = Math.round((total / questions.length) * 100);

      // Guardar resultados
      const { error: insertError } = await supabase.from('adulthood_test').insert([
        {
          user_id: user?.id,
          answers,
          score: maturityScore,
        },
      ]);

      if (insertError) throw insertError;

      // Actualizar perfil
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ onboarding_complete: true })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      Alert.alert(
        'Test completado 🎉',
        `Tu puntaje de madurez es ${maturityScore}%. ¡Bienvenido a Majority Quest!`
      );

      router.replace('/main/home');
    } catch (error: any) {
      Alert.alert('Error', error.message);
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Test de Adultez</Text>
        <Text style={styles.subtitle}>
          Responde con sinceridad las siguientes preguntas
        </Text>

        {questions.map((q, index) => (
          <View key={index} style={styles.questionBlock}>
            <Text style={styles.questionText}>{q}</Text>
            <View style={styles.optionsRow}>
              {['sí', 'parcialmente', 'no'].map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionButton,
                    answers[index] === opt && styles.optionSelected,
                  ]}
                  onPress={() => handleSelect(index, opt)}
                >
                  <Text style={styles.optionText}>{opt.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Finalizar Test</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 20, paddingBottom: 60 },
  title: {
    fontSize: 30,
    color: '#fff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 40,
  },
  subtitle: {
    color: '#d8f3f0',
    textAlign: 'center',
    marginBottom: 30,
  },
  questionBlock: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 18,
  },
  questionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  optionButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  optionSelected: {
    backgroundColor: '#3AD9C2',
  },
  optionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  submitButton: {
    backgroundColor: '#0C5C66',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 30,
  },
  submitText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
