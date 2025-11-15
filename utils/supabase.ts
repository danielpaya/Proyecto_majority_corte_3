// utils/supabase.ts
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_API_KEY!;

if (!supabaseUrl) {
  console.error('❌ Falta EXPO_PUBLIC_SUPABASE_URL');
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  console.error('❌ Falta EXPO_PUBLIC_SUPABASE_API_KEY');
  throw new Error('Missing EXPO_PUBLIC_SUPABASE_API_KEY');
}

// ⚠️ Puedes dejar estos logs sólo en dev
console.log('[Supabase] URL:', supabaseUrl);
console.log('[Supabase] KEY length:', supabaseAnonKey.length);
console.log('[Supabase] KEY prefix:', supabaseAnonKey.slice(0, 20));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage as any,  // <- RN storage
    persistSession: true,          // <- mantiene sesión entre reinicios
    autoRefreshToken: true,        // <- refresca tokens en background
    detectSessionInUrl: false,     // <- IMPORTANTE en RN/Expo (no hay URL de callback)
  },
});
