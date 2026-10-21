import React, {useEffect, useRef} from 'react';
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  FavoriteIcon,
  GRADIENT,
  HomeIcon,
  LiveTvIcon,
  PersonIcon,
} from './icons';
import {t, useLanguage, type TextKey} from '../i18n';
import {useReduceMotion} from './motion';
import {ACCENT} from '../theme';

/** Alto de la zona de iconos y etiquetas (sin contar el inset de abajo). */
const BAR_HEIGHT = 64;

/**
 * Hueco que reservan las pantallas abajo: la barra va pegada al borde inferior y
 * el contenido pasa por detrás (que es lo que le da algo que difuminar al blur),
 * así que solo hay que dejarle sitio al final del scroll.
 */
export const TAB_BAR_HEIGHT = BAR_HEIGHT;

/**
 * Hueco que hay que dejar al final de un scroll para que la barra no tape la
 * última fila: la barra **más** el inset de abajo, que ella aplica por dentro.
 * Usarlo siempre en vez de `TAB_BAR_HEIGHT` a secas; con el inset fuera de la
 * cuenta, en un móvil con gestos se come el último elemento.
 */
export function useTabBarSpace() {
  const insets = useSafeAreaInsets();
  return BAR_HEIGHT + insets.bottom;
}

export type TabKey =
  | 'inicio'
  | 'envivo'
  | 'noticias'
  | 'buscar'
  | 'favoritos'
  | 'perfil';

/**
 * Lo que se ve en la barra. La etiqueta se traduce al pintar, no aquí: el idioma
 * se puede cambiar.
 *
 * Buscar y Noticias están escondidas a propósito: sus pantallas siguen ahí y
 * `TabKey` las admite, pero no se ofrecen. Buscar, hasta que tenga buscador de
 * verdad; Noticias, hasta que las noticias no sean de prueba. A Noticias se
 * llega igualmente desde una noticia guardada en Favoritos.
 */
const TABS: Array<{
  key: TabKey;
  label: TextKey;
  Icon: (props: {size?: number; color?: string}) => React.JSX.Element;
}> = [
  {key: 'inicio', label: 'tab.home', Icon: HomeIcon},
  {key: 'envivo', label: 'tab.live', Icon: LiveTvIcon},
  {key: 'favoritos', label: 'tab.favourites', Icon: FavoriteIcon},
  {key: 'perfil', label: 'tab.profile', Icon: PersonIcon},
];

/**
 * La pestaña elegida va con el **degradado** de la marca, igual que las barras y
 * los botones principales (ver `theme`): el icono lo lleva de verdad, dentro del
 * SVG. La etiqueta es texto, y a un texto no se le puede meter un degradado sin
 * una máscara, así que se queda con el color en el que el degradado empieza.
 */
const ACTIVE = ACCENT;
const INACTIVE = 'rgba(255,255,255,0.45)';

/** Cuánto crece el icono de la pestaña elegida. */
const SELECTED_SCALE = 1.22;

/**
 * Barra al estilo de iOS: de borde a borde, pegada abajo y con el contenido
 * pasando por detrás.
 *
 * Sobre el desenfoque va un tinte oscuro: el blur a secas deja la barra
 * demasiado clara sobre fondos brillantes y los iconos pierden contraste.
 */
export default function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const insets = useSafeAreaInsets();
  // Las etiquetas son de accesibilidad: hay que repintarlas al cambiar de idioma.
  useLanguage();

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      {/* El inset va dentro de la barra: el fondo llega hasta el borde de la
          pantalla y los iconos se quedan por encima del indicador del sistema. */}
      <View style={[styles.bar, {paddingBottom: insets.bottom}]}>
        {TABS.map(({key, label, Icon}) => (
          <Tab
            key={key}
            label={t(label)}
            Icon={Icon}
            selected={key === active}
            onPress={() => onChange(key)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Una pestaña. Va aparte para que cada una tenga su propio valor animado: el
 * saltito es de la que acabas de elegir, no de la barra.
 *
 * El icono crece un poco al quedarse elegido. Es un muelle, no una duración:
 * tocar dos pestañas seguidas rápido no encadena dos animaciones completas, el
 * muelle se redirige desde donde iba.
 */
function Tab({
  label,
  Icon,
  selected,
  onPress,
}: {
  label: string;
  Icon: (props: {size?: number; color?: string}) => React.JSX.Element;
  selected: boolean;
  onPress: () => void;
}) {
  const pop = useRef(new Animated.Value(selected ? 1 : 0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      pop.setValue(selected ? 1 : 0);
      return;
    }
    const anim = Animated.spring(pop, {
      toValue: selected ? 1 : 0,
      // Blando y sin prisa: con el muelle rápido el saltito pasaba de largo.
      friction: 5,
      tension: 90,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [selected, pop, reduceMotion]);

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{selected}}
      style={({pressed}) => [styles.tab, pressed && styles.pressed]}
      onPress={onPress}>
      <Animated.View
        style={{
          transform: [
            {
              scale: pop.interpolate({
                inputRange: [0, 1],
                outputRange: [1, SELECTED_SCALE],
              }),
            },
          ],
        }}>
        <Icon size={22} color={selected ? GRADIENT : INACTIVE} />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={[styles.label, selected && styles.labelOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  bar: {
    height: BAR_HEIGHT,
    backgroundColor: '#141416',
    flexDirection: 'row',
    alignItems: 'center',
    // El `height` es solo la zona de iconos: `paddingBottom` añade el inset.
    boxSizing: 'content-box',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3},
  label: {color: INACTIVE, fontSize: 10, fontWeight: '600'},
  labelOn: {color: ACTIVE},
  pressed: {opacity: 0.6},
});
