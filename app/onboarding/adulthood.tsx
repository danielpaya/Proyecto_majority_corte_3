// app/onboarding/adulthood.tsx (fragmento clave)
import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Button } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdulthoodQuestions } from '../../hooks/useAdulthoodQuestions';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';


const OPTION_LABEL: Record<'yes'|'in_progress'|'no'|'na', string> = {
  yes: 'Sí',
  in_progress: 'En proceso',
  no: 'No',
  na: 'N/A',
};

type AnswerKey = 'yes'|'in_progress'|'no'|'na';

export default function Adulthood() {
  const { profile, getEligibilityFlags, markOnboardingComplete } = useAuth();
  const flags = getEligibilityFlags();

  const { questions, answers, setAnswer } = useAdulthoodQuestions(flags, {
    gender: profile?.gender ?? null,
    birth_date: profile?.birth_date ?? null,
  });

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Test de Adultez</Text>
        <Text style={styles.subtitle}>Responde las preguntas y avanza a tus misiones sugeridas</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {questions.map(q => (
          <View key={q.slug} style={styles.card}>
            <Text style={styles.qtext}>{q.text}</Text>

            <View style={styles.optionsRow}>
              {(['yes','in_progress','no','na'] as AnswerKey[]).map(opt => {
                const selected = answers[q.slug] === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setAnswer(q.slug, opt)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && styles.chipPressed,
                    ]}
                  >
                    <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                      {OPTION_LABEL[opt]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <View style={{ height: 24 }} />
        <Button
          title="Finalizar"
          onPress={async () => {
            // TODO: calcular y guardar score si lo necesitas
            await markOnboardingComplete(true);
            router.replace('../main/home'); // o la ruta que quieras abrir luego
          }}
        />
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '800' },
  subtitle: { fontSize: 13, color: '#666', marginTop: 2 },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  qtext: { fontSize: 16, fontWeight: '600', color: '#222', marginBottom: 10 },
  optionsRow: { flexDirection: 'row', flexWrap: 'wrap' },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d9d9d9',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#0a7aff15',
    borderColor: '#0a7aff',
  },
  chipPressed: {
    opacity: 0.9,
  },
  chipLabel: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
  },
  chipLabelSelected: {
    color: '#0a7aff',
  },
});
