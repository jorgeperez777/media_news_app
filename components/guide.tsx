import React, {useRef} from 'react';
import {Animated, Pressable, StyleSheet, TextInput, View} from 'react-native';
import Text from './Text';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {CloseIcon, SearchIcon} from './icons';
import {t} from '../i18n';
import {FONT} from '../theme';

/**
 * Lo que comparten las dos guías: la de canales (`LiveScreen`) y la de
 * noticias (`NewsHomeScreen`).
 *
 * Las dos son la misma pantalla por fuera —cabecera que se opaca al bajar,
 * buscador que se despliega, carrusel de tarjetas grandes y lista de filas con
 * miniatura— y se diferencian en lo que enseñan. Esto vive aquí para que
 * cambiar el aspecto de una no deje a la otra atrás.
 */

/** Colores de las «fotos»: no hay imágenes, se dibujan (ver `Poster`). */
const SHOTS: Array<[string, string]> = [
  ['#2f6fb0', '#0f2740'],
  ['#b05a2f', '#3a1c0f'],
  ['#2f8f6f', '#0f3027'],
  ['#6b4ea8', '#241a3a'],
];

export const LINK = '#4c9aff';
/** Cabecera que aparece al bajar, igual que en Inicio. */
export const HEADER_HEIGHT = 56;
/** Lo que ocupa el buscador cuando está abierto. */
export const SEARCH_HEIGHT = 56;
/** Alto de la tarjeta destacada y hueco entre tarjetas. */
export const CARD_HEIGHT = 200;
export const CARD_GAP = 12;

/**
 * El desplazamiento y las dos opacidades que salen de él: el fondo de la
 * cabecera entra y el cristal del icono se va.
 */
export function useGuideScroll() {
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const glassOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  return {scrollY, headerOpacity, glassOpacity};
}

/**
 * Cabecera flotante y, debajo, el buscador cuando está abierto.
 *
 * `query` a `null` es «el buscador está cerrado»; a `''`, abierto y vacío.
 */
export function GuideHeader({
  title,
  searchLabel,
  query,
  onQuery,
  headerOpacity,
  glassOpacity,
}: {
  title: string;
  searchLabel: string;
  query: string | null;
  onQuery: (query: string | null) => void;
  headerOpacity: Animated.AnimatedInterpolation<number>;
  glassOpacity: Animated.AnimatedInterpolation<number>;
}) {
  return (
    <>
      {/* El título siempre, y el fondo solo cuando se ha bajado. */}
      <View pointerEvents="box-none" style={guide.header}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
                        guide.headerBack,
                        {opacity: headerOpacity},
          ]}
        />

        <Text style={guide.appTitle}>{title}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={searchLabel}
          onPress={() => onQuery(query === null ? '' : null)}
          hitSlop={10}
          style={({pressed}) => [guide.circle, pressed && guide.pressed]}>
          {/* El fondo del icono se va con la cabecera puesta. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              guide.circleBack,
              {opacity: glassOpacity},
            ]}
          />
          {query === null ? (
            <SearchIcon size={20} color="#fff" />
          ) : (
            <CloseIcon size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* El buscador se queda pegado bajo la cabecera, sobre fondo opaco: la
          lista pasa por debajo y si no se leería a través de él. */}
      {query !== null && (
        <View style={guide.searchBar}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={onQuery}
            placeholder={searchLabel}
            placeholderTextColor="#8a8a8f"
            style={guide.input}
          />
        </View>
      )}
    </>
  );
}

/** Título de sección con su «Ver todo» a la derecha. */
export function Section({
  title,
  onSeeAll,
}: {
  title: string;
  onSeeAll?: () => void;
}) {
  return (
    <View style={guide.section}>
      <Text style={guide.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <Pressable
          accessibilityRole="link"
          onPress={onSeeAll}
          hitSlop={8}
          style={({pressed}) => pressed && guide.pressed}>
          <Text style={guide.seeAll}>{t('screen.seeAll')}</Text>
        </Pressable>
      )}
    </View>
  );
}

/** Oscurecido de abajo para que el texto se lea sobre la foto. */
export function Scrim({width, height}: {width: number; height: number}) {
  const id = `scrim-${width}`;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

/** La «foto» de la tarjeta, dibujada. */
export function Shot({
  seed,
  width,
  height,
}: {
  seed: number;
  width: number;
  height: number;
}) {
  const [from, to] = SHOTS[seed % SHOTS.length];
  const id = `shot-${seed}-${width}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

export const guide = StyleSheet.create({
  headerBack: {backgroundColor: '#0f0f0f'},
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  pressed: {opacity: 0.6},
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  appTitle: {color: '#fff', fontSize: 24, fontWeight: '800'},
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBack: {backgroundColor: '#1f1f22'},
  searchBar: {
    position: 'absolute',
    top: HEADER_HEIGHT,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#0f0f0f',
  },
  input: {
    fontFamily: FONT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 14,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {color: '#fff', fontSize: 20, fontWeight: '800'},
  seeAll: {color: LINK, fontSize: 13, fontWeight: '600'},
  cards: {paddingHorizontal: 16, gap: CARD_GAP},
  card: {
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chip: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: LINK,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  cardBottom: {padding: 14, gap: 8},
  sourceRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dotLive: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#e50914'},
  source: {color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600'},
  sourceDot: {color: 'rgba(255,255,255,0.6)', fontSize: 11},
  logo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
  },
  logoText: {color: '#fff', fontSize: 8, fontWeight: '800'},
  verified: {
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LINK,
  },
  headline: {color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 22},
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotOn: {width: 18, backgroundColor: LINK},
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: {width: 92, height: 92, borderRadius: 12, overflow: 'hidden'},
  rowText: {flex: 1, gap: 4},
  category: {color: '#8a8a8f', fontSize: 11, fontWeight: '600'},
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 20},
  empty: {color: '#8a8a8f', fontSize: 13, paddingHorizontal: 16},
});
