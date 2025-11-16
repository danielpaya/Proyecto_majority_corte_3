// contexts/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  PropsWithChildren,
} from 'react';
import { supabase } from '../utils/supabase';
import type { Session, User } from '@supabase/supabase-js';

/* =========================================================
   Tipos básicos
   ========================================================= */

export type AppRole = 'USER' | 'ADMIN';
export type AppGender = 'Masculino' | 'Femenino' | 'Otro';

export type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  last_name: string | null;
  gender: AppGender | null;
  birth_date: string | null; // YYYY-MM-DD
  role: AppRole;
  dark_mode: boolean;
  avatar_url: string | null;
  points: number;
  level: number;
  created_at?: string;
  onboarding_complete?: boolean;
  avatar_template_id?: string | null;
  avatar_config?: AvatarConfig | null;
};

export type RegisterPayload = {
  email: string;
  password: string;
  name?: string;
  last_name?: string;
  gender?: AppGender;
  birth_date?: string; // YYYY-MM-DD
  role?: AppRole; // si no viene, se usará 'USER'
};

type EligibilityFlags = { age_gte_18: boolean; country_CO: boolean };

type AuthContextType = {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  initializing: boolean;
  register: (payload: RegisterPayload) => Promise<{ error: any | null }>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (updates: Partial<Pick<Profile, 'name' | 'last_name' | 'gender' | 'birth_date'>>) => Promise<void>;
  updateDarkMode: (darkMode: boolean) => Promise<void>;

  // test de adultez
  getEligibilityFlags: () => EligibilityFlags;
  markOnboardingComplete: (done: boolean) => Promise<void>;

  // misiones
  getMissionsAvailable: () => Promise<Mission[]>;
  getMissionsUnlocked: () => Promise<Mission[]>;
  getUserMissions: () => Promise<UserMission[]>;
  takeMission: (missionId: string) => Promise<void>;
  updateMissionStatus: (missionId: string, status: UserMission['status']) => Promise<void>;
  completeMission: (missionId: string) => Promise<void>;
};

export type AvatarConfig = {
  skin_base?: string;
  skin_overlay?: string;
  eyes?: string;
  outline?: string;
};

export type Mission = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  category?: string | null;
  difficulty?: number | null;
  points: number;
  is_system: boolean;
  active: boolean;
  start_at?: string | null;
  end_at?: string | null;
};

export type UserMission = {
  id: string;
  user_id: string;
  mission_id: string;
  status: 'pendiente' | 'en_curso' | 'completada' | 'cancelada' | 'vencida';
  started_at?: string | null;
  completed_at?: string | null;
  points_awarded: number;
  feedback?: string | null;
};


declare module './AuthContext' {} // (no hace nada; sólo marca el bloque)

// Agrega estos campos a Profile:
declare global {}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/* =========================================================
   Helper: crear / actualizar perfil en public.profiles
   ========================================================= */

