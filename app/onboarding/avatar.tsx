import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Modal, Button } from 'react-native';
import { catalog_tmplx01 } from '../data/avatarCatalog';
import type { AvatarLayer } from '../data/avatarCatalog';
import { AvatarPreview } from '../../components/AvatarPreview';
import { VariantPicker } from '../../components/VariantPicker';
import { supabase } from '../../utils/supabase'; // tu cliente

export default function AvatarScreen() {
  const template = catalog_tmplx01; // por ahora tenemos 1
  const [editorOpen, setEditorOpen] = useState(false);

  const [selected, setSelected] = useState<Record<AvatarLayer, string>>({
    skin_base: template.defaults.skin_base,
    skin_overlay: template.defaults.skin_overlay,
    eyes: template.defaults.eyes,
    outline: template.defaults.outline,
  });

  const setLayer = (layer: AvatarLayer, id: string) =>
    setSelected(prev => ({ ...prev, [layer]: id }));

  const onSaveToDb = async () => {
    // Guarda en profiles (ver SQL abajo para columnas nuevas)
    const user = (await supabase.auth.getUser()).data.user;
    if (!user) return;
    const payload = {
      avatar_template_id: template.id,
      avatar_config: selected,
    };
    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', user.id);
    if (error) {
      console.error(error);
      alert('Error guardando avatar');
    } else {
      alert('Avatar guardado');
      setEditorOpen(false);
    }
  };

  const gridTemplates = useMemo(() => [template], []);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>Elige tu avatar</Text>

      {/* Grid de plantillas (por ahora 1) */}
      <View style={styles.grid}>
        {gridTemplates.map(t => (
          <View key={t.id} style={styles.card}>
            <AvatarPreview catalog={t} selected={selected} size={160} />
            <Button title="Personalizar colores" onPress={() => setEditorOpen(true)} />
          </View>
        ))}
      </View>

      {/* Modal editor: pickers por capa */}
      <Modal visible={editorOpen} animationType="slide">
        <ScrollView contentContainerStyle={styles.modal}>
          <Text style={styles.h1}>Personaliza colores</Text>
          <AvatarPreview catalog={template} selected={selected} size={220} />

          <VariantPicker
            title="Piel base"
            variants={template.layers.skin_base}
            selectedId={selected.skin_base}
            onSelect={(id) => setLayer('skin_base', id)}
          />
          <VariantPicker
            title="Piel overlay"
            variants={template.layers.skin_overlay}
            selectedId={selected.skin_overlay}
            onSelect={(id) => setLayer('skin_overlay', id)}
          />
          <VariantPicker
            title="Ojos"
            variants={template.layers.eyes}
            selectedId={selected.eyes}
            onSelect={(id) => setLayer('eyes', id)}
          />

          <View style={{ height: 12 }} />
          <Button title="Guardar" onPress={onSaveToDb} />
          <View style={{ height: 8 }} />
          <Button title="Cerrar" color="#777" onPress={() => setEditorOpen(false)} />
        </ScrollView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 16 },
  h1: { fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: 200, alignItems: 'center', gap: 8, padding: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12 },
  modal: { padding: 16, gap: 12 },
});
