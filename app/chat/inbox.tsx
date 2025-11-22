// app/chat/inbox.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listThreads } from '@/app/data/chatApi';
import type { ChatThread } from '@/app/types/chat';
import { FabChat } from '@/components/FabChat';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function ChatInboxScreen() {
  const router = useRouter();
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadThreads = useCallback(async () => {
    try {
      setRefreshing(true);
      const data = await listThreads();
      setThreads(data);
    } catch (error) {
      console.log('[ChatInboxScreen] error listando threads:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  const renderItem = ({ item }: { item: ChatThread }) => {
    const subtitle =
      item.last_message_preview ??
      (item.character === 'aria'
        ? 'Habla con Aria sobre cómo te sientes hoy.'
        : 'Chat IA');

    const characterLabel =
      item.character === 'aria'
        ? 'Aria · Bienestar'
        : item.character === 'max'
        ? 'Max · Vida práctica'
        : 'Luz · Decisiones';

    return (
      <TouchableOpacity
        style={styles.threadItem}
        onPress={() => router.push(`/chat/conversation/${item.id}`)}
      >
        <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#2a2a3e' : '#dfe6ff' }]}>
          <ThemedText style={[styles.avatarInitial, { color: isDark ? '#4a9eff' : '#4450aa' }]}>
            {item.character === 'aria' ? 'A' : item.character === 'max' ? 'M' : 'L'}
          </ThemedText>
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText type="defaultSemiBold" style={styles.threadTitle}>{item.title || characterLabel}</ThemedText>
          <ThemedText style={styles.threadSubtitle} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? Colors.dark.background : Colors.light.background }]}>
      <ThemedView style={styles.container}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={styles.headerTitle}>Tus chats</ThemedText>
          <TouchableOpacity onPress={() => router.push('/chat/new')}>
            <ThemedText style={[styles.headerAction, { color: isDark ? '#4a9eff' : '#4450aa' }]}>Nuevo chat</ThemedText>
          </TouchableOpacity>
        </View>

        <FlatList
          data={threads}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={
            threads.length === 0 ? styles.emptyContainer : undefined
          }
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={loadThreads} />
          }
          ListEmptyComponent={
            <ThemedText style={styles.emptyText}>
              Aún no tienes conversaciones. Toca "Nuevo chat" para hablar con Aria.
            </ThemedText>
          }
        />
      </ThemedView>
      <FabChat />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' },
  headerAction: { fontSize: 14, fontWeight: '500' },
  threadItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 20, fontWeight: '700' },
  threadTitle: { fontSize: 15, marginBottom: 2 },
  threadSubtitle: { fontSize: 13, opacity: 0.7 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { textAlign: 'center', opacity: 0.7, fontSize: 14 },
});
