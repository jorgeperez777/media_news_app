import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Svg, {Path} from 'react-native-svg';

// Iconos vectoriales (react-native-svg) con la geometría de Material Symbols:
// un único viewBox 24x24 para todos, así comparten grosor y peso óptico.

const WHITE = '#fff';

type IconProps = {size?: number; color?: string};

/** Envoltorio común: todos los paths están dibujados en una rejilla de 24x24. */
function Icon({
  size,
  color = WHITE,
  path,
}: {size: number; color?: string; path: string}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d={path} fill={color} />
    </Svg>
  );
}

const PATHS = {
  play: 'M8 5v14l11-7z',
  pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
  replay:
    'M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z',
  stop: 'M6 6h12v12H6z',
  close:
    'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  chevronDown: 'M16.59 8.59 12 13.17 7.41 8.59 6 10l6 6 6-6z',
  skipNext: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z',
  skipPrevious: 'M6 6h2v12H6zm3.5 6 8.5 6V6z',
  fullscreen:
    'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
  fullscreenExit:
    'M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z',
  pictureInPicture:
    'M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z',
  settings:
    'M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.48.48 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1 1 12 8.4a3.6 3.6 0 0 1 0 7.2z',
  cast: 'M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  castConnected:
    'M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm18-7H5v1.63c3.96 1.28 7.09 4.41 8.37 8.37H19V7zM1 10v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
  closedCaption:
    'M19 4H5c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
  liveTv:
    'M21 6h-7.59l3.29-3.29L16 2l-4 4-4-4-.71.71L10.59 6H3c-1.1 0-2 .89-2 2v12c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V8c0-1.11-.9-2-2-2zm0 14H3V8h18v12zM9 10v8l7-4-7-4z',
  videoLibrary:
    'M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z',
  search:
    'M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  person:
    'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  airplay:
    'M6 22h12l-6-6-6 6zM21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4v-2H3V5h18v12h-4v2h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z',
};

export function PlayIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.play} />;
}

export function PauseIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.pause} />;
}

export function ReplayIcon({size = 36, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.replay} />;
}

export function StopIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.stop} />;
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

export function AirPlayGlyph({size = 24, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.airplay} />;
}

/** CC. `active` lo pinta en azul, como el resto de estados activos. */
export function SubtitlesIcon({
  size = 24,
  color,
  active,
}: IconProps & {active?: boolean}) {
  return (
    <Icon size={size} color={active ? '#3ea6ff' : color} path={PATHS.closedCaption} />
  );
}

export function LiveTvIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.liveTv} />;
}

export function VideoLibraryIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.videoLibrary} />;
}

export function SearchIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.search} />;
}

export function PersonIcon({size = 22, color}: IconProps) {
  return <Icon size={size} color={color} path={PATHS.person} />;
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
    marginTop: '5%',
  },
});