async function upsertProfileFromUser(
  u: User,
  extra?: Omit<RegisterPayload, 'email' | 'password'>
) {
  const md = (u.user_metadata ?? {}) as any;

  // 1) Leer perfil existente (si ya había uno) para no pisar datos con null
  const { data: existing, error: existingError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', u.id)
    .maybeSingle<Profile>();

  if (existingError) {
    console.log('[upsertProfileFromUser] error cargando perfil existente:', existingError);
  }

  /* --------- Normalizar gender --------- */
  const rawGender =
    extra?.gender ??
    md.gender ??
    existing?.gender ??
    null;

  const validGenders: AppGender[] = ['Masculino', 'Femenino', 'Otro'];
  const gender: AppGender | null =
    validGenders.includes(rawGender as AppGender)
      ? (rawGender as AppGender)
      : null;

  /* --------- Normalizar role --------- */
  const rawRole =
    extra?.role ??
    md.role ??
    existing?.role ??
    null;

  const validRoles: AppRole[] = ['USER', 'ADMIN'];
  const role: AppRole =
    validRoles.includes(rawRole as AppRole)
      ? (rawRole as AppRole)
      : 'USER';

  /* --------- Armar fila final --------- */
  const row: Profile = {
    id: u.id,
    email: u.email ?? existing?.email ?? '',
    name: extra?.name ?? md.name ?? existing?.name ?? null,
    last_name: extra?.last_name ?? md.last_name ?? existing?.last_name ?? null,
    gender,
    birth_date: extra?.birth_date ?? md.birth_date ?? existing?.birth_date ?? null,
    role,
    dark_mode: existing?.dark_mode ?? false,
    avatar_url: existing?.avatar_url ?? null,
    points: existing?.points ?? 0,
    level: existing?.level ?? 1,
    onboarding_complete: existing?.onboarding_complete ?? false,
    created_at: existing?.created_at,
  };

  const { error } = await supabase
    .from('profiles')
    .upsert(row, { onConflict: 'id' });

  if (error) {
    console.log('[upsertProfileFromUser] error en upsert:', error);
    throw error;
  }
}




/* =========================================================
   Provider principal
   ========================================================= */

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [initializing, setInitializing] = useState(true);

  /* ---------- leer perfil desde public.profiles ---------- */
  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.log('[Auth] fetchProfile error:', error);
      throw error;
    }

    return (data as Profile | null) ?? null;
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    const p = await fetchProfile(user.id);
    setProfile(p);
    return p;
  }, [user, fetchProfile]);

  /* ---------- cargar sesión inicial + suscripción ---------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!mounted) return;

      if (error) {
        console.log('[Auth] getSession error:', error);
        setInitializing(false);
        return;
      }

      setSession(data.session);
      setUser(data.session?.user ?? null);

      if (data.session?.user) {
        try {
          const p = await fetchProfile(data.session.user.id);
          setProfile(p);
        } catch (err) {
          console.log('[Auth] initial fetchProfile error:', err);
        }
      }

      setInitializing(false);
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess ?? null);
        setUser(sess?.user ?? null);

        if (sess?.user) {
          try {
            // al cambiar de sesión autenticada, nos aseguramos de que el perfil exista
            await upsertProfileFromUser(sess.user);
            const p = await fetchProfile(sess.user.id);
            setProfile(p);
          } catch (err) {
            console.log('[Auth] onAuthStateChange profile error:', err);
          }
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  /* ---------- register: SOLO auth.signUp, sin tocar profiles ---------- */
  const register = useCallback(
    async (payload: RegisterPayload): Promise<{ error: any | null }> => {
      const { email, password, name, last_name, gender, birth_date, role } =
        payload;

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            last_name,
            gender,
            birth_date,
            role: role ?? 'USER',
          },
        },
      });

      if (error) {
        console.log('[Auth] register error:', error);
        return { error };
      }

      console.log('[Auth] register ok, user id:', data.user?.id);
      // El perfil en public.profiles se creará en el primer login.
      return { error: null };
    },
    []
  );

  /* ---------- login: autenticar y crear/actualizar perfil ---------- */
  const login = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('[Auth] login error:', error);
        throw error;
      }

      setSession(data.session ?? null);
      setUser(data.user ?? null);

      if (data.user) {
        try {
          await upsertProfileFromUser(data.user);
          const p = await fetchProfile(data.user.id);
          setProfile(p);
        } catch (err) {
          console.log('[Auth] login profile error:', err);
        }
      }
    },
    [fetchProfile]
  );

  /* ---------- logout ---------- */
  const logout = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log('[Auth] logout error:', error);
      throw error;
    }
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  /* ----------Banderas para el test y marcar onboarding---------- */
  function computeAgeGte18(birth_date?: string | null) {
    if (!birth_date) return false;
    const bd = new Date(birth_date);
    const now = new Date();
    const age =
      now.getFullYear() - bd.getFullYear() -
      (now < new Date(now.getFullYear(), bd.getMonth(), bd.getDate()) ? 1 : 0);
    return age >= 18;
  }

  const getEligibilityFlags = useCallback((): EligibilityFlags => {
    return {
      age_gte_18: computeAgeGte18(profile?.birth_date ?? null),
      // cuando guardes 'country' en profiles, cámbialo a (profile?.country === 'CO')
      country_CO: true,
    };
  }, [profile?.birth_date]);

  async function markOnboardingComplete(done: boolean) {
    if (!profile?.id) return;
    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_complete: done })
      .eq('id', profile.id);
    if (!error) {
      setProfile((prev) => (prev ? { ...prev, onboarding_complete: done } : prev));
    } else {
      console.log('[Auth] markOnboardingComplete error:', error);
    }
  }
  /* Operaciones de misiones */
  const getMissionsAvailable = useCallback(async (): Promise<Mission[]> => {
    const { data, error } = await supabase
      .from('v_missions_available')
      .select('*')
      .order('category', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data as Mission[]) ?? [];
  }, []);

  const getMissionsUnlocked = useCallback(async (): Promise<Mission[]> => {
    const { data, error } = await supabase
      .from('v_missions_unlocked')
      .select('*')
      .order('category', { ascending: true })
      .order('title', { ascending: true });
    if (error) throw error;
    return (data as Mission[]) ?? [];
  }, []);

  const getUserMissions = useCallback(async (): Promise<UserMission[]> => {
    if (!user) return [];
    const { data, error } = await supabase
      .from('user_misiones')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as UserMission[]) ?? [];
  }, [user]);

  const takeMission = useCallback(async (missionId: string) => {
    if (!user) throw new Error('No user');
    const { error } = await supabase
      .from('user_misiones')
      .insert({
        user_id: user.id,
        mission_id: missionId,
        status: 'pendiente',
        points_awarded: 0,
      });
    if (error) throw error;
  }, [user]);

  const updateMissionStatus = useCallback(async (missionId: string, status: UserMission['status']) => {
    if (!user) throw new Error('No user');
    const patch: any = { status };
    if (status === 'en_curso') patch.started_at = new Date().toISOString();
    const { error } = await supabase
      .from('user_misiones')
      .update(patch)
      .eq('user_id', user.id)
      .eq('mission_id', missionId);
    if (error) throw error;
  }, [user]);

  const completeMission = useCallback(async (missionId: string) => {
    if (!user) throw new Error('No user');

    // 1) Tomar puntos de catálogo
    const { data: missionRow, error: mErr } = await supabase
      .from('missions')
      .select('points')
      .eq('id', missionId)
      .maybeSingle();
    if (mErr) throw mErr;
    const pts = (missionRow?.points as number) ?? 0;

    // 2) Marcar completada y registrar puntos en user_misiones
    const { error: updErr } = await supabase
      .from('user_misiones')
      .update({
        status: 'completada',
        completed_at: new Date().toISOString(),
        points_awarded: pts,
      })
      .eq('user_id', user.id)
      .eq('mission_id', missionId);
    if (updErr) throw updErr;

    // 3) Opcional: sumar puntos al perfil (si tu economía sube puntos globales)
    const { error: profErr } = await supabase
      .from('profiles')
      .update({ points: (profile?.points ?? 0) + pts })
      .eq('id', user.id);
    if (profErr) {
      console.log('[Auth] completeMission profile points warn:', profErr);
    } else {
      // refresca en memoria
      setProfile((p) => (p ? { ...p, points: (p.points ?? 0) + pts } : p));
    }
  }, [user, profile?.points]);

  /* ---------- updateProfile: actualizar campos básicos del perfil ---------- */
  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'name' | 'last_name' | 'gender' | 'birth_date'>>) => {
      if (!user || !profile) {
        throw new Error('No hay usuario o perfil disponible');
      }

      // Validar género si se proporciona
      if (updates.gender !== undefined) {
        const validGenders: AppGender[] = ['Masculino', 'Femenino', 'Otro'];
        if (updates.gender !== null && !validGenders.includes(updates.gender)) {
          throw new Error('Género inválido');
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) {
        console.log('[Auth] updateProfile error:', error);
        throw error;
      }

      // Actualizar el perfil en memoria
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    },
    [user, profile, fetchProfile]
  );

  /* ---------- updateDarkMode: actualizar modo oscuro ---------- */
  const updateDarkMode = useCallback(
    async (darkMode: boolean) => {
      if (!user) {
        throw new Error('No hay usuario disponible');
      }

      const { error } = await supabase
        .from('profiles')
        .update({ dark_mode: darkMode })
        .eq('id', user.id);

      if (error) {
        console.log('[Auth] updateDarkMode error:', error);
        throw error;
      }

      // Actualizar el perfil en memoria
      const updatedProfile = await fetchProfile(user.id);
      if (updatedProfile) {
        setProfile(updatedProfile);
      }
    },
    [user, fetchProfile]
  );

  /* ---------- valor del contexto ---------- */
  const value = useMemo(
    () => ({
      user,
      profile,
      session,
      initializing,
      register,
      login,
      logout,
      refreshProfile,
      updateProfile,
      updateDarkMode,

      getEligibilityFlags,
      markOnboardingComplete,

      getMissionsAvailable,
      getMissionsUnlocked,
      getUserMissions,
      takeMission,
      updateMissionStatus,
      completeMission,
    }),
    [user, profile, session, initializing,
    register, login, logout, refreshProfile, updateProfile, updateDarkMode,
    getEligibilityFlags, markOnboardingComplete,
    getMissionsAvailable, getMissionsUnlocked, getUserMissions,
    takeMission, updateMissionStatus, completeMission,
    ]
  );





  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}




/* =========================================================
   Hook público
   ========================================================= */

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth debe usarse dentro de un <AuthProvider>');
  }
  return ctx;
}
