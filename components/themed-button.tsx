import React from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    type PressableProps,
} from 'react-native';

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ThemedButtonProps = PressableProps & {
  title: string;
  loading?: boolean;
  /** If true, apply a subtle highlight (stronger border/shadow) suitable for dark mode. Default: true */
  highlight?: boolean;
};

export function ThemedButton({
  title,
  loading = false,
  style,
  disabled,
  highlight = true,
  ...rest
}: ThemedButtonProps) {
  const theme = useColorScheme();
  const isDark = theme === 'dark';
  const isDisabled = disabled || loading;

  let backgroundColor = isDisabled
    ? isDark
      ? '#2a2a3e'
      : '#e0e0e0'
    : Colors[theme].tint;

  // Apply a subtle adjusted background for dark mode when highlight is enabled
  if (!isDisabled && highlight && isDark) {
    // Slightly off-white so the button has a subtle surface against the dark background
    backgroundColor = '#f6f7f8';
  }

  const textColor = isDisabled
    ? isDark
      ? '#aaaaaa'
      : '#666666'
    : isDark
      ? '#151718'
      : '#ffffff';

  return (
    <Pressable
      {...rest}
      disabled={isDisabled}
      style={({ pressed }) => {
        // Build the base style object without transform unless pressed
        const baseStyle: any = {
          backgroundColor,
          opacity: pressed ? 0.9 : 1,
        };
        if (pressed) {
          baseStyle.transform = [{ scale: 0.98 }];
        }

        // Build the style array and filter out falsy entries
        const built: any[] = [
          styles.base,
          baseStyle,
          isDark && !isDisabled && highlight && styles.darkHighlight,
          !isDark && !isDisabled && highlight && styles.lightHighlight,
        ].filter(Boolean);

        // Normalize incoming `style` prop into an array and sanitize null/undefined transforms
        const incoming = Array.isArray(style) ? style : style ? [style] : [];
        const sanitized = incoming.map((s: any) => {
          if (s && typeof s === 'object') {
            // clone to avoid mutating user objects
            const copy = { ...s };
            if (copy.transform == null) {
              delete copy.transform;
            }
            return copy;
          }
          return s;
        }).filter(Boolean);

        return [...built, ...sanitized];
      }}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text style={[styles.label, { color: textColor }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  darkHighlight: {
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  lightHighlight: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});
