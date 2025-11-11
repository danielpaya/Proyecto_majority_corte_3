export default {
  expo: {
    name: "majority-quest",
    slug: "majority-quest",
    extra: {
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_API_KEY: process.env.EXPO_PUBLIC_SUPABASE_API_KEY,
    },
  },
};
