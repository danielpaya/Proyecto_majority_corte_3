import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
} from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useRouter } from "expo-router";

export const FabChat = () => {
  const [open, setOpen] = useState(false);
  const theme = useColorScheme();
  const isDark = theme === "dark";
  const router = useRouter();

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      {/* Fondo suave pero más oscuro para que se lea mejor */}
      {open && (
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>
      )}

      {/* Botones circulares estilo Pokémon GO */}
      {open && (
        <>
          <CircleButton
            icon="assignment"
            label="Misiones"
            x={-120}
            y={-50}
            onPress={() => go("/main/misiones")}
            isDark={isDark}
          />

          <CircleButton
            icon="trending-up"
            label="Progreso"
            x={-60}
            y={-140}
            onPress={() => go("/main/progreso")}
            isDark={isDark}
          />

          <CircleButton
            icon="map"
            label="Mapa"
            x={60}
            y={-140}
            onPress={() => go("/main/map")}
            isDark={isDark}
          />

          <CircleButton
            icon="article"
            label="Noticias"
            x={120}
            y={-50}
            onPress={() => go("/main/news")}
            isDark={isDark}
          />

          <CircleButton
            icon="forum"
            label="Chats IA"
            x={-80}
            y={40}
            onPress={() => go("/chat/inbox")}
            isDark={isDark}
          />

          <CircleButton
            icon="person"
            label="Perfil"
            x={80}
            y={40}
            onPress={() => go("/main/perfil")}
            isDark={isDark}
          />
        </>
      )}

      {/* FAB central */}
      <View style={styles.fabWrapper}>
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: isDark ? '#0a7ea4' : Colors.light.tint,
            },
          ]}
          onPress={() => setOpen((p) => !p)}
        >
          <MaterialIcons
            name={open ? "close" : "menu"}
            size={28}
            color="#fff"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

/* Botón circular individual */

const CircleButton = ({
  icon,
  label,
  x,
  y,
  onPress,
  isDark,
}: {
  icon: string;
  label: string;
  x: number;
  y: number;
  onPress: () => void;
  isDark: boolean;
}) => (
  <View
    style={[
      styles.circleWrapper,
      { transform: [{ translateX: x }, { translateY: y }] },
    ]}
  >
    <TouchableOpacity 
      style={[
        styles.circleBtn, 
        { backgroundColor: isDark ? '#2a2a3e' : 'white' }
      ]} 
      onPress={onPress}
    >
      <MaterialIcons 
        name={icon as any} 
        size={28} 
        color={isDark ? '#4a9eff' : '#1257a0'} 
      />
    </TouchableOpacity>
    <Text 
      style={[
        styles.circleLabel,
        { 
          backgroundColor: isDark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.55)',
          color: isDark ? '#000' : '#fff'
        }
      ]}
    >
      {label}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // 🔹 más oscuro para que el fondo no moleste
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  fabWrapper: {
    position: "absolute",
    bottom: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  fab: {
    width: 70,
    height: 70,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  circleWrapper: {
    position: "absolute",
    bottom: 90,
    left: "50%",
    alignItems: "center",
    marginLeft: -35,
  },
  circleBtn: {
    width: 65,
    height: 65,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  circleLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    // 🔹 "pill" para que el texto no se mezcle con lo de atrás
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
});
