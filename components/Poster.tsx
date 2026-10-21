import React, {useState} from 'react';
import {
  Image,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
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

/**
 * El tamaño de una carátula, el mismo en toda la app.
 *
 * Manda la rejilla: ahí el ancho no es libre, hay que repartir la pantalla
 * entre tres columnas, sus huecos y los márgenes. Las filas de Inicio son
 * carruseles y podrían usar cualquier medida, pero entonces la misma película
 * cambiaría de tamaño al pasar de Inicio a «Ver todo».
 */
export const GRID_COLUMNS = 3;
/** Margen lateral de las listas y hueco entre tarjetas. */
export const GRID_GUTTER = 16;
export const GRID_GAP = 10;

export function posterSize(windowWidth: number) {
  const width = Math.floor(
    (windowWidth - GRID_GUTTER * 2 - GRID_GAP * (GRID_COLUMNS - 1)) /
      GRID_COLUMNS,
  );
  // 2:3, como una carátula de cine.
  return {width, height: Math.round(width * 1.5)};
}

/**
 * Lo mismo para las tarjetas apaisadas («Seguir viendo», «En directo»,
 * noticias): dos columnas de la rejilla menos un hueco. Siguen atadas a la
 * misma medida que las carátulas, pero quedan algo más bajas, que es lo que
 * pide una fila de fotogramas al lado de una de carteles.
 */
export function wideSize(windowWidth: number) {
  const width = posterSize(windowWidth).width * 2 - GRID_GAP;
  // 16:9, la forma de un fotograma.
  return {width, height: Math.round((width * 9) / 16)};
}

/**
 * Anchos en los que TMDb sirve cada carátula. Pedir siempre el mayor es tirar
 * datos: en la rejilla la tarjeta mide ~113 dp, que en un móvil de densidad 3
 * son 339 px, y el `w500` que viene en la ficha pesa casi el doble para nada.
 */
const TMDB_WIDTHS = [92, 154, 185, 342, 500, 780];

/** La misma carátula, en el ancho más ajustado a la tarjeta. */
function sized(uri: string, width: number) {
  if (!uri.includes('image.tmdb.org/t/p/w')) {
    return uri;
  }
  const pixels = width * PixelRatio.get();
  const pick = TMDB_WIDTHS.find(option => option >= pixels);
  return pick ? uri.replace(/\/w\d+\//, `/w${pick}/`) : uri;
}

/**
 * Grises para la tarjeta sin carátula.
 *
 * Antes eran colores (rojo, azul, morado…) y una rejilla de títulos sin imagen
 * parecía un muestrario: los colores pedían atención para decir precisamente
 * que ahí no hay nada que ver. En gris la tarjeta se lee como lo que es, un
 * hueco, y las que sí tienen cartel destacan solas.
 *
 * Siguen siendo cuatro y no uno para que dos tarjetas pegadas no se fundan en
 * un bloque plano.
 */
const GREYS = ['#2a2a2e', '#303036', '#25252a', '#343439'];

/** Mismo título → mismo gris siempre (y sin guardar nada). */
function greyFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 100000;
  }
  return GREYS[hash % GREYS.length];
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
  /**
   * Estado de la carátula: `waiting` mientras viaja, `shown` cuando ha
   * llegado y `failed` si no llega.
   *
   * Hace falta distinguir el fallo: sin él, una imagen rota dejaba la tarjeta
   * gris para siempre, porque el hueco solo se quitaba al cargar.
   */
  const [art, setArt] = useState<'waiting' | 'shown' | 'failed'>('waiting');
  // Una imagen que no carga no es una tarjeta: se cae al degradado del título.
  const showImage = !!image && art !== 'failed';
  const grey = greyFor(title);

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
      {/* Nada de SVG en la tarjeta: en una rejilla de sesenta, montar un SVG
          por carátula (más otro por el icono) se nota al desplazar. El fondo
          es un color liso y el oscurecido de abajo, el mismo PNG estirado que
          ya se usa sobre las fotos (ver `SCRIM`). */}
      {showImage ? (
        <>
          {/* Hueco mientras la imagen viaja: gris liso (sin SVG, que son
              sesenta tarjetas) con el icono tenue. Sin esto, la rejilla se
              llena de rectángulos negros hasta que llegan las carátulas. */}
          {art === 'waiting' && (
            <View pointerEvents="none" style={styles.hole}>
              <Placeholder size={Math.round(Math.min(width, height) * 0.3)} />
            </View>
          )}
          <Image
            source={{uri: sized(image, width)}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            // En Android, que Fresco la reescale al decodificar: si no, cada
            // carátula entra en memoria a tamaño completo.
            resizeMethod="resize"
            // Sin el fundido de entrada: una tarjeta menos que animar.
            fadeDuration={0}
            onLoad={() => setArt('shown')}
            onError={() => setArt('failed')}
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
        <>
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, {backgroundColor: grey}]}
          />
          <Image
            pointerEvents="none"
            source={{uri: SCRIM}}
            style={StyleSheet.absoluteFill}
            resizeMode="stretch"
            fadeDuration={0}
          />
          {/* Sin carátula sigue haciendo falta decir que esto es un vídeo. */}
          <Placeholder size={Math.round(Math.min(width, height) * 0.3)} />
        </>
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

/**
 * El icono tenue del hueco: ni tapa el título ni compite con la carátula.
 *
 * Dibujado con vistas (un marco y un triángulo de bordes) en vez de con un
 * icono SVG: esto se monta una vez por tarjeta y en una rejilla larga el SVG
 * salía caro.
 */
function Placeholder({size}: {size: number}) {
  return (
    <View pointerEvents="none" style={styles.placeholder}>
      <View
        style={[styles.glyph, {width: size, height: Math.round(size * 0.72)}]}>
        <View
          style={[
            styles.glyphPlay,
            {
              borderLeftWidth: Math.round(size * 0.24),
              borderTopWidth: Math.round(size * 0.15),
              borderBottomWidth: Math.round(size * 0.15),
            },
          ]}
        />
      </View>
    </View>
  );
}

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
  hole: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#2b2b30',
  },
  glyph: {
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  glyphPlay: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderStyle: 'solid',
    borderLeftColor: 'rgba(255,255,255,0.18)',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  placeholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
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
