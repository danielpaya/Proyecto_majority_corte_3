// app/types/chat.ts
export type ChatCharacter = 'aria' | 'max' | 'luz';

export type ChatThread = {
  id: string;
  user_id: string;
  character: ChatCharacter;
  title: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  id: string;
  thread_id: string;
  user_id: string;
  role: ChatMessageRole;
  content: string;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
};
