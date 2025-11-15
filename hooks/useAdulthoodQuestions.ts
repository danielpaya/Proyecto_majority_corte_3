// app/hooks/useAdulthoodQuestions.ts
import { useEffect, useMemo, useState } from 'react';
import { fetchQuestions, RawQuestion, Flags, ProfileLite, Answer } from '@/app/data/adulthoodApi';
import { canShow } from '@/app/data/adulthoodRules';

export function useAdulthoodQuestions(flags: Flags, profile: ProfileLite) {
  const [raw, setRaw] = useState<RawQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});

  useEffect(() => { fetchQuestions().then(setRaw).catch(console.error); }, []);

  const visible = useMemo(
    () => raw.filter(q => canShow(q, flags, profile, answers)),
    [raw, flags, profile, answers]
  );

  const setAnswer = (slug: string, a: Answer) =>
    setAnswers(prev => ({ ...prev, [slug]: a }));

  return { questions: visible, answers, setAnswer, allRaw: raw };
}
