import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  PermissionsAndroid,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SOURCES, {seriesOf, useCatalog} from '../sources';
import {t} from '../i18n';
import {usePlayer} from '../player/PlayerContext';
import Lottie, {LOADER} from './Lottie';
import useKeyboard from './useKeyboard';
import RoundButton from './RoundButton';
import {TAB_BAR_HEIGHT} from './TabBar';
import VideoPlayer from 'react-native-video/controls';
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
import {ArrowBackIcon, CloseIcon, PauseIcon, PlayIcon} from './icons';
import {formatTime} from './format';
import {ACCENT_END, PROGRESS_GRADIENT} from '../theme';

/**
 * Cuánto se espera a que una película del archivo resuelva su vídeo antes de
 * decir que algo va mal. Con la red caída no llega nunca, y una ruleta eterna
 * sobre negro no cuenta nada.
 */
const SLOW_MS = 10000;

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
  // El vídeo de una película del archivo se resuelve después de abrirla: hay
  // que repintar cuando aparezca su uri.
  useCatalog();
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

  /**
   * Android 13+ no enseña ninguna notificación sin permiso, y no lo pide solo:
   * los controles del sistema estarían ahí pero no se verían. Se pregunta al
   * abrir el primer vídeo —no al arrancar la app— para que el diálogo llegue
   * cuando se entiende para qué es. Si dice que no, todo lo demás sigue igual.
   */
  // A los pocos segundos sin resolver el vídeo se avisa: con la red caída, si
  // no, es una ruleta que no termina nunca y no dice nada.
  const [waitingTooLong, setWaitingTooLong] = useState(false);

  const notificationsAsked = useRef(false);
  useEffect(() => {
    if (index === null || notificationsAsked.current) {
      return;
    }
    notificationsAsked.current = true;
    if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
      return;
    }
    PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    ).catch(() => {
      // Que no se pueda preguntar no rompe nada: solo no habrá notificación.
    });
  }, [index]);
  // Mientras una película del archivo no tenga su uri no hay reproductor que
  // montar, solo el spinner: hay que contar ese tiempo aquí arriba, antes de
  // los `return` de abajo, que es donde se pueden usar hooks.
  // Ojo: el hueco de una película sin resolver es `uri: ''`, no la ausencia de
  // `uri` (ver `sources.ts`); esto tiene que decidir igual que el `sourceUri`
  // de abajo o se queda esperando a destiempo.
  const pending = index === null ? undefined : SOURCES[index]?.source;
  const waitingForSource =
    !!pending && !('uri' in pending && (pending as {uri: string}).uri);
  useEffect(() => {
    if (!waitingForSource) {
      setWaitingTooLong(false);
      return;
    }
    const timer = setTimeout(() => setWaitingTooLong(true), SLOW_MS);
    return () => clearTimeout(timer);
  }, [waitingForSource]);

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

  // Caja del miniplayer: pegada justo encima de la barra de pestañas o, si hay
  // teclado abierto (buscar), justo encima del teclado. Si no, al escribir se
  // queda debajo y parece que el vídeo se ha cerrado.
  const keyboard = useKeyboard(windowHeight);
  const mini = useMemo(
    () => ({
      x: 0,
      y:
        windowHeight -
        MINI_HEIGHT -
        (keyboard > 0 ? keyboard : insets.bottom + TAB_BAR_HEIGHT),
      width: windowWidth,
      height: MINI_HEIGHT,
    }),
    [windowWidth, windowHeight, insets.bottom, keyboard],
  );

  if (index === null) {
    return null;
  }

  const current = SOURCES[index];
  // El índice puede quedarse apuntando a nada (en desarrollo, cuando Fast
  // Refresh reevalúa el catálogo y vuelve a su tamaño inicial): sin esto, el
  // render revienta en vez de no enseñar nada.
  if (!current) {
    return null;
  }
  const sourceUri =
    'uri' in current.source ? (current.source as {uri: string}).uri : undefined;
  const isMini = mode === 'mini';
  const box = isMini ? mini : full;

  // En pantalla completa (o PiP, o inmersivo) el reproductor se dibuja él mismo a
  // pantalla completa: la caja tiene que dejar de acotarlo.
  // En miniplayer no tapa nada, aunque el modo siga siendo inmersivo.
  const covering = !isMini && (fullscreen || pip || immersive);
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
        {/* Una película del archivo se abre antes de saber su vídeo: mientras
            se resuelve no hay nada que montar, solo el spinner. */}
        {!sourceUri ? (
          <View style={[videoStyle, styles.waiting]}>
            {!isMini && (
              <>
                <Lottie source={LOADER} size={64} />
                {waitingTooLong && (
                  <Text style={styles.waitingText}>
                    {t('screen.preparingSlow')}
                  </Text>
                )}
                {/* La salida. Aquí todavía no hay reproductor montado, así que
                    tampoco está su flecha de volver: sin esto, un vídeo que no
                    llega a resolverse deja la app encallada (en iOS no hay
                    botón atrás del sistema). */}
                <RoundButton
                  accessibilityLabel={t('screen.close')}
                  onPress={player.close}
                  style={{...styles.waitingBack, top: insets.top + 8}}>
                  <ArrowBackIcon size={22} />
                </RoundButton>
              </>
            )}
          </View>
        ) : null}
        {/* Sin `key`: cambiar de vídeo o de canal solo cambia la fuente, así el
            reproductor nativo no se recrea (ver el reset en VideoPlayer). */}
        {sourceUri ? (
          <VideoPlayer
            onEvent={record}
            // El rojo que trae el reproductor es el de YouTube; aquí manda la
            // paleta de la app (ver `theme`): degradado en las barras y, para
            // iconos y tirador, el color en el que acaba ese degradado.
            accent={ACCENT_END}
            accentGradient={PROGRESS_GRADIENT}
            // El spinner de carga es una animación Lottie (ver `Lottie`); en el
            // miniplayer no cabe, así que ahí se deja el del sistema.
            loadingIndicator={
              isMini ? undefined : <Lottie source={LOADER} size={64} />
            }
            // «Ver desde el principio» ignora lo guardado en esa apertura.
            startPosition={
              player.fromStart ? 0 : resumeFrom(positions, sourceUri)
            }
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
            // Un directo se sigue oyendo con la app al fondo, como una radio:
            // es lo que hace útiles los controles de la notificación. Una
            // película no: ahí lo normal es que se pare y se siga luego por
            // donde iba (ver el pausado por `AppState` en `VideoPlayer`).
            playInBackground={current.kind === 'live'}
            playWhenInactive={current.kind === 'live'}
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
            onMinimize={player.minimize}
            hasPrevious={player.hasPrevious}
            hasNext={player.hasNext}
            onPrevious={() =>
              player.previousIndex !== null && player.goTo(player.previousIndex)
            }
            onNext={() =>
              player.nextIndex !== null && player.goTo(player.nextIndex)
            }
          />
        ) : null}
      </View>

      {/* En mini, tocar el vídeo devuelve al reproductor grande. La zona va
          encima: la vista nativa del vídeo se queda los toques. */}
      {isMini && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={current.title}
          onPress={player.expand}
          style={[styles.miniTap, {width: MINI_VIDEO_WIDTH}]}
        />
      )}

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
          <Pressable
            hitSlop={10}
            style={styles.miniButton}
            onPress={player.close}>
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
    // Un gris sólido, sin desenfoque: más barato y se ve igual en Android, donde
    // el blur no llega a capturar el vídeo.
    backgroundColor: '#1a1a1c',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: -2},
  },
  // `as const` para que los porcentajes no se ensanchen a `string`: el tipo de
  // la prop viene de la librería y ahí solo valen `number | 'auto' | '<n>%'`.
  video: {width: '100%' as const, height: '100%' as const},
  waiting: {alignItems: 'center', justifyContent: 'center', gap: 16},
  waitingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  waitingBack: {position: 'absolute', left: 16},
  miniTap: {position: 'absolute', left: 0, top: 0, bottom: 0},
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
