export default {
  expo: {
    name: "Proyecto_majority_corte_3",
    slug: "Proyecto_majority_corte_3",
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_API_KEY: process.env.EXPO_PUBLIC_SUPABASE_API_KEY,
      // OpenRouteService API key (para rutas)
      EXPO_PUBLIC_ORS_API_KEY: process.env.EXPO_PUBLIC_ORS_API_KEY,
      // MapTiler key (tiles). Regístrala en maptiler.com y ponla aquí.
      EXPO_PUBLIC_MAPTILER_KEY: process.env.EXPO_PUBLIC_MAPTILER_KEY,
      // Opcional: estilo o mapa de MapTiler (por ejemplo: "streets" o "bright")
      EXPO_PUBLIC_MAPTILER_STYLE: process.env.EXPO_PUBLIC_MAPTILER_STYLE ?? 'streets',
    },
  },
};
