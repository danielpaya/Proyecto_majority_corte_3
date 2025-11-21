// app/index.tsx
import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';

export default function Index() {
  const { session, profile, initializing } = useAuth();

  // 1) Mientras cargamos la sesión desde Supabase / AsyncStorage
  if (initializing) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  // 2) Sin sesión → flujo de login
  if (!session) {
    return <Redirect href='/(auth)/login' />;
  }

  // 3) Con sesión pero sin onboarding completo → avatar / test
  if (!profile?.onboarding_complete) {
    return <Redirect href='/onboarding/avatar' />;
  }

  // 4) Usuario logueado + onboarding completo → home (misiones)
  return <Redirect href='/main/misiones' />;
}
