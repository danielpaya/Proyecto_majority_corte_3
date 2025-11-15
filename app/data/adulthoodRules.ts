// app/data/adulthoodRules.ts
import type { RawQuestion, Flags, ProfileLite, Answer } from './adulthoodApi';

type Cnd =
  | { type:'flag'; key:keyof Flags; eq?: boolean; in?: boolean[] }
  | { type:'profile'; key:'gender'; eq?: string; in?: string[] }
  | { type:'answer'; qid:string; eq?: Answer; in?: Answer[] };

export function canShow(
  q: RawQuestion,
  flags: Flags,
  profile: ProfileLite,
  answers: Record<string, Answer>
): boolean {
  const cs: Cnd[] = (q.show_if ?? []) as Cnd[];
  return cs.every(c => {
    if (c.type === 'flag') {
      const val = flags[c.key];
      if ('eq' in c && c.eq !== undefined) return val === c.eq;
      if ('in' in c && c.in) return c.in.includes(val as any);
      return true;
    }
    if (c.type === 'profile') {
      // por ahora solo gender
      const val = (profile as any)[c.key];
      if ('eq' in c && c.eq !== undefined) return val === c.eq;
      if ('in' in c && c.in) return c.in.includes(val);
      return true;
    }
    if (c.type === 'answer') {
      const val = answers[c.qid];
      if ('eq' in c && c.eq !== undefined) return val === c.eq;
      if ('in' in c && c.in) return c.in.includes(val);
      return false; // si no hay respuesta aún, no mostrar dependientes
    }
    return true;
  });
}
