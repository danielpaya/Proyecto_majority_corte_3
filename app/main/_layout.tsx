import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const theme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        // ⛔ Oculta completamente la barra de navegación
        tabBarStyle: { display: 'none' },

        // ⛔ Evita que se muestren botones invisibles
        tabBarButton: () => null,
      }}
    >
      <Tabs.Screen name="misiones" options={{ title: 'Misiones' }} />
      <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
      <Tabs.Screen name="map" options={{ title: 'Mapa' }} />
      <Tabs.Screen name="news" options={{ title: 'Noticias' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />

      <Tabs.Screen
        name="configuracion"
        options={{
          href: null, // sigue oculto
        }}
      />

      <Tabs.Screen
        name="home"
        options={{
          href: null, // sigue oculto
        }}
      />
    </Tabs>
  );
}
