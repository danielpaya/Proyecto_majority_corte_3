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
