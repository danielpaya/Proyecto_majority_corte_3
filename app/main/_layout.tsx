import { HapticTab } from '@/components/haptic-tab';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

export default function TabLayout() {
  const theme = useColorScheme();
  const isDark = theme === 'dark';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[theme].tint,
        tabBarInactiveTintColor: Colors[theme].tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
          borderTopColor: isDark ? '#2a2a3e' : '#e0e0e0',
          borderTopWidth: 1,
          ...Platform.select({
            ios: {
              position: 'absolute',
            },
            default: {
              elevation: 8,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
            },
          }),
        },
      }}>
      <Tabs.Screen
        name="misiones"
        options={{
          title: 'Misiones',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons 
              size={focused ? 28 : 24} 
              name={focused ? "assignment" : "assignment-outline"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="progreso"
        options={{
          title: 'Progreso',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons 
              size={focused ? 28 : 24} 
              name={focused ? "trending-up" : "trending-up"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              size={focused ? 28 : 24}
              name={focused ? 'map' : 'map'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="news"
        options={{
          title: 'Noticias',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons
              size={focused ? 28 : 24}
              name={focused ? 'article' : 'article'}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <MaterialIcons 
              size={focused ? 28 : 24} 
              name={focused ? "person" : "person-outline"} 
              color={color} 
            />
          ),
        }}
      />
      <Tabs.Screen
        name="configuracion"
        options={{
          href: null, // Ocultar esta tab, solo accesible desde el botón de perfil
        }}
      />
      <Tabs.Screen
        name="home"
        options={{
          href: null, // Ocultar esta tab ya que ahora usamos "misiones"
        }}
      />
    </Tabs>
  );
}

