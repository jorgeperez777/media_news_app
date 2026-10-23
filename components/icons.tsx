import React from 'react';
import {Platform, StyleSheet, View} from 'react-native';
import Text from './Text';
import Svg, {Defs, LinearGradient, Path, Stop} from 'react-native-svg';
import {ACCENT, ACCENT_END} from '../theme';

// Iconos de línea (react-native-svg), al estilo de Netflix: contorno de trazo
// uniforme con puntas redondas, en un único viewBox 24x24 para que todos pesen
// igual. Son los mismos dibujos que los controles del reproductor
// (`react-native-video/controls`), para que la app y el reproductor casen.

const WHITE = '#fff';

/** El fondo de la barra de pestañas: con él se calan las letras de «TV». */
const TAB_BACKGROUND = '#141416';

/**
 * Pasado como `color`, el icono se pinta con el **degradado** de la marca en vez
 * de con un color plano (ver `theme`). Es lo que lleva la pestaña elegida.
 */
export const GRADIENT = 'gradient';

type IconProps = {
  size?: number;
  color?: string;
  /**
   * Relleno en vez de línea. Las pestañas lo usan para la elegida, como las
   * apps de Google: línea en reposo, relleno al estar activa.
   */
  filled?: boolean;
};

/** Grosor de la línea, en unidades del viewBox de 24. */
const STROKE = 1.8;

/** Los rellenos llevan un trazo fino del mismo color que redondea esquinas. */
const ROUND = 1.6;

/** Envoltorio común: todos los paths están dibujados en una rejilla de 24x24. */
function Icon({
  size,
  color = WHITE,
  path,
  filled = false,
}: {
  size: number;
  color?: string;
  path: string;
  /** Relleno (play, pausa, el corazón…) en vez de línea. */
  filled?: boolean;
}) {
  // Un id por icono montado: dos degradados con el mismo id se pisan.
  const id = `i${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const gradient = color === GRADIENT;
  const paint = gradient ? `url(#${id})` : color;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {gradient ? (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ACCENT} />
            <Stop offset="1" stopColor={ACCENT_END} />
          </LinearGradient>
        </Defs>
      ) : null}
      <Path
        d={path}
        fill={filled ? paint : 'none'}
        stroke={paint}
        strokeWidth={filled ? ROUND : STROKE}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}

const PATHS = {
  play: 'M7.5 4.8v14.4L19 12z',
  pause: 'M7 5h2.8v14H7zM14.2 5H17v14h-2.8z',
  // Flecha circular abierta, con la punta arriba hacia atrás (como el ⟲10 de
  // Netflix). Su centro es (12, 13): ahí va el número en `SkipIcon`.
  replay: 'M12 5a8 8 0 1 1-6.93 4M14.5 2.5 12 5l2.5 2.5',
  stop: 'M6.5 6.5h11v11h-11z',
  close: 'M6 6l12 12M18 6 6 18',
  chevronDown: 'M6 9l6 6 6-6',
  fastForward: 'M3.5 6.5v11l7.5-5.5zM12.5 6.5v11l7.5-5.5z',
  skipNext: 'M5 5.5v13l10-6.5zM19 5.5v13',
  add: 'M12 5v14M5 12h14',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  share:
    'M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8.6 13.5l6.8 4M15.4 6.5l-6.8 4',
  skipPrevious: 'M19 5.5v13L9 12zM5 5.5v13',
  fullscreen: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  fullscreenExit: 'M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5',
  pictureInPicture:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM12.5 12h5v4h-5z',
  // La pantalla, la ventanita del miniplayer abajo a la derecha y una flecha
  // que va hacia ella: «mandar el vídeo a la miniatura». La flecha lo separa
  // del de PiP, que es solo el recuadro.
  miniPlayer:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM13.5 12.5H18V16h-4.5zM6.5 8l4.5 4.5M11 9v3.5H7.5',
  // El engranaje de Material, pero solo su contorno: el trazo sigue la silueta
  // exterior y el agujero del centro.
  settings:
    'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15A3 3 0 1 1 12 9a3 3 0 0 1 0 6z',
  cast: 'M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6M3 12a7 7 0 0 1 7 7M3 15.5A3.5 3.5 0 0 1 6.5 19M3 19h.01',
  castConnected:
    'M3 8V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-6M3 12a7 7 0 0 1 7 7M3 15.5A3.5 3.5 0 0 1 6.5 19M3 19h.01M7 8.5h10.5v7H14',
  // Recuadro con dos «C» de arco abiertas.
  closedCaption:
    'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM10.5 10.3a2.2 2.2 0 1 0 0 3.4M17 10.3a2.2 2.2 0 1 0 0 3.4',
  liveTv:
    'M4 7h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM8 2.5 12 7l4-4.5',
  videoLibrary:
    'M7 3h13a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H7zM3 7v13a1 1 0 0 0 1 1h13M12 7.5v5l4-2.5z',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c0-3.3 3.6-5 8-5s8 1.7 8 5',
  airplay:
    'M7 17H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-3M12 15l4.5 5h-9z',
  arrowBack: 'M20 12H4M10 6l-6 6 6 6',
  lock: 'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 8 0v4M12 15v2',
  lockOpen:
    'M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zM8 11V7a4 4 0 0 1 7.7-1.5M12 15v2',
  episodes: 'M4 6h16M4 12h10M4 18h7M16 14.5v6l4.5-3z',
  home: 'M4 10.5 12 4l8 6.5V20h-5v-6h-6v6H4z',
  news: 'M4 4h16v16H4zM7 8h5v4H7zM14.5 8H17M14.5 11H17M7 15.5h10',
  favorite:
    'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z',
  // Globo del idioma: el aro, el ecuador y el meridiano.
  language:
    'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.5 3.8 5.5 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.5-3.8-9S9.5 5.5 12 3z',
  // Barras de cobertura: el ahorro de datos va de cuánta red se gasta.
  signal: 'M5 20v-3M10 20v-7M15 20V9M20 20V4',
  delete:
    'M4 7h16M10 3.5h4M6.5 7l.8 12a1 1 0 0 0 1 1h7.4a1 1 0 0 0 1-1l.8-12M10 11v5M14 11v5',
};


