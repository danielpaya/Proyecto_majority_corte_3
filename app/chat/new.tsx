// app/chat/new.tsx
import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { createThread } from '@/app/data/chatApi';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewChatScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleCreateAriaThread = useCallback(async () => {
    try {
      setLoading(true);
      const thread = await createThread('aria', 'Charla con Aria');
      router.replace(`/chat/conversation/${thread.id}`);
    } catch (error) {
      console.log('[NewChatScreen] error creando thread Aria:', error);
      // TODO: podrías usar tu CustomAlert aquí
    } finally {
      setLoading(false);
    }
  }, [router]);

  return (
    <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
        <Text style={styles.title}>Elige con quién quieres hablar hoy</Text>

        <TouchableOpacity style={styles.card} onPress={handleCreateAriaThread} disabled={loading}>
            <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>A</Text>
            </View>
            <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Aria · Bienestar emocional</Text>
            <Text style={styles.cardSubtitle}>
                Habla sobre cómo te sientes, sin juicios. Aria te ayuda a ordenar tus emociones.
            </Text>
            </View>
        </TouchableOpacity>

        {/* Más adelante: tarjetas para Max y Luz */}

        {loading && (
            <View style={styles.loadingOverlay}>
            <ActivityIndicator />
            </View>
        )}
        </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, justifyContent: 'flex-start', gap: 16 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
   safe: {
    flex: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d0d0ff',
    backgroundColor: '#f6f7ff',
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#dfe6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarInitial: { fontSize: 24, fontWeight: '700', color: '#4450aa' },
  cardText: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: '#555' },
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
});
