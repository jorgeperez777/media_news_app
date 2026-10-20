import React from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {PlayIcon} from './icons';
import {SCRIM} from './scrim';
import {PROGRESS_GRADIENT} from '../theme';

/**
 * Carátula de un título.
 *
 * Las películas del Internet Archive traen imagen de verdad (`image`); el resto
 * del catálogo son streams de prueba sin carátula, así que se dibuja un
 * degradado estable sacado del propio título. El degradado se queda debajo de
 * la imagen y hace de hueco mientras carga.
 */

/** Parejas de color para los degradados; se elige una según el título. */
const PALETTE: Array<[string, string]> = [
  ['#7b2d26', '#1b0f12'],
  ['#1f3a5f', '#0d1420'],
  ['#4a2b6b', '#140d1f'],
  ['#1d4d43', '#0b1a17'],
  ['#6b3f1d', '#1f1309'],
  ['#2c2c54', '#101021'],
];

/** Mismo título → mismo color siempre (y sin guardar nada). */
function colorsFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return PALETTE[hash % PALETTE.length];
}

function Poster({
  title,
  subtitle,
  badge,
  image,
  play = false,
  width,
  height,
  progress = 0,
  accent = PROGRESS_GRADIENT,
  style,
  onPress,
}: {
  title: string;
  subtitle?: string;
  /** Etiqueta de la esquina: EN VIVO, T1:E2… */
  badge?: string;
  /** Carátula de verdad; si no la hay, se queda el degradado. */
  image?: string;
  /** Círculo de play en el centro: para lo que se reproduce al tocarlo. */
  play?: boolean;
  width: number;
  height: number;
  /** Lo ya visto, de 0 a 1: pinta la barrita de abajo. */
  progress?: number;
  /** Relleno de la barrita: por defecto, el degradado de la marca. */
  accent?: string;
  style?: ViewStyle;
  onPress?: () => void;
}) {
  const [from, to] = colorsFor(title);
  const id = `g${Math.abs(title.length * 7 + title.charCodeAt(0))}`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      onPress={onPress}
      style={({pressed}) => [
        styles.card,
        {width, height},
        style,
        pressed && styles.pressed,
      ]}>
      {/* Con foto no se dibuja el degradado: son dos SVG por tarjeta y, con
          sesenta en una rejilla, se nota. Sin foto, el degradado ES la
          carátula. */}
      {image ? (
        <>
          <Image
            source={{uri: image}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            // En Android, que Fresco la reescale al decodificar: si no, cada
            // carátula entra en memoria a tamaño completo.
            resizeMethod="resize"
            // Sin el fundido de entrada: una tarjeta menos que animar.
            fadeDuration={0}
          />
          {/* Velo para leer el título: un degradado de verdad, pero como
              imagen diminuta estirada (ver `SCRIM`), no como SVG. */}
          <Image
            pointerEvents="none"
            source={{uri: SCRIM}}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            fadeDuration={0}
          />
        </>
      ) : (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${id})`} />
        </Svg>
      )}

      {play ? (
        <View pointerEvents="none" style={styles.play}>
          <PlayIcon size={20} color="#fff" />
        </View>
      ) : null}

      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {progress > 0 ? (
        <View style={styles.track}>
          {/* El relleno es el degradado de la marca, estirado (ver `theme`). */}
          <Image
            source={{uri: accent}}
            style={[styles.fill, {width: `${Math.min(100, progress * 100)}%`}]}
            resizeMode="stretch"
            fadeDuration={0}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Memorizada: en una rejilla hay decenas montadas y, sin esto, cualquier
 * repintado del padre (llega una página nueva, cambia una posición guardada)
 * las repinta todas.
 */
export default React.memo(Poster);

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: '#1a1a1c',
  },
  pressed: {opacity: 0.75},
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {color: '#fff', fontSize: 10, fontWeight: '700'},
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '50%',
    marginTop: -22,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {padding: 10, gap: 2},
  title: {color: '#fff', fontSize: 13, fontWeight: '700'},
  subtitle: {color: 'rgba(255,255,255,0.7)', fontSize: 11},
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fill: {height: '100%'},
});