export function PlayIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.play} filled />;
}

export function PauseIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.pause} filled />;
}

export function ReplayIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.replay} />;
}

export function StopIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.stop} filled />;
}

export function CloseIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.close} />;
}

export function ChevronIcon({
  direction = 'down',
  size = 24,
  color,
}: IconProps & {direction?: 'down' | 'up'}) {
  return (
    <View style={direction === 'up' ? styles.flipVertical : undefined}>
      <Icon size={size} color={color} path={PATHS.chevronDown} />
    </View>
  );
}

export function TrackIcon({
  direction,
  size = 28,
  color,
}: IconProps & {direction: 'previous' | 'next'}) {
  return (
    <Icon
      size={size}
      color={color}
      path={direction === 'next' ? PATHS.skipNext : PATHS.skipPrevious}
      filled
    />
  );
}

export function FullscreenIcon({
  size = 24,
  exit = false,
  color,
}: IconProps & {exit?: boolean}) {
  return (
    <Icon
      size={size}
      color={color}
      path={exit ? PATHS.fullscreenExit : PATHS.fullscreen}
    />
  );
}

export function FastForwardIcon({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.fastForward} filled />;
}

export function PipIcon({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.pictureInPicture} />;
}

export function SettingsIcon({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.settings} />;
}

export function CastIcon({
  size = 24,
  color,
  connected = false,
}: IconProps & {connected?: boolean}) {
  return (
    <Icon
      size={size}
      color={color}
      path={connected ? PATHS.castConnected : PATHS.cast}
    />
  );
}

export function ArrowBackIcon({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.arrowBack} />;
}

/** Candado del bloqueo de pantalla: cerrado para bloquear, abierto para soltar. */
export function LockIcon({
  open = false,
  size = 22,
  color,
}: IconProps & {open?: boolean}) {
  return (
    <Icon size={size} color={color} path={open ? PATHS.lockOpen : PATHS.lock} />
  );
}

export function EpisodesIcon({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.episodes} />;
}

export function AirPlayGlyph({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.airplay} />;
}

/** CC. `active` lo pinta en azul, como el resto de estados activos. */
export function SubtitlesIcon({
  size = 24,
  color,
  active,
  activeColor = '#3ea6ff',
}: IconProps & {active?: boolean; activeColor?: string}) {
  return (
    <Icon
      size={size}
      color={active ? activeColor : color}
      path={PATHS.closedCaption}
    />
  );
}

