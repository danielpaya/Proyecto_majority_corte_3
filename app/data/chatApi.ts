// app/data/chatApi.ts
import { supabase } from '@/utils/supabase';
import type {
  ChatCharacter,
  ChatThread,
  ChatMessage,
  ChatMessageRole,
} from '@/app/types/chat';

type AppendMessageArgs = {
  threadId: string;
  role: ChatMessageRole;
  content: string;
  tokensIn?: number | null;
  tokensOut?: number | null;
};

export async function createThread(
  character: ChatCharacter,
  initialTitle?: string
): Promise<ChatThread> {
  // 1. Obtener usuario autenticado
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.log('[chatApi] getUser error:', authError);
    throw authError;
  }
  const userId = authData?.user?.id;
  if (!userId) {
    throw new Error('No hay usuario autenticado para crear el chat');
  }

  // 2. Insertar thread con user_id
  const { data, error } = await supabase
    .from('chat_threads')
    .insert({
      user_id: userId,
      character,
      title: initialTitle ?? null,
    })
    .select('*')
    .single();

  if (error) {
    console.log('[chatApi] createThread error:', error);
    throw error;
  }

  return data as ChatThread;
}

export async function listThreads(): Promise<ChatThread[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    console.log('[chatApi] getUser error:', authError);
    throw authError;
  }
  const userId = authData?.user?.id;
  if (!userId) return [];

  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .eq('user_id', userId)
    .order('last_message_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.log('[chatApi] listThreads error:', error);
    throw error;
  }

  return (data as ChatThread[]) ?? [];
}

export async function getThread(threadId: string): Promise<ChatThread | null> {
  const { data, error } = await supabase
    .from('chat_threads')
    .select('*')
    .eq('id', threadId)
    .maybeSingle();

  if (error) {
    console.log('[chatApi] getThread error:', error);
    throw error;
  }

  return (data as ChatThread | null) ?? null;
}

export async function getMessages(threadId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) {
    console.log('[chatApi] getMessages error:', error);
    throw error;
  }

  return (data as ChatMessage[]) ?? [];
}

export async function appendMessage({
  threadId,
  role,
  content,
  tokensIn = null,
  tokensOut = null,
}: AppendMessageArgs): Promise<ChatMessage> {
  // 1) Obtener usuario autenticado
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.log('[chatApi] appendMessage getUser error:', userError);
    throw userError;
  }

  if (!user) {
    throw new Error('[chatApi] appendMessage: no hay usuario autenticado');
  }

  // 2) Insertar mensaje con user_id (clave para pasar RLS)
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      thread_id: threadId,
      user_id: user.id,
      role,
      content,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
    })
    .select('*')
    .single();

  if (error) {
    console.log('[chatApi] appendMessage error:', error);
    throw error;
  }

  // 3) Actualizar metadata del thread
  const preview =
    content.length > 120 ? content.slice(0, 117) + '…' : content;
  const now = new Date().toISOString();
  const { error: updError } = await supabase
    .from('chat_threads')
    .update({
      last_message_preview: preview,
      last_message_at: now,
    })
    .eq('id', threadId)
    .eq('user_id', user.id);

  if (updError) {
    console.log('[chatApi] update thread metadata error:', updError);
    // no lanzamos para no romper UX
  }

  return data as ChatMessage;
}

/* =========================================================
   Llamada a IA (Aria) directa a Gemini (sin backend propio)
   ========================================================= */

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL =
  process.env.EXPO_PUBLIC_GEMINI_MODEL ?? 'gemini-2.5-flash';

export async function callAriaBackend(params: {
  threadId: string;
  history: { role: ChatMessageRole; content: string }[];
  newUserMessage: string;
}): Promise<{ answer: string; tokensIn?: number | null; tokensOut?: number | null }> {
  // Si no hay API key, usamos fallback
  if (!GEMINI_API_KEY) {
    console.warn(
      '[chatApi] Falta EXPO_PUBLIC_GEMINI_API_KEY; usando respuesta dummy'
    );
    return {
      answer:
        'Soy Aria. Gracias por contarme esto. Puedo ayudarte a ordenar lo que sientes y pensar juntos tus próximos pasos. 💙',
      tokensIn: null,
      tokensOut: null,
    };
  }

  // Instrucciones de seguridad para Aria
  const systemInstructions =
    'Eres Aria, una guía amable para jóvenes de 15 a 25 años. No eres psicóloga ni médica y no puedes dar diagnósticos ni indicar tratamientos. ' +
    'Tu objetivo es escuchar con empatía, ayudar a ordenar ideas y sugerir pasos seguros: hablar con adultos de confianza, amigos, profesionales o líneas de ayuda. ' +
    'Si la persona menciona ideas de hacerse daño, suicidio, violencia o abuso, responde de forma muy cuidadosa, valida sus emociones y recomiéndale hablar con un profesional o una línea de ayuda de su país. ' +
    'Usa un tono cercano, sencillo y respetuoso, sin palabras muy técnicas. No prometas confidencialidad absoluta ni des consejos que sustituyan ayuda profesional.';

  // Mapeamos nuestro history a formato Gemini
  const historyAsContents = params.history.map((msg) => {
    let geminiRole: 'user' | 'model' = 'user';
    let text = msg.content;

    if (msg.role === 'assistant') {
      geminiRole = 'model';
    } else if (msg.role === 'system') {
      geminiRole = 'user';
      text = `[Contexto del sistema]: ${msg.content}`;
    }

    return {
      role: geminiRole,
      parts: [{ text }],
    };
  });

  const userContent = {
    role: 'user' as const,
    parts: [{ text: params.newUserMessage }],
  };

  const systemContent = {
    role: 'user' as const,
    parts: [
      {
        text: `INSTRUCCIONES (no las repitas al usuario): ${systemInstructions}`,
      },
    ],
  };

  const contents = [systemContent, ...historyAsContents, userContent];

  try {
    const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents }),
    });

    if (!res.ok) {
      console.log(
        '[chatApi] Gemini HTTP error:',
        res.status,
        await res.text()
      );
      return {
        answer:
          'Estoy teniendo problemas técnicos para procesar tu mensaje ahora mismo. Aun así, lo que sientes importa. Si es algo urgente, intenta hablar con alguien de confianza o un profesional de salud.',
        tokensIn: null,
        tokensOut: null,
      };
    }

    const data = await res.json();
    const rawText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ??
      'Gracias por contarme esto. No tengo toda la información, pero estoy aquí para escucharte y pensar contigo los próximos pasos. 💙';

    return {
      answer: rawText,
      tokensIn: null,
      tokensOut: null,
    };
  } catch (error) {
    console.log('[chatApi] callAriaBackend error:', error);
    return {
      answer:
        'Tu mensaje es importante, pero tengo un problema de conexión en este momento. Intenta de nuevo en unos minutos y, si te sientes muy mal, habla con alguien de confianza o un profesional de salud.',
      tokensIn: null,
      tokensOut: null,
    };
  }
}
