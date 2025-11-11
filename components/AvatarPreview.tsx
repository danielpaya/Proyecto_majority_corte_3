import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import type { AvatarLayer, AvatarTemplateCatalog } from '../app/data/avatarCatalog';

type Props = {
  catalog: AvatarTemplateCatalog;
  selected: Record<AvatarLayer, string>;
  size?: number; // px finales en pantalla
};

const ORDER: AvatarLayer[] = ['skin_base', 'skin_overlay', 'eyes', 'outline'];

export const AvatarPreview: React.FC<Props> = ({ catalog, selected, size = 200 }) => {
  const getSrc = (layer: AvatarLayer) =>
    catalog.layers[layer].find(v => v.id === selected[layer])?.src;

  return (
    <View style={[styles.root, { width: size, height: size }]}>
      {ORDER.map(layer => {
        const src = getSrc(layer);
        if (!src) return null;
        return (
          <Image
            key={layer}
            source={src}
            style={[styles.layer, { width: size, height: size }]}
            resizeMode="contain"
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'relative' },
  layer: { position: 'absolute', top: 0, left: 0 },
});
