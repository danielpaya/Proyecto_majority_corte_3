// utils/supabase.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

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

/**
 * Intenta generar una URL firmada para un path de storage de Supabase.
 * Si `path` ya es una URL absoluta, la devuelve tal cual.
 * Si el archivo no se encuentra en los buckets probados, devuelve null.
 */
export async function createSignedUrlForPath(path: string, expiresIn = 60) {
  if (!path) return null;
  // si ya es una URL pública, retornarla
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  // Normalizar: eliminar slash inicial si existe
  const normalized = path.startsWith('/') ? path.slice(1) : path;

  // Buckets comunes donde podría guardarse el avatar
  const bucketsToTry = ['avatars', 'avatar', 'public', 'user-avatars', 'user_avatars'];

  for (const bucket of bucketsToTry) {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(normalized, expiresIn);

      if (!error && data && (data.signedURL || (data.signedUrl && data.signedUrl))) {
        // supabase-js v2 usa .signedURL, versiones pueden variar
        const signed = (data as any).signedURL ?? (data as any).signedUrl ?? null;
        if (signed) return signed;
      }
    } catch (e) {
      // ignora y prueba el siguiente bucket
      // console.log('[createSignedUrlForPath] bucket', bucket, 'error', e);
    }
  }

  // No se pudo generar la URL firmada
  return null;
}
