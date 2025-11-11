export type AvatarLayer = 'skin_base' | 'skin_overlay' | 'eyes' | 'outline';

export type AvatarVariant = {
  id: string;
  label: string;
  src: any; // require() estático
};

export type AvatarTemplateCatalog = {
  id: string;       // 'tmplx01'
  sizePx: number;   // 64
  layers: Record<AvatarLayer, AvatarVariant[]>;
  defaults: Record<AvatarLayer, string>;
};

export const catalog_tmplx01: AvatarTemplateCatalog = {
  id: 'tmplx01',
  sizePx: 64,
  layers: {
    skin_base: [
      { id: 'skin_base__verde',    label: 'Verde',    src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__verde.png') },
      { id: 'skin_base__amarillo', label: 'Amarillo', src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__amarillo.png') },
      { id: 'skin_base__azul',     label: 'Azul',     src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__azul.png') },
      { id: 'skin_base__naranja',  label: 'Naranja',  src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__naranja.png') },
      { id: 'skin_base__rojo',     label: 'Rojo',     src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__rojo.png') },
      { id: 'skin_base__rosa',     label: 'Rosa',     src: require('../../assets/avatars/templates/tmplx01/skin_base/skin_base__rosa.png') },
    ],
    skin_overlay: [
      { id: 'skin_overlay__verde',      label: 'Overlay verde',       src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__verde.png') },
      { id: 'skin_overlay__amarillo',   label: 'Overlay amarillo',    src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__amarillo.png') },
      { id: 'skin_overlay__azul',       label: 'Overlay azul',        src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__azul.png') },
      { id: 'skin_overlay__azuloscuro', label: 'Overlay azul oscuro', src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__azuloscuro.png') },
      { id: 'skin_overlay__fuccia',     label: 'Overlay fucsia',      src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__fuccia.png') },
      { id: 'skin_overlay__morado',     label: 'Overlay morado',      src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__morado.png') },
      { id: 'skin_overlay__rosa',       label: 'Overlay rosa',        src: require('../../assets/avatars/templates/tmplx01/skin_overlay/skin_overlay__rosa.png') },
      // Nota: NO hay skin_overlay_rojo.png, por eso no lo incluimos
    ],
    eyes: [
      { id: 'eyes__amarillo', label: 'Amarillo', src: require('../../assets/avatars/templates/tmplx01/eyes/eyes__amarillo.png') },
      { id: 'eyes__azul',     label: 'Azul',     src: require('../../assets/avatars/templates/tmplx01/eyes/eyes__azul.png') },
      { id: 'eyes__naranja',  label: 'Naranja',  src: require('../../assets/avatars/templates/tmplx01/eyes/eyes__naranja.png') },
      { id: 'eyes__rojo',     label: 'Rojo',     src: require('../../assets/avatars/templates/tmplx01/eyes/eyes__rojo.png') },
      { id: 'eyes__rosa',     label: 'Rosa',     src: require('../../assets/avatars/templates/tmplx01/eyes/eyes__rosa.png') },
    ],
    outline: [
      { id: 'outline__default', label: 'Contorno', src: require('../../assets/avatars/templates/tmplx01/outline__default/outline__default.png') },
    ],
  },
  defaults: {
    skin_base: 'skin_base__verde',
    skin_overlay: 'skin_overlay__verde',
    eyes: 'eyes__amarillo',
    outline: 'outline__default',
  },
};
