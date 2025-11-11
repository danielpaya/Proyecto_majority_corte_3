import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { AvatarVariant } from '../app/data/avatarCatalog';

type Props = {
  title: string;
  variants: AvatarVariant[];
  selectedId: string;
  onSelect: (id: string) => void;
};

export const VariantPicker: React.FC<Props> = ({ title, variants, selectedId, onSelect }) => (
  <View style={{ marginTop: 12 }}>
    <Text style={styles.title}>{title}</Text>
    <View style={styles.row}>
      {variants.map(v => (
        <TouchableOpacity
          key={v.id}
          style={[styles.chip, selectedId === v.id && styles.chipSelected]}
          onPress={() => onSelect(v.id)}
        >
          <Text style={styles.chipText}>{v.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  </View>
);

const styles = StyleSheet.create({
  title: { fontWeight: '600', marginBottom: 6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#ccc', marginRight: 8, marginBottom: 8 },
  chipSelected: { borderColor: '#333', backgroundColor: '#f2f2f2' },
  chipText: { fontSize: 12 },
});
