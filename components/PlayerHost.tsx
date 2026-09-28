import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SOURCES, {seriesOf} from '../sources';
import {t} from '../i18n';
import {usePlayer} from '../player/PlayerContext';
import {TAB_BAR_HEIGHT} from './TabBar';
import VideoPlayer from './VideoPlayer';
import {record} from '../player/telemetry';
import {
  loadPositions,
  loadPrefs,
  resumeFrom,
  savePosition,
  savePrefs,
  withPosition,
  type Positions,
  type Prefs,
} from '../player/storage';
import {CloseIcon, PauseIcon, PlayIcon} from './icons';
import {formatTime} from './format';

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
  // Lo que sobrevive a cerrar la app: preferencias y dónde ibas en cada vídeo.
  const [prefs, setPrefs] = useState<Prefs>({});
  const [positions, setPositions] = useState<Positions>({});
  const setDataSaver = player.setDataSaver;

  // Hasta que no se ha leído lo guardado no se escribe nada: si no, el primer
  // render (con las preferencias vacías) pisaría el disco.
  const loaded = useRef(false);
  useEffect(() => {
    loadPositions().then(setPositions);
    loadPrefs().then(saved => {
      setPrefs(saved);
      if (saved.dataSaver) {
        setDataSaver(saved.dataSaver);
      }
      loaded.current = true;
    });
  }, [setDataSaver]);

  /** Guarda y recuerda: el reproductor solo avisa de lo que el usuario cambió. */
  const persistPrefs = useCallback((next: Prefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  // El ahorro de datos vive en el contexto (sobrevive al cambio de vídeo), así que
  // se persiste desde aquí cuando cambia.
  const dataSaver = player.dataSaver;
  useEffect(() => {
    if (!loaded.current) {
      return;
    }
    setPrefs(current => {
      if (current.dataSaver === dataSaver) {
        return current;
      }
      const next = {...current, dataSaver};
      savePrefs(next);
      return next;
    });
  }, [dataSaver]);
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const {index, mode, presentation, fullscreen, pip} = player;
  // Inmersivo (una serie, como Netflix): el reproductor nace a pantalla completa,
  // así que la caja no lo acota desde el primer fotograma.
  const immersive = presentation === 'immersive';

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
  const sourceUri =
    'uri' in current.source ? (current.source as {uri: string}).uri : undefined;
  const isMini = mode === 'mini';
  const box = isMini ? mini : full;

  // En pantalla completa (o PiP, o inmersivo) el reproductor se dibuja él mismo a
  // pantalla completa: la caja tiene que dejar de acotarlo.
  const covering = fullscreen || pip || immersive;
  const containerStyle = covering
    ? StyleSheet.absoluteFill
    : {left: box.x, top: box.y, width: box.width, height: box.height};

  const videoStyle = covering
    ? {width: '100%' as const, height: '100%' as const}
    : {
        width: isMini ? MINI_VIDEO_WIDTH : box.width,
        height: isMini ? MINI_HEIGHT : box.height,
      };

  // Lista de episodios de la serie abierta (si lo que suena es un episodio), con
  // lo ya visto de cada uno para pintar su barrita.
  const series = seriesOf(index);
  const episodes = series?.episodes.map(item => {
    const uri = item.source.uri;
    const saved = positions[uri];
    const badge = item.episode
      ? t('screen.seriesBadge', {
          season: item.episode.season,
          number: item.episode.number,
        })
      : item.label;
    return {
      id: item.index,
      title: item.title,
      subtitle: saved
        ? `${badge} · ${t('screen.continueWatching', {
            position: formatTime(saved.seconds),
          })}`
        : badge,
      progress:
        saved && saved.duration > 0 ? saved.seconds / saved.duration : 0,
    };
  });

  return (
    <View style={[styles.host, containerStyle, isMini && styles.hostMini]}>
      <View style={videoStyle}>
        {/* Sin `key`: cambiar de vídeo o de canal solo cambia la fuente, así el
            reproductor nativo no se recrea (ver el reset en VideoPlayer). */}
        <VideoPlayer
          onEvent={record}
          startPosition={resumeFrom(positions, sourceUri)}
          onPositionChange={(seconds, duration) => {
            if (!sourceUri) {
              return;
            }
            savePosition(sourceUri, seconds, duration);
            // Mismo criterio que en disco: lo que ya no se recuerda desaparece
            // también de la lista de episodios.
            setPositions(saved =>
              withPosition(saved, sourceUri, seconds, duration),
            );
          }}
          prefs={prefs}
          onPrefsChange={persistPrefs}
          source={current.source}
          title={current.title}
          style={styles.video}
          compact={isMini}
          paused={player.paused}
          onPausedChange={player.setPaused}
          storyboard={current.storyboard}
          chapters={current.chapters}
          presentation={presentation}
          onClose={player.close}
          episodes={episodes}
          currentEpisodeId={index}
          onSelectEpisode={id => player.goTo(Number(id))}
          nextUp={
            player.nextIndex !== null
              ? {
                  title: SOURCES[player.nextIndex].title,
                  label: series ? t('next.nextEpisode') : undefined,
                }
              : undefined
          }
          dataSaver={player.dataSaver}
          onDataSaverChange={player.setDataSaver}
          onError={player.setError}
          onFullscreenChange={player.setFullscreen}
          onPipChange={player.setPip}
          onMinimize={immersive ? undefined : player.minimize}
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
