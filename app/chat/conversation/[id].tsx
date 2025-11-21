// app/chat/conversation/[id].tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getThread, getMessages, appendMessage, callAriaBackend } from '@/app/data/chatApi';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChatThread, ChatMessage } from '@/app/types/chat';

export default function ChatConversationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [thread, setThread] = useState<ChatThread | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');

  const isAria = thread?.character === 'aria';

  const loadAll = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [t, m] = await Promise.all([getThread(id), getMessages(id)]);
      setThread(t);
      setMessages(m);
    } catch (error) {
      console.log('[ChatConversation] error loading:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const handleSend = useCallback(async () => {
    if (!thread || !input.trim() || sending) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      const userMsg = await appendMessage({
        threadId: thread.id,
        role: 'user',
        content,
      });
      setMessages((prev) => [...prev, userMsg]);

      const history = [...messages, userMsg]
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content }));

      const ai = await callAriaBackend({
        threadId: thread.id,
        history,
        newUserMessage: content,
      });

      const ariaMsg = await appendMessage({
        threadId: thread.id,
        role: 'assistant',
        content: ai.answer,
        tokensIn: ai.tokensIn ?? null,
        tokensOut: ai.tokensOut ?? null,
      });
      setMessages((prev) => [...prev, ariaMsg]);
    } catch (error) {
      console.log('[ChatConversation] error sending:', error);
    } finally {
      setSending(false);
    }
  }, [thread, input, sending, messages]);


  const headerTitle = useMemo(() => {
    if (!thread) return 'Chat';
    if (thread.character === 'aria') return 'Aria · Bienestar';
    if (thread.character === 'max') return 'Max · Vida práctica';
    return 'Luz · Decisiones';
  }, [thread]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8 }}>Cargando conversación...</Text>
      </View>
    );
  }

  if (!thread) {
    return (
      <View style={styles.loadingContainer}>
        <Text>No se encontró este chat.</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: '#4450aa', marginTop: 8 }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
    >
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          {/* Header simple */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.headerBack}>{'< Atrás'}</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{headerTitle}</Text>
            <View style={{ width: 60 }} />
          </View>

          {/* Mensajes */}
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const isUser = item.role === 'user';
              const bubbleStyle = [
                styles.bubble,
                isUser ? styles.bubbleUser : styles.bubbleAssistant,
              ];
              const textStyle = [
                styles.bubbleText,
                isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant,
              ];

              return (
                <View
                  style={[
                    styles.messageRow,
                    isUser ? styles.rowRight : styles.rowLeft,
                  ]}
                >
                  {!isUser && isAria && (
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>A</Text>
                    </View>
                  )}
                  <View style={bubbleStyle}>
                    <Text style={textStyle}>{item.content}</Text>
                  </View>
                </View>
              );
            }}
            contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8 }}
            keyboardShouldPersistTaps="handled"
          />

          {/* Composer */}
          <View style={styles.composer}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder={
                isAria
                  ? 'Cuéntale a Aria cómo te sientes...'
                  : 'Escribe tu mensaje...'
              }
              multiline
            />
            <TouchableOpacity
              style={[styles.sendButton, sending && { opacity: 0.5 }]}
              onPress={handleSend}
              disabled={sending || !input.trim()}
            >
              {sending ? (
                <ActivityIndicator size="small" />
              ) : (
                <Text style={styles.sendText}>Enviar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );

}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#f7f8ff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    justifyContent: 'space-between',
  },
  safe: {
    flex: 1,
  },
  headerBack: { color: '#4450aa', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '600' },
  messageRow: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '75%',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
  },
  bubbleUser: {
    backgroundColor: '#4450aa',
    borderBottomRightRadius: 2,
  },
  bubbleAssistant: {
    backgroundColor: '#ffffff',
    borderBottomLeftRadius: 2,
  },
  bubbleText: { fontSize: 14 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextAssistant: { color: '#222' },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#dfe6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  avatarInitial: { fontSize: 16, fontWeight: '700', color: '#4450aa' },
  composer: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ddd',
    backgroundColor: '#fff',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    fontSize: 14,
  },
  sendButton: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#4450aa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontWeight: '600' },
});
