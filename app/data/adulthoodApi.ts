// app/data/adulthoodApi.ts
import { supabase } from '@/utils/supabase';

export type Answer = 'yes'|'in_progress'|'no'|'na';

export type RawQuestion = {
  id: string;
  slug: string;
  block: string;
  text: string;
  weight: number;
  show_if: any[];     // condiciones JSON
  active: boolean;
};

export type Flags = {
  age_gte_18: boolean;
  country_CO: boolean;
};

export type ProfileLite = {
  gender?: 'Masculino'|'Femenino'|'Otro'|null;
  birth_date?: string|null;  // 'YYYY-MM-DD'
  // country?: string | null; // si luego lo añades al perfil
};

export type AdulthoodAnswerInput = {
  question_id: string;
  question_slug: string;
  answer: Answer;
};

type AdulthoodAnswerRow = {
  question_slug: string;
  answer: Answer;
};

export async function fetchQuestions(): Promise<RawQuestion[]> {
  const { data, error } = await supabase
    .from('adulthood_questions')
    .select('id, slug, block, text, weight, show_if, active')
    .eq('active', true)
    .order('block', { ascending: true })
    .order('slug', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export function normalizeAdulthoodSlug(value?: string | null): string | null {
  if (!value) return null;
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export async function saveAdulthoodAnswers(
  userId: string,
  entries: AdulthoodAnswerInput[]
) {
  if (!userId || entries.length === 0) return;

  const rows = entries.map((entry) => ({
    user_id: userId,
    question_id: entry.question_id,
    question_slug: normalizeAdulthoodSlug(entry.question_slug) ?? entry.question_slug,
    answer: entry.answer,
  }));

  const { error } = await supabase
    .from('adulthood_answers')
    .upsert(rows, { onConflict: 'user_id,question_id' });

  if (error) throw error;
}

export async function fetchUserAdulthoodAnswers(
  userId: string
): Promise<Record<string, Answer>> {
  if (!userId) return {};

  const { data, error } = await supabase
    .from('adulthood_answers')
    .select('question_slug, answer')
    .eq('user_id', userId)
    .returns<AdulthoodAnswerRow[]>();

  if (error) throw error;

  const map: Record<string, Answer> = {};
  for (const row of data ?? []) {
    const norm = normalizeAdulthoodSlug(row.question_slug);
    if (norm) {
      map[norm] = row.answer;
    }
  }
  return map;
}
