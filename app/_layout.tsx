import { Stack } from 'expo-router';
import { CustomAlertProvider } from '../components/CustomAlert';
import { AuthProvider } from '../contexts/AuthContext';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <CustomAlertProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </CustomAlertProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
