import { ThemedButton } from '@/components/themed-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import React, { createContext, useCallback, useContext, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

type AlertButton = { text: string; style?: 'default' | 'destructive' | 'cancel' };
type ShowOptions = { title?: string; message?: string; buttons?: AlertButton[] };

type AlertContextType = {
  show: (opts: ShowOptions) => Promise<number>;
};

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export const CustomAlertProvider = ({ children }: { children: React.ReactNode }) => {
  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [buttons, setButtons] = useState<AlertButton[]>([{ text: 'OK' }]);
  const [resolver, setResolver] = useState<((i: number) => void) | null>(null);

  const show = useCallback((opts: ShowOptions) => {
    return new Promise<number>((resolve) => {
      setTitle(opts.title);
      setMessage(opts.message);
      setButtons(opts.buttons && opts.buttons.length ? opts.buttons : [{ text: 'OK' }]);
      setResolver(() => resolve);
      setVisible(true);
    });
  }, []);

  const onPress = (index: number) => {
    try {
      resolver && resolver(index);
    } finally {
      setVisible(false);
      setResolver(null);
    }
  };

  return (
    <AlertContext.Provider value={{ show }}>
      {children}
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.backdrop}>
          <ThemedView style={styles.card}>
            {title ? <ThemedText type="title" style={styles.title}>{title}</ThemedText> : null}
            {message ? <ThemedText style={styles.message}>{message}</ThemedText> : null}
            <View style={styles.actions}>
              {buttons.map((b, i) => (
                <ThemedButton
                  key={i}
                  title={b.text}
                  onPress={() => onPress(i)}
                  style={b.style === 'destructive' ? styles.destructiveBtn : undefined}
                />
              ))}
            </View>
          </ThemedView>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
};

export function useCustomAlert() {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useCustomAlert must be used inside CustomAlertProvider');
  return ctx;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 520, borderRadius: 12, padding: 16 },
  title: { fontSize: 18, marginBottom: 8 },
  message: { fontSize: 14, marginBottom: 12, opacity: 0.9 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  destructiveBtn: { backgroundColor: '#f8d7da' },
});

export default CustomAlertProvider;
