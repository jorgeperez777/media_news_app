import React, {useMemo} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SOURCES from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {TAB_BAR_HEIGHT} from './TabBar';
import VideoPlayer from './VideoPlayer';
import {CloseIcon, PauseIcon, PlayIcon} from './icons';

/** Alto de la barra del miniplayer y ancho del vídeo dentro de ella (16:9). */
export const MINI_HEIGHT = 72;
const MINI_VIDEO_WIDTH = MINI_HEIGHT * (16 / 9);

/**
 * Contenedor del reproductor, montado en la raíz de la app.
 *
 * Es el único sitio donde se renderiza `<VideoPlayer>`: al cambiar de pantalla o de
 * pestaña solo cambia la geometría de esta caja, nunca el árbol donde vive el vídeo
 * (en React Native no se puede reparentar una vista nativa; si se desmontara,
 * ExoPlayer/AVPlayer se liberan y la reproducción se reinicia).
 *
 * El paso a miniplayer es **inmediato**: se pulsa el botón y la caja se dibuja ya en
 * la barra de abajo, sin animación de colapso ni gesto de arrastre.
 */
export default function PlayerHost() {
  const player = usePlayer();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {index, mode, fullscreen, pip} = player;

  // Caja expandida: el hueco que publica la pantalla de detalle.
  const full = useMemo(
    () =>
      player.anchor ?? {
        x: 0,
        y: insets.top,
        width: windowWidth,
        height: (windowWidth * 9) / 16,
      },
    [player.anchor, windowWidth, insets.top],
  );

  // Caja del miniplayer: pegada justo encima de la barra de pestañas.
  const mini = useMemo(
    () => ({
      x: 0,
      y: windowHeight - insets.bottom - TAB_BAR_HEIGHT - MINI_HEIGHT,
      width: windowWidth,
      height: MINI_HEIGHT,
    }),
    [windowWidth, windowHeight, insets.bottom],
  );

  if (index === null) {
    return null;
  }

  const current = SOURCES[index];
  const isMini = mode === 'mini';
  const box = isMini ? mini : full;

  // En pantalla completa (o PiP) el reproductor se dibuja él mismo a pantalla
  // completa: la caja tiene que dejar de acotarlo.
  const containerStyle =
    fullscreen || pip
      ? StyleSheet.absoluteFillObject
      : {left: box.x, top: box.y, width: box.width, height: box.height};

  const videoStyle =
    fullscreen || pip
      ? {width: '100%' as const, height: '100%' as const}
      : {
          width: isMini ? MINI_VIDEO_WIDTH : box.width,
          height: isMini ? MINI_HEIGHT : box.height,
        };

  return (
    <View style={[styles.host, containerStyle, isMini && styles.hostMini]}>
      <View style={videoStyle}>
        <VideoPlayer
          key={index}
          source={current.source}
          title={current.title}
          style={styles.video}
          compact={isMini}
          paused={player.paused}
          onPausedChange={player.setPaused}
          dataSaver={player.dataSaver}
          onDataSaverChange={player.setDataSaver}
          onError={player.setError}
          onFullscreenChange={player.setFullscreen}
          onPipChange={player.setPip}
          onMinimize={player.minimize}
          hasPrevious={player.hasPrevious}
          hasNext={player.hasNext}
          onPrevious={() =>
            player.previousIndex !== null && player.goTo(player.previousIndex)
          }
          onNext={() => player.nextIndex !== null && player.goTo(player.nextIndex)}
        />
      </View>

      {/* Controles del miniplayer (solo existen en modo mini). */}
      {isMini && (
        <View style={styles.miniControls}>
          <Pressable style={styles.miniTitle} onPress={player.expand}>
            <Text style={styles.miniTitleText} numberOfLines={2}>
              {current.title}
            </Text>
          </Pressable>
          <Pressable
            hitSlop={10}
            style={styles.miniButton}
            onPress={() => player.setPaused(!player.paused)}>
            {player.paused ? <PlayIcon size={20} /> : <PauseIcon size={20} />}
          </Pressable>
          <Pressable hitSlop={10} style={styles.miniButton} onPress={player.close}>
            <CloseIcon size={20} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    backgroundColor: '#000',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  hostMini: {
    backgroundColor: '#1f1f1f',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: -2},
  },
  video: {width: '100%', height: '100%'},
  miniControls: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
  },
  miniTitle: {flex: 1},
  miniTitleText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  miniButton: {padding: 8},
});