export function AddIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.add} />;
}

export function CheckIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.check} />;
}

/**
 * Compartir con el dibujo de cada sistema: en iOS el cuadrado con la flecha
 * hacia arriba, que es el de su hoja de compartir; en Android los tres nodos.
 */
const SHARE_IOS =
  'M12 3v12M8 7l4-4 4 4M8.5 10H6.5a1 1 0 0 0-1 1v8.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V11a1 1 0 0 0-1-1h-2';

export function ShareIcon({size = 22, color}: IconProps) {
  return (
    <Icon
      size={size}
      color={color}
      path={Platform.OS === 'ios' ? SHARE_IOS : PATHS.share}
    />
  );
}

export function HomeIcon({size = 22, color, filled}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.home} filled={filled} />;
}

export function NewsIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.news} />;
}

/** Relleno por defecto (un corazón marcado); la pestaña lo pide en línea. */
export function FavoriteIcon({size = 22, color, filled = true}: IconProps) {
  return (
    <Icon size={size} color={color} path={PATHS.favorite} filled={filled} />
  );
}

/**
 * La pestaña de TV en vivo: la pantalla con las letras «TV» y el ángulo
 * debajo, como el icono de las apps de televisión.
 *
 * No sale de Material Symbols, así que no puede usar `Icon`: se dibuja con
 * trazos, y el degradado de la marca (ver `GRADIENT`) tiene que pintar también
 * el `stroke`, no solo el relleno.
 */
export function LiveTvIcon({size = 22, color, filled}: IconProps) {
  const id = `tv${React.useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const gradient = color === GRADIENT;
  const paint = gradient ? `url(#${id})` : color ?? WHITE;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {gradient ? (
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={ACCENT} />
            <Stop offset="1" stopColor={ACCENT_END} />
          </LinearGradient>
        </Defs>
      ) : null}
      {/* La pantalla, abierta por abajo para que entre el ángulo. Rellena
          (activa), es una pantalla entera con las letras caladas. */}
      <Path
        d={
          filled
            ? 'M6 3h12a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z'
            : 'M8 15.5H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v6.5a3 3 0 0 1-3 3h-2'
        }
        fill={filled ? paint : 'none'}
        stroke={paint}
        strokeWidth={2}
        strokeLinecap="round"
      />
      {/* «TV» dentro: calada en el color de la barra si va rellena. */}
      <Path
        d="M6.8 6.4h4.6M9.1 6.4v5.4M12.9 6.4l2.2 5.4 2.2-5.4"
        fill="none"
        stroke={filled ? TAB_BACKGROUND : paint}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* El ángulo, apoyado en el hueco de abajo. */}
      <Path
        d="M7.5 19.8 12 14.9l4.5 4.9"
        fill="none"
        stroke={paint}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function VideoLibraryIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.videoLibrary} />;
}

export function SearchIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.search} />;
}

export function PersonIcon({size = 22, color, filled}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.person} filled={filled} />;
}

export function LanguageIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.language} />;
}

export function SignalIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.signal} />;
}

export function DeleteIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.delete} />;
}

/**
 * Salto de ±N segundos: la flecha circular de Material con el número dentro,
 * como en YouTube. El número va aparte para que se lea a cualquier tamaño.
 */
export function SkipIcon({
  direction,
  seconds,
  size = 40,
  color = WHITE,
}: IconProps & {direction: 'back' | 'forward'; seconds: number}) {
  return (
    <View style={[styles.skip, {width: size, height: size}]}>
      <View style={direction === 'forward' ? styles.flipHorizontal : undefined}>
        <Icon size={size} color={color} path={PATHS.replay} />
      </View>
      <Text
        style={[
          styles.skipSeconds,
          {color, fontSize: size * 0.26, lineHeight: size * 0.3},
        ]}>
        {seconds}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flipHorizontal: {transform: [{scaleX: -1}]},
  flipVertical: {transform: [{scaleY: -1}]},
  skip: {alignItems: 'center', justifyContent: 'center'},
  skipSeconds: {
    position: 'absolute',
    fontWeight: '700',
    // El arco de Material no está centrado en el viewBox: el número baja un poco
    // para quedar dentro de la circunferencia.
    marginTop: '8%',
  },
});
