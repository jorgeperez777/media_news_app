import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SOURCES from '../sources';
import {usePlayer} from '../player/PlayerContext';
import VideoPlayer from './VideoPlayer';
import {CloseIcon, PauseIcon, PlayIcon} from './icons';

/** Alto de la barra del miniplayer y ancho del vídeo dentro de ella (16:9). */
export const MINI_HEIGHT = 72;
const MINI_VIDEO_WIDTH = MINI_HEIGHT * (16 / 9);
/** Arrastre (en px) a partir del cual se decide minimizar / expandir al soltar. */
const DRAG_DECISION = 0.35;

/**
 * Contenedor del reproductor, montado en la raíz de la app.
 *
 * Es el único sitio donde se renderiza `<VideoPlayer>`: al navegar solo cambia la
 * geometría de esta caja (animada entre la posición del detalle y la barra de
 * abajo), nunca el árbol donde vive el vídeo, que es lo que permite que la
 * reproducción continúe.
 */
export default function PlayerHost() {
  const player = usePlayer();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // 0 = expandido (pantalla de detalle) · 1 = miniplayer.
  const progress = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  useEffect(() => {
    const id = progress.addListener(({value}) => {
      progressValue.current = value;
    });
    return () => progress.removeListener(id);
  }, [progress]);

  const {index, mode, fullscreen, pip} = player;

  const full = useMemo(() => {
    const fallbackWidth = windowWidth;
    return (
      player.anchor ?? {
        x: 0,
        y: insets.top,
        width: fallbackWidth,
        height: (fallbackWidth * 9) / 16,
      }
    );
  }, [player.anchor, windowWidth, insets.top]);

  const mini = useMemo(
    () => ({
      x: 0,
      y: windowHeight - insets.bottom - MINI_HEIGHT,
      width: windowWidth,
      height: MINI_HEIGHT,
    }),
    [windowWidth, windowHeight, insets.bottom],
  );

  const travel = Math.max(1, mini.y - full.y);

  useEffect(() => {
    Animated.timing(progress, {
      toValue: mode === 'mini' ? 1 : 0,
      duration: 220,
      // left/top/width/height no se pueden animar en el hilo nativo.
      useNativeDriver: false,
    }).start();
  }, [mode, progress]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // Solo tomamos el gesto si es claramente vertical: así los taps siguen
        // llegando a los controles del reproductor.
        onMoveShouldSetPanResponder: (_, gesture) =>
          !fullscreen &&
          !pip &&
          Math.abs(gesture.dy) > 8 &&
          Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => {
          const base = mode === 'mini' ? 1 : 0;
          const next = base + gesture.dy / travel;
          progress.setValue(Math.max(0, Math.min(1, next)));
        },
        onPanResponderRelease: (_, gesture) => {
          if (mode === 'mini') {
            // Tirar hacia abajo desde el mini lo cierra; hacia arriba lo expande.
            if (gesture.dy > 60) {
              player.close();
              return;
            }
            if (progressValue.current < 1 - DRAG_DECISION) {
              player.expand();
            } else {
              Animated.spring(progress, {toValue: 1, useNativeDriver: false}).start();
            }
            return;
          }
          if (progressValue.current > DRAG_DECISION) {
            player.minimize();
          } else {
            Animated.spring(progress, {toValue: 0, useNativeDriver: false}).start();
          }
        },
      }),
    [fullscreen, pip, mode, travel, progress, player],
  );

  if (index === null) {
    return null;
  }

  const current = SOURCES[index];
  const isMini = mode === 'mini';

  const animate = (from: number, to: number) =>
    progress.interpolate({inputRange: [0, 1], outputRange: [from, to]});

  // En pantalla completa (o PiP) el reproductor se dibuja él mismo a pantalla
  // completa: la caja tiene que dejar de acotarlo.
  const containerStyle = fullscreen || pip
    ? StyleSheet.absoluteFillObject
    : {
        left: animate(full.x, mini.x),
        top: animate(full.y, mini.y),
        width: animate(full.width, mini.width),
        height: animate(full.height, mini.height),
      };

  return (
    <Animated.View
      style={[styles.host, containerStyle, isMini && styles.hostMini]}
      {...pan.panHandlers}>
      <Animated.View
        style={{
          width: fullscreen || pip ? '100%' : animate(full.width, MINI_VIDEO_WIDTH),
          height: fullscreen || pip ? '100%' : animate(full.height, MINI_HEIGHT),
        }}>
        <VideoPlayer
          key={index}
          source={current.source}
          title={current.title}
          style={styles.video}
          compact={isMini}
          paused={player.paused}
          onPausedChange={player.setPaused}
          onError={player.setError}
          onFullscreenChange={player.setFullscreen}
          onMinimize={player.minimize}
          onPipChange={player.setPip}
          hasPrevious={player.hasPrevious}
          hasNext={player.hasNext}
          onPrevious={() => player.goTo(index - 1)}
          onNext={() => player.goTo(index + 1)}
        />
      </Animated.View>

      {/* Controles del miniplayer: aparecen al encoger la caja. */}
      <Animated.View
        style={[styles.miniControls, {opacity: progress}]}
        pointerEvents={isMini ? 'auto' : 'none'}>
        <Pressable style={styles.miniTitle} onPress={player.expand}>
          <Text style={styles.miniTitleText} numberOfLines={2}>
            {current.title}
          </Text>
        </Pressable>
        <Pressable
          hitSlop={10}
          style={styles.miniButton}
          onPress={() => player.setPaused(!player.paused)}>
          {player.paused ? <PlayIcon size={18} /> : <PauseIcon size={18} />}
        </Pressable>
        <Pressable hitSlop={10} style={styles.miniButton} onPress={player.close}>
          <CloseIcon size={18} />
        </Pressable>
      </Animated.View>
    </Animated.View>
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
