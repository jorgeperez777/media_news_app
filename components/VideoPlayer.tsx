import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
  Modal,
  PanResponder,
  PixelRatio,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {CastButton} from 'react-native-google-cast';
import Orientation from 'react-native-orientation-locker';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Video, {
  AirPlayButton,
  isPictureInPictureSupported,
  SelectedTrackType,
  SelectedVideoTrackType,
  type OnBufferData,
  type OnExternalPlaybackChangeData,
  type OnLoadData,
  type OnProgressData,
  type OnAudioTracksData,
  type OnTextTracksData,
  type OnVideoErrorData,
  type OnVideoTracksData,
  type AudioTrack,
  type TextTrack,
  type ReactVideoSource,
  type VideoRef,
  type VideoTrack,
} from 'react-native-video';
import {t} from '../i18n';
import {formatTime} from './format';
import type {PlaybackEvent} from '../player/telemetry';
import {SAVE_EVERY_MS, type Prefs} from '../player/storage';
import SeekBar from './SeekBar';
import useCast from './useCast';
import useNetworkCap, {mbps, type DataSaver} from './useNetworkCap';
import useStoryboard, {type StoryboardSource} from './useStoryboard';
import {
  AirPlayGlyph,
  CastIcon,
  ChevronIcon,
  FastForwardIcon,
  FullscreenIcon,
  StopIcon,
  PipIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  SettingsIcon,
  SkipIcon,
  SubtitlesIcon,
  TrackIcon,
} from './icons';

const SKIP_SECONDS = 10;
const DOUBLE_TAP_MS = 300;
// Tras un doble tap, taps sencillos dentro de esta ventana siguen saltando.
const SKIP_CHAIN_MS = 800;
const AUTO_HIDE_MS = 3000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// Mantener pulsado el vídeo acelera la reproducción hasta soltar (como TikTok).
const BOOST_RATE = 2;
// Umbral del pulsado largo. Por encima de la ventana de doble tap, para que un
// tap que se demora no acelere sin querer.
const BOOST_HOLD_MS = 400;
// Por debajo de este retraso (respecto a la posición live del reproductor) se
// considera que estás "en directo".
const LIVE_EDGE_TOLERANCE_S = 5;
// Directos con ventana DVR menor que esto no muestran barra ni saltos.
const MIN_DVR_WINDOW_S = 30;
// Reintentos automáticos tras un error: 2 s, 4 s, 8 s, 16 s, 30 s (tope) y luego se detiene.
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];

type Side = 'left' | 'right';

/**
 * Tramo con nombre dentro del vídeo. Separa la barra de progreso y, si es
 * `skippable`, saca el botón para saltarlo (intro, resumen del capítulo previo…).
 */
export type Chapter = {
  title: string;
  start: number;
  end: number;
  skippable?: boolean;
};

/**
 * Qué partes del overlay se ofrecen. Todas van activas por defecto: solo hace
 * falta pasar las que quieras quitar (`features={{skipButtons: false}}`).
 */
export type PlayerFeatures = {
  /** Botones ⟲10 / ⟳10 de la fila central. */
  skipButtons?: boolean;
  /** Doble tap en los lados para ±10 s. Sin él, el tap solo muestra/oculta. */
  doubleTapSkip?: boolean;
  /** Botones ⏮ / ⏭ (además hay que pasar `onNext`/`onPrevious`). */
  trackButtons?: boolean;
  /** Barra de progreso: la arrastrable y la fina de cuando se ocultan los controles. */
  seekBar?: boolean;
  /** Miniatura del instante al arrastrar (además hay que pasar `storyboard`). */
  seekPreview?: boolean;
  /** Mantener pulsado el vídeo para ir a x2. */
  holdToSpeed?: boolean;
  /** Botón CC. Los subtítulos se siguen pudiendo elegir en ⚙. */
  subtitlesButton?: boolean;
  /** Botón ⚙: calidad, ahorro de datos, subtítulos y velocidad. */
  settingsButton?: boolean;
  /** Botón ▭ de Picture in Picture (además el dispositivo tiene que soportarlo). */
  pipButton?: boolean;
  /** Botones de Chromecast y AirPlay. */
  routeButtons?: boolean;
  /** Botón ⤢ de pantalla completa. */
  fullscreenButton?: boolean;
  /** Botón «Saltar intro» en los capítulos marcados como saltables. */
  skipIntro?: boolean;
  /** Tarjeta de «a continuación» en los últimos segundos. */
  nextUpCard?: boolean;
  /** Deslizar arriba/abajo: volumen (derecha) y brillo (izquierda). */
  verticalGestures?: boolean;
  /** Pellizcar para alternar entre ajustar y rellenar la pantalla. */
  pinchToFill?: boolean;
};

type Props = {
  source: ReactVideoSource;
  title?: string;
  style?: StyleProp<ViewStyle>;
  onError?: (message: string) => void;
  /** Se llama al entrar/salir de pantalla completa (útil para ocultar el resto de la UI). */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Se llama al entrar/salir de Picture in Picture. */
  onPipChange?: (active: boolean) => void;
  /**
   * Si se pasa, aparece el chevron ⌄ a la izquierda del título (como en YouTube)
   * para mandar el reproductor al miniplayer.
   */
  onMinimize?: () => void;
  /** Lista de reproducción: botones ⏮/⏭ (solo en VOD) y autoplay del siguiente al terminar. */
  onNext?: () => void;
  onPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  /** Reproducir el siguiente automáticamente al terminar (por defecto true). */
  autoplayNext?: boolean;
  /**
   * Modo miniplayer: solo el vídeo, sin overlay ni gestos. Quien lo use dibuja
   * sus propios controles encima (ver `PlayerHost`).
   */
  compact?: boolean;
  /**
   * Pausa controlada desde fuera. Si se pasa, manda el padre (hace falta para que
   * el miniplayer y el reproductor grande compartan el mismo estado); si no, el
   * reproductor la gestiona él solo.
   */
  paused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /**
   * Ahorro de datos. Vive fuera del reproductor para que la elección sobreviva al
   * cambio de vídeo (que remonta este componente).
   */
  dataSaver?: DataSaver;
  onDataSaverChange?: (mode: DataSaver) => void;
  /** Miniaturas para la vista previa de la barra (ver `useStoryboard`). */
  storyboard?: StoryboardSource;
  /** Capítulos del vídeo: marcas en la barra y botón de saltar intro. */
  chapters?: Chapter[];
  /** Qué viene después, para la tarjeta de continuidad de los últimos segundos. */
  nextUp?: {title: string};
  /**
   * Controles del sistema (notificación en Android, pantalla de bloqueo y centro de
   * control en iOS) con los metadatos de `source.metadata`. En iOS solo se ven en
   * dispositivo, no en el simulador.
   */
  notificationControls?: boolean;
  /** Seguir sonando con la app en segundo plano (radio/TV). */
  playInBackground?: boolean;
  /** Segundo por el que arrancar («seguir viendo»). Solo VOD. */
  startPosition?: number;
  /** Cada pocos segundos, para que quien nos use guarde la posición. */
  onPositionChange?: (seconds: number, duration: number) => void;
  /**
   * Preferencias recordadas entre sesiones (idioma de subtítulos y audio, calidad
   * y velocidad). El reproductor las aplica cuando el stream anuncia sus pistas y
   * avisa por `onPrefsChange` en cuanto el usuario cambia algo.
   */
  prefs?: Prefs;
  onPrefsChange?: (prefs: Prefs) => void;
  /** Controles que se ofrecen; por defecto, todos (ver `PlayerFeatures`). */
  features?: PlayerFeatures;
  /**
   * Hechos de reproducción para telemetría (arranque, rebuffers, errores…). El
   * reproductor no agrega nada: solo cuenta lo que pasa. Ver `player/telemetry`.
   */
  onEvent?: (event: PlaybackEvent) => void;
  /**
   * Color de acento. Lo usan la barra de progreso y todo lo que dice "activo"
   * (CC encendido, opción elegida en ⚙, badge EN VIVO cuando vas en directo),
   * para que no haya dos colores distintos significando lo mismo.
   */
  accent?: string;
};

const BOTTOM_BAR_PADDING = 12;
// Acento por defecto: el rojo de la barra de progreso.
const DEFAULT_ACCENT = '#ff0000';
// La tarjeta de «a continuación» aparece en los últimos segundos del vídeo.
const NEXT_UP_S = 10;
// Ancho en pantalla de la miniatura de la vista previa; el alto lo pone el sprite.
const PREVIEW_WIDTH = 160;

// ⏮ con más de este tiempo reproducido vuelve al inicio en vez de al anterior (como YouTube).
const PREVIOUS_RESTART_THRESHOLD_S = 3;

// Se reexporta para quien ya lo importaba desde aquí.
export {formatTime};

export default function VideoPlayer({
  source,
  title,
  style,
  onError,
  onFullscreenChange,
  onPipChange,
  onMinimize,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  autoplayNext = true,
  compact = false,
  paused: pausedProp,
  onPausedChange,
  dataSaver = 'auto',
  onDataSaverChange,
  storyboard,
  chapters,
  nextUp,
  notificationControls = true,
  playInBackground = false,
  startPosition = 0,
  onPositionChange,
  prefs,
  onPrefsChange,
  features = {},
  accent = DEFAULT_ACCENT,
  onEvent,
}: Props) {
  const {
    skipButtons = true,
    doubleTapSkip = true,
    trackButtons = true,
    seekBar = true,
    seekPreview = true,
    holdToSpeed = true,
    subtitlesButton = true,
    settingsButton = true,
    pipButton = true,
    routeButtons = true,
    fullscreenButton = true,
    skipIntro = true,
    nextUpCard = true,
    verticalGestures = true,
    pinchToFill = true,
  } = features;
  const videoRef = useRef<VideoRef>(null);
  const insets = useSafeAreaInsets();

  const [ownPaused, setOwnPaused] = useState(false);
  const paused = pausedProp ?? ownPaused;
  // Espejo del valor actual: los setPaused(p => !p) se resuelven contra él, así el
  // callback no depende de `paused` ni se recrea en cada cambio.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const setPaused = useCallback(
    (next: boolean | ((previous: boolean) => boolean)) => {
      const value = typeof next === 'function' ? next(pausedRef.current) : next;
      pausedRef.current = value;
      if (onPausedChange) {
        onPausedChange(value);
      }
      if (pausedProp === undefined) {
        setOwnPaused(value);
      }
    },
    [onPausedChange, pausedProp],
  );
  const [ended, setEnded] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [rate, setRate] = useState(1);
  // Aceleración por pulsado largo: se activa mientras el dedo siga abajo, así que
  // el ref es quien decide en onPressOut (el estado solo pinta el aviso).
  const [boosting, setBoosting] = useState(false);
  const boostingRef = useRef(false);
  // Directo: isLive viene de onLoad/onProgress (campo añadido a la librería);
  // liveOffset son los segundos por detrás del borde del directo (-1 = desconocido).
  const [isLive, setIsLive] = useState(false);
  const [liveOffset, setLiveOffset] = useState(-1);
  const [seekableDuration, setSeekableDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Picture in Picture. En Android la ventana PiP muestra la Activity entera escalada,
  // así que mientras está activo ocultamos los controles y el vídeo ocupa todo.
  const [pipActive, setPipActive] = useState(false);
  // PiP no existe en todos los sitios (el simulador de iOS no lo soporta, y en
  // Android hace falta que el dispositivo declare la característica). Sin soporte,
  // entrar en PiP no falla: no hace nada. Así que mejor no ofrecer el botón.
  const [pipSupported, setPipSupported] = useState(false);
  useEffect(() => {
    isPictureInPictureSupported().then(setPipSupported);
  }, []);
  // AirPlay (iOS): AVPlayer enruta el vídeo él mismo; aquí solo sabemos que está activo
  // y a qué dispositivo va, para avisarlo en pantalla.
  const [airplay, setAirplay] = useState<{active: boolean; deviceName?: string | null}>({
    active: false,
  });
  const [controlsVisible, setControlsVisible] = useState(true);
  // Menú ⚙: principal → Calidad / Velocidad.
  const [menu, setMenu] = useState<
    'main' | 'quality' | 'speed' | 'subtitles' | 'audio' | 'saver' | null
  >(null);
  // Calidad: 'auto' (ABR) o el alto en px de la variante elegida. Solo Android.
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [quality, setQuality] = useState<'auto' | number>('auto');
  // Tope de bitrate según la red (ver useNetworkCap) y última estimación de ancho
  // de banda que publica ExoPlayer (`reportBandwidth`, solo Android).
  const networkCap = useNetworkCap(dataSaver);
  // Vista previa de la barra: recorte del storyboard para el instante arrastrado.
  const tileAt = useStoryboard(seekPreview ? storyboard : undefined);
  const [layoutWidth, setLayoutWidth] = useState(0);
  // Gestos verticales: volumen del reproductor y «brillo». El brillo real del
  // sistema necesita módulo nativo, así que lo que se ajusta es un velo negro
  // encima del vídeo: oscurece, que es para lo que se usa de noche.
  const [volume, setVolume] = useState(1);
  const [dim, setDim] = useState(0);
  // Pellizcar: ajustar (contain) o rellenar (cover) la caja del reproductor.
  const [fill, setFill] = useState(false);
  const [hud, setHud] = useState<{label: string; value?: number} | null>(null);
  const [bandwidth, setBandwidth] = useState(0);
  // Subtítulos: pistas que anuncia el stream y la elegida ('off' = desactivados).
  const [textTracks, setTextTracks] = useState<TextTrack[]>([]);
  const [subtitle, setSubtitle] = useState<'off' | number>('off');
  // Audio: pistas que anuncia el stream y la elegida ('auto' = la del sistema, que
  // es la que casa con el idioma del dispositivo).
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [audioTrack, setAudioTrack] = useState<'auto' | number>('auto');
  // Última pista encendida, para que el botón CC la recupere al volver a activarlos.
  const lastSubtitle = useRef<number | null>(null);
  if (subtitle !== 'off') {
    lastSubtitle.current = subtitle;
  }
  // El usuario descartó el salto automático al siguiente en este vídeo.
  const [nextCancelled, setNextCancelled] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [skipHint, setSkipHint] = useState<{side: Side; seconds: number} | null>(null);
  // Se incrementa con cada interacción para reiniciar el temporizador de auto-ocultar.
  const [interaction, setInteraction] = useState(0);

  // Recuperación de errores: la librería no reinicializa el reproductor tras un
  // error fatal, así que remontamos <Video> (key) y reanudamos desde la última posición.
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [playerKey, setPlayerKey] = useState(0);
  const [online, setOnline] = useState(true);
  const resumeTimeRef = useRef(0);
  const resumeToLiveRef = useRef(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Última posición local conocida, para arrancar el Chromecast donde íbamos.
  const currentTimeRef = useRef(0);
  const surfaceWidth = useRef(1);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTap = useRef<{time: number; side: Side} | null>(null);
  const lastSkip = useRef<{time: number; side: Side; seconds: number} | null>(null);

  const touch = useCallback(() => setInteraction(n => n + 1), []);

  const showControls = useCallback(() => {
    setControlsVisible(true);
    touch();
  }, [touch]);

  // Auto-ocultar mientras reproduce y no hay interacción en curso.
  useEffect(() => {
    if (
      !controlsVisible ||
      paused ||
      scrubbing ||
      menu ||
      buffering ||
      playerError
    ) {
      return;
    }
    const timer = setTimeout(() => setControlsVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(timer);
  }, [
    controlsVisible,
    paused,
    scrubbing,
    menu,
    buffering,
    playerError,
    interaction,
  ]);

  // Fullscreen: rota a horizontal, avisa al padre y el botón atrás de Android sale.
  useEffect(() => {
    onFullscreenChange?.(fullscreen);
    if (!fullscreen) {
      Orientation.lockToPortrait();
      return;
    }
    Orientation.lockToLandscape();
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setFullscreen(false);
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  useEffect(() => () => Orientation.unlockAllOrientations(), []);

  useEffect(() => {
    onPipChange?.(pipActive);
    if (pipActive) {
      setControlsVisible(false);
      setMenu(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipActive]);

  // Conectividad: al volver la red, reintentar de inmediato si estamos en error.
  // retryNow se incrementa desde el botón "Reintentar" o desde NetInfo.
  const [retryNow, setRetryNow] = useState(0);
  const onlineRef = useRef(true);
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const isOnline = !!state.isConnected && state.isInternetReachable !== false;
      const cameBack = isOnline && !onlineRef.current;
      onlineRef.current = isOnline;
      setOnline(isOnline);
      if (cameBack) {
        setRetryNow(n => n + 1);
      }
    });
    return unsubscribe;
  }, []);

  const sourceUri =
    typeof source === 'object' && source !== null && 'uri' in source
      ? (source as {uri?: string}).uri
      : undefined;

  // Preferencias: se leen por ref para no re-aplicarlas en cada render.
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const onPrefsChangeRef = useRef(onPrefsChange);
  onPrefsChangeRef.current = onPrefsChange;
  /** Fusiona y publica el cambio; quien nos use decide dónde se guarda. */
  const updatePrefs = useCallback((partial: Prefs) => {
    onPrefsChangeRef.current?.({...prefsRef.current, ...partial});
  }, []);
  // La posición se publica cada pocos segundos, no en cada onProgress.
  const onPositionRef = useRef(onPositionChange);
  onPositionRef.current = onPositionChange;
  const lastSavedAt = useRef(0);
  // «Seguir viendo»: se aplica una vez por fuente, cuando el medio ya cargó.
  const resumeApplied = useRef(false);
  const prefsApplied = useRef({subtitle: false, audio: false, quality: false});

  // Telemetría. El callback se lee por ref para que cambiarlo no reabra sesiones.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const emitEvent = useCallback((event: PlaybackEvent) => {
    onEventRef.current?.(event);
  }, []);
  const titleRef = useRef(title);
  titleRef.current = title;
  // Cada fuente nueva (también la primera) abre una sesión de medición.
  useEffect(() => {
    emitEvent({type: 'start', title: titleRef.current ?? sourceUri ?? ''});
  }, [emitEvent, sourceUri]);
  // Cambiar de vídeo o de canal ya no remonta el reproductor (así ExoPlayer/AVPlayer
  // no se recrean), así que hay que limpiar a mano lo que era del medio anterior.
  // `firstSource` evita hacerlo en el primer render, donde no hay nada que limpiar.
  const firstSource = useRef(true);
  useEffect(() => {
    if (firstSource.current) {
      firstSource.current = false;
      return;
    }
    setCurrentTime(0);
    setDuration(0);
    setBuffered(0);
    setBuffering(true);
    setEnded(false);
    setIsLive(false);
    setLiveOffset(-1);
    setSeekableDuration(0);
    setScrubbing(false);
    setVideoTracks([]);
    setQuality('auto');
    setTextTracks([]);
    setSubtitle('off');
    lastSubtitle.current = null;
    setAudioTracks([]);
    setAudioTrack('auto');
    setNextCancelled(false);
    resumeApplied.current = false;
    prefsApplied.current = {subtitle: false, audio: false, quality: false};
    lastSavedAt.current = 0;
    setPlayerError(null);
    setRetryAttempt(0);
    setRetryCountdown(null);
    setMenu(null);
    setControlsVisible(true);
    resumeTimeRef.current = 0;
    resumeToLiveRef.current = false;
    currentTimeRef.current = 0;
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
  }, [sourceUri]);

  // Chromecast: al conectar un dispositivo, el vídeo pasa al receptor y la
  // reproducción local se pausa; al desconectar, se reanuda donde iba el receptor.
  const cast = useCast({
    media: {url: sourceUri, title, isLive, duration},
    getLocalTime: () => currentTimeRef.current,
    onCastStart: () => {
      setPaused(true);
      setMenu(null);
      setControlsVisible(true);
    },
    onCastEnd: position => {
      if (!isLive && position > 0) {
        videoRef.current?.seek(position);
        setCurrentTime(position);
      }
      setPaused(false);
    },
  });
  const casting = cast.casting;

  const retry = useCallback(() => {
    if (retryTimer.current) {
      clearTimeout(retryTimer.current);
      retryTimer.current = null;
    }
    setRetryCountdown(null);
    setPlayerError(null);
    setBuffering(true);
    setPaused(false);
    setPlayerKey(k => k + 1); // remonta <Video> → la librería vuelve a preparar el source
  }, [setPaused]);

  // Reintento manual (botón) o forzado por la red: reinicia la cuenta de intentos.
  useEffect(() => {
    if (retryNow > 0 && playerError) {
      setRetryAttempt(0);
      retry();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryNow]);

  // Reintento automático con backoff mientras haya red. Sin red, esperamos a NetInfo.
  useEffect(() => {
    if (!playerError || !online) {
      setRetryCountdown(null);
      return;
    }
    const delay = RETRY_DELAYS_MS[retryAttempt];
    if (delay === undefined) {
      setRetryCountdown(null); // agotados: queda el botón "Reintentar"
      return;
    }
    const deadline = Date.now() + delay;
    setRetryCountdown(Math.ceil(delay / 1000));
    const tick = setInterval(
      () => setRetryCountdown(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))),
      500,
    );
    retryTimer.current = setTimeout(() => {
      clearInterval(tick);
      setRetryAttempt(a => a + 1);
      retry();
    }, delay);
    return () => {
      clearInterval(tick);
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };
  }, [playerError, online, retryAttempt, retry]);

  useEffect(
    () => () => {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
      }
      if (skipHintTimer.current) {
        clearTimeout(skipHintTimer.current);
      }
    },
    [],
  );

  const seekTo = useCallback(
    (time: number) => {
      const max = isLive ? seekableDuration : duration;
      const clamped = Math.max(0, Math.min(max || 0, time));
      if (casting) {
        cast.seek(clamped);
        return;
      }
      videoRef.current?.seek(clamped);
      setCurrentTime(clamped);
      emitEvent({type: 'seek'});
      if (ended && clamped < duration) {
        setEnded(false);
      }
    },
    [cast, casting, duration, emitEvent, ended, isLive, seekableDuration],
  );

  // Vuelve a la posición live del reproductor (currentTime + liveOffset) y reanuda.
  // No saltamos al borde absoluto de la ventana para evitar rebuffering.
  const goToLive = useCallback(() => {
    const target =
      liveOffset >= 0 ? currentTime + liveOffset : seekableDuration;
    videoRef.current?.seek(target);
    setCurrentTime(target);
    setPaused(false);
    touch();
  }, [currentTime, liveOffset, seekableDuration, setPaused, touch]);

  const togglePlay = useCallback(() => {
    if (casting) {
      if (cast.paused) {
        cast.play();
      } else {
        cast.pause();
      }
      touch();
      return;
    }
    if (ended) {
      seekTo(0);
      setEnded(false);
      setPaused(false);
    } else {
      setPaused(p => !p);
    }
    touch();
  }, [cast, casting, ended, seekTo, setPaused, touch]);

  // showHint: el indicador lateral solo se muestra con el gesto de doble tap.
  const skip = useCallback(
    (side: Side, showHint = true) => {
      const now = Date.now();
      const chained =
        lastSkip.current &&
        lastSkip.current.side === side &&
        now - lastSkip.current.time < SKIP_CHAIN_MS;
      const seconds = (chained ? lastSkip.current!.seconds : 0) + SKIP_SECONDS;
      lastSkip.current = {time: now, side, seconds};

      const from = casting ? cast.position : currentTime;
      seekTo(from + (side === 'left' ? -SKIP_SECONDS : SKIP_SECONDS));
      if (showHint) {
        setSkipHint({side, seconds});
        if (skipHintTimer.current) {
          clearTimeout(skipHintTimer.current);
        }
        skipHintTimer.current = setTimeout(() => setSkipHint(null), SKIP_CHAIN_MS);
      }
      touch();
    },
    [cast, casting, currentTime, seekTo, touch],
  );

  // Tap sencillo: mostrar/ocultar. Doble tap en un lado: saltar ±10 s.
  const onSurfacePress = (e: GestureResponderEvent) => {
    if (pipActive) {
      return;
    }
    if (!canSkip || !doubleTapSkip) {
      // Sin doble tap (directo, o desactivado por props) el tap actúa al instante.
      if (controlsVisible) {
        setControlsVisible(false);
      } else {
        showControls();
      }
      return;
    }
    const side: Side = e.nativeEvent.locationX < surfaceWidth.current / 2 ? 'left' : 'right';
    const now = Date.now();

    const chaining =
      lastSkip.current &&
      lastSkip.current.side === side &&
      now - lastSkip.current.time < SKIP_CHAIN_MS;
    const isDouble =
      lastTap.current &&
      lastTap.current.side === side &&
      now - lastTap.current.time < DOUBLE_TAP_MS;

    lastTap.current = {time: now, side};

    if (chaining || isDouble) {
      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
      skip(side);
      return;
    }

    tapTimer.current = setTimeout(() => {
      tapTimer.current = null;
      if (controlsVisible) {
        setControlsVisible(false);
      } else {
        showControls();
      }
    }, DOUBLE_TAP_MS);
  };

  // Mantener pulsado: x2 mientras el dedo siga abajo, como en TikTok. No en directo
  // (correríamos hasta el borde del directo y solo conseguiríamos un atasco) ni
  // transmitiendo (ahí la velocidad la manda el receptor).
  const canBoost =
    holdToSpeed && !isLive && !casting && !playerError && !paused && !ended;
  // Si en ⚙ ya había puesto algo más rápido, su elección gana: acelerar nunca frena.
  const boostRate = Math.max(rate, BOOST_RATE);

  const startBoost = () => {
    if (!canBoost) {
      return;
    }
    boostingRef.current = true;
    setBoosting(true);
    // Los controles estorban justo cuando quieres ver pasar el vídeo: se van (y al
    // soltar se quedan así, como en YouTube; un tap los devuelve).
    setControlsVisible(false);
  };

  const endBoost = () => {
    if (!boostingRef.current) {
      return;
    }
    boostingRef.current = false;
    setBoosting(false);
  };

  // Si acelerar deja de tener sentido con el dedo todavía abajo (terminó el vídeo,
  // llegó un error, pausaron desde la notificación), volver a la velocidad normal.
  useEffect(() => {
    if (boosting && !canBoost) {
      boostingRef.current = false;
      setBoosting(false);
    }
  }, [boosting, canBoost]);

  // Deslizar en vertical y pellizcar. Va por encima del `Pressable` de los taps:
  // solo reclama el gesto cuando hay movimiento claro, así el tap, el doble tap y
  // el pulsado largo siguen funcionando igual.
  const surfaceHeight = useRef(1);
  // Posición de la caja en la ventana: hace falta para saber en qué mitad empezó el
  // gesto. `locationX` no sirve aquí, porque el toque empieza en el hijo y el padre
  // se queda el gesto después.
  const containerRef = useRef<React.ComponentRef<typeof View>>(null);
  const surfacePageX = useRef(0);
  const hudTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const gesture = useRef({
    mode: null as null | 'volume' | 'brightness' | 'pinch',
    start: 0,
    distance: 0,
  }).current;
  const gestureRef = useRef({verticalGestures, pinchToFill, volume, dim, compact});
  gestureRef.current = {verticalGestures, pinchToFill, volume, dim, compact};

  const showHud = useCallback((label: string, value?: number) => {
    setHud({label, value});
    if (hudTimer.current) {
      clearTimeout(hudTimer.current);
    }
    hudTimer.current = setTimeout(() => setHud(null), 900);
  }, []);

  const touchDistance = (
    touches: ReadonlyArray<{pageX: number; pageY: number}>,
  ) => {
    const [a, b] = touches;
    return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
  };

  const pan = useRef(
    PanResponder.create({
      // El tap lo sigue atendiendo el Pressable de debajo.
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (e, g) => {
        const {verticalGestures: vertical, pinchToFill: pinch, compact: mini} =
          gestureRef.current;
        if (mini) {
          return false;
        }
        if (pinch && e.nativeEvent.touches.length === 2) {
          return true;
        }
        return (
          vertical && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx) * 1.5
        );
      },
      onPanResponderGrant: (e, g) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
          gesture.mode = 'pinch';
          gesture.distance = touchDistance(touches);
          return;
        }
        const startX = g.x0 - surfacePageX.current;
        const right = startX > surfaceWidth.current / 2;
        gesture.mode = right ? 'volume' : 'brightness';
        gesture.start = right
          ? gestureRef.current.volume
          : 1 - gestureRef.current.dim;
      },
      onPanResponderMove: (e, g) => {
        if (gesture.mode === 'pinch') {
          const touches = e.nativeEvent.touches;
          if (touches.length < 2) {
            return;
          }
          const ratio = touchDistance(touches) / (gesture.distance || 1);
          if (ratio > 1.15) {
            setFill(true);
            showHud(t('gesture.fill'));
          } else if (ratio < 0.87) {
            setFill(false);
            showHud(t('gesture.fit'));
          }
          return;
        }
        if (!gesture.mode) {
          return;
        }
        // Todo el alto de la caja recorre el rango entero, con un poco de margen.
        const delta = -g.dy / (surfaceHeight.current * 0.8);
        const value = Math.max(0, Math.min(1, gesture.start + delta));
        if (gesture.mode === 'volume') {
          setVolume(value);
          showHud(t('gesture.volume'), value);
        } else {
          // El velo es lo contrario del brillo: a menos brillo, más velo.
          setDim(1 - value);
          showHud(t('gesture.brightness'), value);
        }
      },
      onPanResponderRelease: () => {
        gesture.mode = null;
      },
      onPanResponderTerminate: () => {
        gesture.mode = null;
      },
    }),
  ).current;

  useEffect(
    () => () => {
      if (hudTimer.current) {
        clearTimeout(hudTimer.current);
      }
    },
    [],
  );

  const onLoad = (data: OnLoadData) => {
    setDuration(data.duration);
    // «Seguir viendo»: solo en VOD, y solo la primera carga de esta fuente.
    if (!resumeApplied.current) {
      resumeApplied.current = true;
      if (!data.isLive && startPosition > 0 && startPosition < data.duration) {
        videoRef.current?.seek(startPosition);
        setCurrentTime(startPosition);
      }
      const savedSpeed = prefsRef.current?.speed;
      if (savedSpeed && savedSpeed !== 1 && !data.isLive) {
        setRate(savedSpeed);
      }
    }
    setIsLive(!!data.isLive);
    setBuffering(false);
    if (data.videoTracks?.length) {
      setVideoTracks(data.videoTracks);
    }
    if (data.textTracks?.length) {
      setTextTracks(data.textTracks);
      applySubtitlePref(data.textTracks);
    }
    if (data.audioTracks?.length) {
      setAudioTracks(data.audioTracks);
      applyAudioPref(data.audioTracks);
    }
    // Cargó tras un reintento: reanudar donde estábamos (o al directo).
    if (playerKey > 0) {
      if (resumeToLiveRef.current || data.isLive) {
        // Al remontar, el reproductor arranca ya en la posición live por defecto.
      } else if (resumeTimeRef.current > 0) {
        videoRef.current?.seek(resumeTimeRef.current);
      }
      setRetryAttempt(0);
    }
  };

  const onPlayerError = (e: OnVideoErrorData) => {
    const err = e.error;
    const message =
      err.errorString ?? err.localizedDescription ?? err.error ?? JSON.stringify(err);
    resumeTimeRef.current = currentTime;
    resumeToLiveRef.current = isLive && atLiveEdge;
    setBuffering(false);
    setPlayerError(message);
    setControlsVisible(true);
    emitEvent({type: 'error', message});
    onError?.(message);
  };

  const onVideoTracks = (data: OnVideoTracksData) => setVideoTracks(data.videoTracks);
  const onAudioTracks = (data: OnAudioTracksData) => {
    const tracks = data.audioTracks ?? [];
    setAudioTracks(tracks);
    applyAudioPref(tracks);
  };

  /** Idioma de audio recordado → índice de este stream (los índices no se guardan). */
  const applyAudioPref = (tracks: AudioTrack[]) => {
    const wanted = prefsRef.current?.audioLanguage;
    if (prefsApplied.current.audio || !wanted || !tracks.length) {
      return;
    }
    prefsApplied.current.audio = true;
    const match = tracks.find(track => track.language === wanted);
    if (match) {
      setAudioTrack(match.index);
    }
  };

  /** Lo mismo con los subtítulos: se recuerda el idioma, o que iban apagados. */
  const applySubtitlePref = (tracks: TextTrack[]) => {
    const wanted = prefsRef.current?.subtitleLanguage;
    if (prefsApplied.current.subtitle || !wanted || !tracks.length) {
      return;
    }
    prefsApplied.current.subtitle = true;
    if (wanted === 'off') {
      return;
    }
    const match = tracks.find(track => track.language === wanted);
    if (match) {
      setSubtitle(match.index);
    }
  };
  const onTextTracks = (data: OnTextTracksData) => {
    setTextTracks(data.textTracks);
    applySubtitlePref(data.textTracks);
  };

  const onProgress = (data: OnProgressData) => {
    currentTimeRef.current = data.currentTime;
    if (!scrubbing) {
      setCurrentTime(data.currentTime);
    }
    setBuffered(data.playableDuration);
    setSeekableDuration(data.seekableDuration);
    if (data.isLive !== undefined) {
      setIsLive(data.isLive);
    }
    setLiveOffset(data.liveOffset ?? -1);
    emitEvent({type: 'progress', seconds: data.currentTime});
    // Posición para «seguir viendo»: a disco cada pocos segundos, no en cada aviso.
    const now = Date.now();
    if (
      !data.isLive &&
      data.seekableDuration > 0 &&
      now - lastSavedAt.current > SAVE_EVERY_MS
    ) {
      lastSavedAt.current = now;
      onPositionRef.current?.(data.currentTime, duration);
    }
  };

  const onBuffer = (data: OnBufferData) => {
    setBuffering(data.isBuffering);
    emitEvent({type: 'buffer', buffering: data.isBuffering});
  };

  const onEnd = () => {
    if (autoplayNext && hasNext && onNext && !nextCancelled) {
      onNext();
      return;
    }
    setEnded(true);
    setPaused(true);
    setCurrentTime(duration);
    showControls();
    emitEvent({type: 'end'});
  };

  // ⏮: en VOD reinicia si ya llevamos unos segundos; si no (o en directo), va al anterior.
  const goPrevious = () => {
    const restart = !isLive && (currentTime > PREVIOUS_RESTART_THRESHOLD_S || !hasPrevious);
    if (restart || !onPrevious) {
      seekTo(0);
      setPaused(false);
    } else if (hasPrevious) {
      onPrevious();
    }
    touch();
  };

  // Mientras se transmite, los tiempos y el estado de reproducción vienen del receptor.
  const displayTime = scrubbing
    ? scrubTime
    : casting
    ? cast.position
    : currentTime;
  const uiPaused = casting ? cast.paused : paused;
  const uiBuffering = casting ? cast.buffering : buffering;

  // Alturas únicas disponibles (1080, 720, …) de mayor a menor.
  const qualityOptions = Array.from(
    new Set(videoTracks.map(track => track.height ?? 0).filter(h => h > 0)),
  ).sort((a, b) => b - a);
  const playingHeight = videoTracks.find(track => track.selected)?.height;
  const qualityLabel = (q: 'auto' | number) =>
    q === 'auto'
      ? playingHeight
        ? t('quality.autoAt', {height: playingHeight})
        : t('quality.auto')
      : t('quality.height', {height: q});
  const speedLabel = (r: number) =>
    r === 1 ? t('speed.normal') : t('speed.rate', {rate: r});
  const saverLabel = (mode: DataSaver) =>
    mode === 'auto'
      ? t('saver.auto')
      : mode === 'on'
      ? t('saver.on')
      : t('saver.off');
  // iOS puede anunciar pistas con título vacío (AVPlayer expone la opción legible
  // aunque el stream no traiga subtítulos), así que no vale `??`: hay que caer al
  // idioma o al número también con cadena vacía.
  const trackLabel = (track: {
    title?: string;
    language?: string;
    index: number;
  }) =>
    track.title ||
    track.language ||
    t('track.fallback', {number: track.index + 1});
  const audioLabel = () => {
    if (audioTrack === 'auto') {
      const playing = audioTracks.find(track => track.selected);
      return playing ? trackLabel(playing) : t('audio.default');
    }
    const track = audioTracks.find(item => item.index === audioTrack);
    return track ? trackLabel(track) : t('audio.default');
  };
  const subtitleLabel = () => {
    if (subtitle === 'off') {
      return t('subtitles.off');
    }
    const track = textTracks.find(item => item.index === subtitle);
    return track ? trackLabel(track) : t('subtitles.off');
  };
  // El botón CC alterna entre apagado y la última pista elegida (o la primera).
  const toggleSubtitles = () => {
    setSubtitle(current =>
      current === 'off'
        ? lastSubtitle.current ?? textTracks[0]?.index ?? 'off'
        : 'off',
    );
    touch();
  };

  // En directo la barra representa la ventana DVR (seekableDuration), no una duración fija.
  // Transmitiendo, la duración la da el receptor (en directo no hay DVR remoto).
  const timelineDuration = casting
    ? cast.duration || duration
    : isLive
    ? seekableDuration
    : duration;
  const hasDvr = casting
    ? !isLive && timelineDuration > 0
    : !isLive || seekableDuration >= MIN_DVR_WINDOW_S;
  // En directo no hay saltos de ±10 s (ni botones ni doble tap).
  const canSkip = !isLive;
  // Capítulo en curso y bloque saltable (intro) bajo el cursor.
  const currentChapter = chapters?.find(
    chapter => displayTime >= chapter.start && displayTime < chapter.end,
  );
  const showSkipIntro =
    skipIntro &&
    !!currentChapter?.skippable &&
    !playerError &&
    !casting &&
    !pipActive &&
    !scrubbing;
  // Tarjeta de «a continuación»: últimos segundos de un VOD con siguiente.
  const remaining = duration > 0 ? duration - currentTime : 0;
  const showNextUp =
    nextUpCard &&
    !!nextUp &&
    !!onNext &&
    hasNext &&
    !isLive &&
    !casting &&
    !playerError &&
    !pipActive &&
    !ended &&
    !nextCancelled &&
    duration > 0 &&
    remaining > 0 &&
    remaining <= NEXT_UP_S;
  // Botones de pista anterior/siguiente cuando hay lista (también en directo: una
  // lista puede tener varios canales en vivo).
  const showTrackButtons = trackButtons && (!!onNext || !!onPrevious);
  const atLiveEdge = isLive && liveOffset >= 0 && liveOffset <= LIVE_EDGE_TOLERANCE_S;
  // Posición live del reproductor dentro de la ventana DVR.
  const livePosition = liveOffset >= 0 ? currentTime + liveOffset : seekableDuration;
  // Mientras se arrastra en directo, retraso estimado respecto a esa posición.
  const displayLiveOffset = scrubbing
    ? Math.max(0, livePosition - scrubTime)
    : liveOffset;

  // En fullscreen el vídeo va de borde a borde; los controles respetan las
  // barras del sistema (edge-to-edge en Android 15+, notch en iOS).
  const controlsInsets = {
    paddingTop: insets.top,
    paddingBottom: insets.bottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };

  // Vista previa: solo mientras se arrastra, en VOD y con storyboard. La barra
  // ocupa el ancho del reproductor menos el padding de la barra inferior.
  const previewTile = scrubbing && !isLive && !casting ? tileAt(scrubTime) : null;
  // El sprite se dibuja a su tamaño natural en píxeles (dividiendo por la densidad)
  // y se amplía con un transform: así el bitmap se decodifica una sola vez y al
  // tamaño real del fichero, en vez de al de la vista, que en pantallas densas
  // multiplicaba la memoria. El aumento lo hace la GPU al pintar.
  const density = PixelRatio.get();
  const previewNaturalWidth = previewTile ? previewTile.width / density : 0;
  const previewNaturalHeight = previewTile ? previewTile.height / density : 0;
  const previewScale = previewNaturalWidth
    ? PREVIEW_WIDTH / previewNaturalWidth
    : 1;
  const barInset = fullscreen ? insets.left + insets.right : 0;
  const barWidth = Math.max(1, layoutWidth - barInset - 2 * BOTTOM_BAR_PADDING);
  const previewLeft = Math.min(
    barWidth - PREVIEW_WIDTH / 2,
    Math.max(
      PREVIEW_WIDTH / 2,
      (timelineDuration > 0 ? scrubTime / timelineDuration : 0) * barWidth,
    ),
  );

  // Android: los subtítulos se pintan dentro del vídeo, así que hay que apartarlos
  // de la barra inferior mientras los controles están a la vista (iOS los coloca solo).
  // Memoizado: si no, cada render manda una prop nueva a la vista nativa.
  const subtitleStyle = useMemo(
    () => ({
      subtitlesFollowVideo: true,
      paddingBottom: controlsVisible && !compact ? 56 : 12,
    }),
    [controlsVisible, compact],
  );

  const containerStyle =
    (fullscreen || pipActive) && !compact
      ? [styles.container, styles.fullscreen]
      : [styles.container, style];

  return (
    <View
      ref={containerRef}
      style={containerStyle}
      onLayout={e => {
        surfaceWidth.current = e.nativeEvent.layout.width || 1;
        surfaceHeight.current = e.nativeEvent.layout.height || 1;
        setLayoutWidth(e.nativeEvent.layout.width || 0);
        // La caja se mueve (miniplayer, pantalla completa): hay que remedir.
        containerRef.current?.measureInWindow(x => {
          surfacePageX.current = x;
        });
      }}>
      <StatusBar hidden={fullscreen && !compact} />

      <Video
        key={playerKey}
        ref={videoRef}
        source={source}
        style={StyleSheet.absoluteFill}
        paused={paused}
        rate={boosting ? boostRate : rate}
        resizeMode={fill ? 'cover' : 'contain'}
        volume={volume}
        controls={false}
        // Android: sin esta prop la librería usa la política por defecto de ExoPlayer
        // (3 reintentos y error). Con ella, los fallos de red reintentan hasta que vuelva.
        disableDisconnectError
        // Controles del sistema: la librería publica una MediaSession con los
        // metadatos que lleve la fuente (título, autor, carátula).
        showNotificationControls={notificationControls && !casting}
        playInBackground={playInBackground}
        // PiP automático al salir de la app (Android 12+ / iOS 14.2+) y manual con el botón.
        enterPictureInPictureOnLeave={pipSupported}
        onPictureInPictureStatusChanged={e => setPipActive(e.isActive)}
        // AirPlay: el vídeo sale por la tele, pero lo sigue reproduciendo este <Video>,
        // así que los controles valen igual; solo cambia lo que se ve en el móvil.
        onExternalPlaybackChange={(e: OnExternalPlaybackChangeData) =>
          setAirplay({active: e.isExternalPlaybackActive, deviceName: e.deviceName})
        }
        // iOS: el usuario tocó "volver a la app" desde la ventana PiP; ya no hay nada que
        // restaurar (el reproductor sigue montado), así que confirmamos de inmediato.
        onRestoreUserInterfaceForPictureInPictureStop={() =>
          videoRef.current?.restoreUserInterfaceForPictureInPictureStopCompleted(true)
        }
        // Cada aviso de progreso re-renderiza el overlay entero. Con los controles
        // ocultos lo único que se mueve es la barra fina, así que basta 1 por segundo.
        progressUpdateInterval={controlsVisible || scrubbing ? 250 : 1000}
        onLoad={onLoad}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onVideoTracks={onVideoTracks}
        onTextTracks={onTextTracks}
        onAudioTracks={onAudioTracks}
        selectedAudioTrack={
          audioTrack === 'auto'
            ? {type: SelectedTrackType.SYSTEM}
            : {type: SelectedTrackType.INDEX, value: audioTrack}
        }
        // Tope de datos: solo manda con calidad automática; si el usuario ha fijado
        // una resolución a mano, su elección gana. 0 = sin tope.
        maxBitRate={quality === 'auto' ? networkCap.bitrate : 0}
        reportBandwidth
        onBandwidthUpdate={e => {
          setBandwidth(e.bitrate ?? 0);
          emitEvent({type: 'bitrate', bps: e.bitrate ?? 0});
        }}
        // Primer fotograma en pantalla: cierra la medición del arranque.
        onReadyForDisplay={() => emitEvent({type: 'ready', live: isLive})}
        selectedTextTrack={
          subtitle === 'off'
            ? {type: SelectedTrackType.DISABLED}
            : {type: SelectedTrackType.INDEX, value: subtitle}
        }
        // Android dibuja los subtítulos dentro de la superficie: hay que subirlos
        // cuando los controles tapan la parte de abajo (en iOS los coloca el sistema).
        subtitleStyle={subtitleStyle}
        selectedVideoTrack={
          quality === 'auto'
            ? {type: SelectedVideoTrackType.AUTO}
            : {type: SelectedVideoTrackType.RESOLUTION, value: quality}
        }
        onEnd={onEnd}
        onError={onPlayerError}
      />

      {/* Superficie táctil: tap, doble tap y pulsado largo. En miniplayer los gestos
          los maneja quien nos envuelve, así que aquí no se pinta nada más que el vídeo. */}
      {/* Velo del gesto de brillo: encima del vídeo, debajo de todo lo demás. */}
      {dim > 0 && (
        <View
          pointerEvents="none"
          style={[styles.dimVeil, {opacity: dim}]}
        />
      )}

      {!compact && (
        <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('a11y.surface')}
            style={StyleSheet.absoluteFill}
            onPress={onSurfacePress}
            // Pressable no llama a onPress si ya disparó el pulsado largo, así que el
            // x2 no choca con el tap ni con el doble tap de ±10 s.
            delayLongPress={BOOST_HOLD_MS}
            onLongPress={startBoost}
            onPressOut={endBoost}
          />
        </View>
      )}

      {/* Aviso del gesto en curso (volumen, brillo o encuadre) */}
      {hud && !compact && (
        <View pointerEvents="none" style={styles.hud}>
          <Text style={styles.hudLabel}>{hud.label}</Text>
          {hud.value !== undefined && (
            <View style={styles.hudTrack}>
              <View
                style={[
                  styles.hudFill,
                  {backgroundColor: accent, width: `${Math.round(hud.value * 100)}%`},
                ]}
              />
            </View>
          )}
        </View>
      )}

      {/* AirPlay: el vídeo se ve en la tele; aquí queda el estado (los controles siguen
          gobernando el mismo AVPlayer, por eso no hay controles remotos aparte) */}
      {airplay.active && !casting && (
        <View pointerEvents="none" style={styles.castOverlay}>
          {/* Igual que al transmitir: con los controles visibles solo queda el fondo,
              el dispositivo se lee en la fila de abajo. */}
          {!controlsVisible && (
            <>
              <AirPlayGlyph size={56} />
              <Text style={styles.castTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              <Text style={styles.castDevice} numberOfLines={1}>
                {t('airplay.playingOn', {
                  device: airplay.deviceName ?? t('airplay.name'),
                })}
              </Text>
            </>
          )}
        </View>
      )}

      {/* Transmitiendo: el vídeo se ve en el Chromecast, aquí queda el estado */}
      {casting && (
        <View pointerEvents="none" style={styles.castOverlay}>
          {/* Con los controles visibles solo queda el fondo: el icono estorbaría a los
              botones centrales y el dispositivo ya se lee bajo el título. */}
          {!controlsVisible && (
            <>
              <CastIcon size={56} connected />
              <Text style={styles.castTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              <Text style={styles.castDevice} numberOfLines={1}>
                {cast.loadError
                  ? t('cast.failed', {error: cast.loadError})
                  : t('cast.playingOn', {device: cast.deviceName})}
              </Text>
            </>
          )}
        </View>
      )}

      {!compact && (
        <>
      {/* Indicador de salto (±10 s) */}
      {skipHint && (
        <View
          pointerEvents="none"
          style={[
            styles.skipHint,
            skipHint.side === 'left' ? styles.skipHintLeft : styles.skipHintRight,
          ]}>
          <Text style={styles.skipHintArrows}>
            {skipHint.side === 'left' ? '◀◀' : '▶▶'}
          </Text>
          <Text style={styles.skipHintText}>{skipHint.seconds} s</Text>
        </View>
      )}

      {/* Saltar intro: va por libre, se vea o no el resto de controles (como Netflix) */}
      {showSkipIntro && currentChapter && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('chapter.skipIntro')}
          style={({pressed}) => [
            styles.skipIntro,
            {bottom: 56 + (fullscreen ? insets.bottom : 0)},
            pressed && styles.dimmed,
          ]}
          onPress={() => {
            seekTo(currentChapter.end);
            touch();
          }}>
          <Text style={styles.skipIntroText}>{t('chapter.skipIntro')}</Text>
        </Pressable>
      )}

      {/* A continuación: los últimos segundos, con cuenta atrás y salida */}
      {showNextUp && nextUp && (
        <View
          style={[
            styles.nextUp,
            {bottom: 56 + (fullscreen ? insets.bottom : 0)},
          ]}>
          <Text style={styles.nextUpLabel}>{t('next.upNext')}</Text>
          <Text style={styles.nextUpTitle} numberOfLines={1}>
            {nextUp.title}
          </Text>
          <Text style={styles.nextUpCountdown}>
            {t('next.inSeconds', {seconds: Math.ceil(remaining)})}
          </Text>
          <View style={styles.nextUpButtons}>
            <Pressable
              accessibilityRole="button"
              style={({pressed}) => [styles.nextUpGhost, pressed && styles.dimmed]}
              onPress={() => {
                setNextCancelled(true);
                touch();
              }}>
              <Text style={styles.nextUpGhostText}>{t('next.cancel')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({pressed}) => [
                styles.nextUpPlay,
                {backgroundColor: accent},
                pressed && styles.dimmed,
              ]}
              onPress={() => {
                onNext?.();
                touch();
              }}>
              <Text style={styles.nextUpPlayText}>{t('next.playNow')}</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Aceleración mientras se mantiene pulsado */}
      {boosting && (
        <View pointerEvents="none" style={styles.boostBadge}>
          <FastForwardIcon size={16} />
          <Text style={styles.boostText}>{`${boostRate}x`}</Text>
        </View>
      )}

      {/* Spinner de carga */}
      {uiBuffering && !scrubbing && !playerError && (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Aviso de red caída (sin error todavía: ExoPlayer/AVPlayer siguen reintentando) */}
      {!online && !playerError && (
        <View pointerEvents="none" style={styles.offlineBanner}>
          <Text style={styles.offlineText}>{t('offline.banner')}</Text>
        </View>
      )}

      {/* Error con reintento */}
      {playerError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>
            {online ? t('error.title') : t('error.offlineTitle')}
          </Text>
          <Text style={styles.errorDetail} numberOfLines={2}>
            {online ? playerError : t('error.offlineDetail')}
          </Text>
          <Pressable
            style={({pressed}) => [styles.retryButton, pressed && styles.dimmed]}
            onPress={() => setRetryNow(n => n + 1)}
            accessibilityRole="button"
            accessibilityLabel={t('a11y.retry')}>
            <Text style={styles.retryText}>
              {retryCountdown !== null
                ? t('error.retryIn', {seconds: retryCountdown})
                : t('error.retry')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Barra fina de progreso cuando los controles están ocultos */}
      {seekBar && !controlsVisible && !pipActive && hasDvr && timelineDuration > 0 && (
        <View pointerEvents="none" style={styles.miniTrack}>
          <View
            style={[
              styles.miniProgress,
              {
                backgroundColor: accent,
                width: `${Math.min(100, (currentTime / timelineDuration) * 100)}%`,
              },
            ]}
          />
        </View>
      )}

      {controlsVisible && !pipActive && (
        <View
          style={[StyleSheet.absoluteFill, fullscreen && controlsInsets]}
          pointerEvents="box-none">
          {/* El overlay de error ya oscurece el fondo. */}
          {!playerError && <View pointerEvents="none" style={styles.dim} />}

          {/* Barra superior */}
          <View
            style={[styles.topBar, previewTile && styles.hidden]}
            pointerEvents={previewTile ? 'none' : 'box-none'}>
            {/* ⌄ minimizar: solo cuando hay miniplayer y no estamos en pantalla completa. */}
            {onMinimize && !fullscreen && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('a11y.minimize')}
                hitSlop={12}
                style={styles.iconButton}
                onPress={() => {
                  onMinimize();
                  touch();
                }}>
                <ChevronIcon direction="down" />
              </Pressable>
            )}
            <Text style={styles.title} numberOfLines={1}>
              {title ?? ''}
            </Text>
            <View style={styles.topRight} pointerEvents="box-none">
              {routeButtons && (
                <>
                  {/* AirPlay (iOS): abre el selector de rutas del sistema. */}
                  <AirPlayButton
                    style={styles.routeButton}
                    iconColor="#fff"
                    activeIconColor={accent}
                  />
                  {/* Chromecast: el botón nativo se oculta solo si no hay dispositivos. */}
                  <CastButton style={styles.routeButton} tintColor="#fff" />
                </>
              )}
              {/* CC: atajo para encender/apagar; la pista se elige en ⚙. */}
              {subtitlesButton && !playerError && !casting && textTracks.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    subtitle === 'off' ? t('a11y.subtitlesOff') : t('a11y.subtitlesOn')
                  }
                  accessibilityState={{selected: subtitle !== 'off'}}
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={toggleSubtitles}>
                  <SubtitlesIcon active={subtitle !== 'off'} activeColor={accent} />
                </Pressable>
              )}
              {pipButton && pipSupported && !playerError && !casting && !airplay.active && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    videoRef.current?.enterPictureInPicture();
                    touch();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.pip')}>
                  <PipIcon />
                </Pressable>
              )}
              {settingsButton && !playerError && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    setMenu('main');
                    touch();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.settings')}>
                  <SettingsIcon />
                </Pressable>
              )}
            </View>
          </View>

          {/* Controles centrales. La fila siempre se renderiza (flex: 1 empuja la
              barra inferior al fondo); solo el botón de play se oculta mientras
              hace buffering, porque el spinner ocupa su sitio. */}
          <View
            style={[styles.centerRow, previewTile && styles.hidden]}
            pointerEvents={previewTile ? 'none' : 'box-none'}>
            {!playerError && !showNextUp && (
              <>
              {showTrackButtons && (
                <Pressable
                  hitSlop={12}
                  style={[
                    styles.iconButton,
                    !hasPrevious &&
                      (isLive || currentTime <= PREVIOUS_RESTART_THRESHOLD_S) &&
                      styles.dimmed,
                  ]}
                  disabled={isLive && !hasPrevious}
                  onPress={goPrevious}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.previous')}>
                  <TrackIcon direction="previous" />
                </Pressable>
              )}
              {skipButtons && (
                <Pressable
                  hitSlop={12}
                  style={[styles.iconButton, !canSkip && styles.hidden]}
                  disabled={!canSkip}
                  onPress={() => skip('left', false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.back', {seconds: SKIP_SECONDS})}>
                  <SkipIcon direction="back" seconds={SKIP_SECONDS} />
                </Pressable>
              )}
              <Pressable
                hitSlop={12}
                style={[styles.playButton, uiBuffering && styles.hidden]}
                disabled={uiBuffering}
                onPress={togglePlay}
                accessibilityRole="button"
                accessibilityLabel={
                  ended && !casting
                    ? t('a11y.replay')
                    : uiPaused
                    ? t('a11y.play')
                    : t('a11y.pause')
                }>
                {ended && !casting ? (
                  <ReplayIcon size={40} />
                ) : uiPaused ? (
                  <PlayIcon size={34} />
                ) : (
                  <PauseIcon size={34} />
                )}
              </Pressable>
              {skipButtons && (
                <Pressable
                  hitSlop={12}
                  style={[styles.iconButton, !canSkip && styles.hidden]}
                  disabled={!canSkip}
                  onPress={() => skip('right', false)}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.forward', {seconds: SKIP_SECONDS})}>
                  <SkipIcon direction="forward" seconds={SKIP_SECONDS} />
                </Pressable>
              )}
              {showTrackButtons && (
                <Pressable
                  hitSlop={12}
                  style={[styles.iconButton, !hasNext && styles.dimmed]}
                  disabled={!hasNext}
                  onPress={() => {
                    onNext?.();
                    touch();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.next')}>
                  <TrackIcon direction="next" />
                </Pressable>
              )}
              {casting && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    cast.stop();
                    touch();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('a11y.stopCast')}>
                  <StopIcon size={22} />
                </Pressable>
              )}
              </>
            )}
          </View>

          {/* Barra inferior */}
          <View style={styles.bottomBar} pointerEvents="box-none">
            <View style={styles.bottomRow} pointerEvents="box-none">
              {/* Con error no hay tiempo ni badge, pero el hueco se mantiene para
                  que ⤢ siga a la derecha. */}
              {playerError ? (
                <View />
              ) : isLive ? (
                <View style={styles.liveRow} pointerEvents="box-none">
                  {/* Rojo en directo; gris cuando vas atrasado (tap = volver al directo) */}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      atLiveEdge ? t('a11y.atLive') : t('a11y.goLive')
                    }
                    accessibilityState={{disabled: atLiveEdge}}
                    hitSlop={8}
                    disabled={atLiveEdge}
                    onPress={goToLive}
                    style={[styles.liveBadge, atLiveEdge && {backgroundColor: accent}]}>
                    <View style={[styles.liveDot, atLiveEdge && styles.liveDotActive]} />
                    <Text style={styles.liveText}>{t('live.badge')}</Text>
                  </Pressable>
                  {!atLiveEdge && displayLiveOffset >= 0 && (
                    <Text style={styles.time}>-{formatTime(displayLiveOffset)}</Text>
                  )}
                </View>
              ) : (
                <Text
                  style={styles.time}
                  accessibilityLabel={t('a11y.position', {
                    position: formatTime(displayTime),
                    duration: formatTime(duration),
                  })}>
                  {formatTime(displayTime)}
                  <Text style={styles.timeDim}> / {formatTime(duration)}</Text>
                  {currentChapter ? (
                    <Text style={styles.timeDim} numberOfLines={1}>
                      {'  ·  '}
                      {currentChapter.title}
                    </Text>
                  ) : null}
                </Text>
              )}
              {fullscreenButton && !casting && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    setFullscreen(f => !f);
                    touch();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={
                    fullscreen ? t('a11y.fullscreenExit') : t('a11y.fullscreenEnter')
                  }>
                  <FullscreenIcon exit={fullscreen} />
                </Pressable>
              )}
            </View>
            {previewTile && (
              <View
                pointerEvents="none"
                style={[styles.preview, {left: previewLeft - PREVIEW_WIDTH / 2}]}>
                <View
                  style={[
                    styles.previewFrame,
                    {height: Math.round(previewNaturalHeight * previewScale)},
                  ]}>
                  <View
                    style={[
                      styles.previewCrop,
                      {
                        width: previewNaturalWidth,
                        height: previewNaturalHeight,
                        transform: [{scale: previewScale}],
                      },
                    ]}>
                    <Image
                      source={previewTile.image}
                      style={{
                        width: previewTile.sheetWidth / density,
                        height: previewTile.sheetHeight / density,
                        marginLeft: -previewTile.x / density,
                        marginTop: -previewTile.y / density,
                      }}
                    />
                  </View>
                </View>
                <Text style={styles.previewTime}>{formatTime(scrubTime)}</Text>
              </View>
            )}

            {seekBar && hasDvr && !playerError ? (
              <SeekBar
                accent={accent}
                chapters={chapters}
                currentTime={displayTime}
                duration={timelineDuration}
                buffered={isLive ? timelineDuration : buffered}
                scrubbing={scrubbing}
                onScrubStart={time => {
                  setScrubbing(true);
                  setScrubTime(time);
                }}
                onScrub={setScrubTime}
                onScrubEnd={time => {
                  setScrubbing(false);
                  // Soltar cerca de la posición live = volver al directo.
                  if (isLive && livePosition - time <= LIVE_EDGE_TOLERANCE_S) {
                    goToLive();
                  } else {
                    seekTo(time);
                    touch();
                  }
                }}
              />
            ) : (
              <View style={styles.seekBarSpacer} />
            )}

            {/* Como en Netflix: el dispositivo abajo; al tocarlo se abre el
                controlador ampliado del SDK (volumen, audio/subtítulos del receptor). */}
            {airplay.active && !casting && (
              <View style={styles.castDeviceRow} pointerEvents="none">
                <AirPlayGlyph size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.castDeviceRowText} numberOfLines={1}>
                  {airplay.deviceName ?? t('airplay.name')}
                </Text>
              </View>
            )}

            {casting && (
              <Pressable
                style={({pressed}) => [styles.castDeviceRow, pressed && styles.dimmed]}
                onPress={() => {
                  cast.showRemoteControls();
                  touch();
                }}
                accessibilityRole="button"
                accessibilityLabel={t('a11y.castControls')}>
                <CastIcon size={18} color="rgba(255,255,255,0.8)" connected />
                <Text style={styles.castDeviceRowText} numberOfLines={1}>
                  {cast.loadError
                    ? t('cast.failed', {error: cast.loadError})
                    : cast.deviceName}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* Menú ⚙ (Modal para no quedar recortado por el reproductor) */}
      <Modal
        visible={menu !== null}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setMenu(null)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenu(null)} />
        {/* statusBarTranslucent hace el Modal edge-to-edge: respetar la barra de navegación */}
        <View style={[styles.menu, {paddingBottom: 16 + insets.bottom}]}>
          {menu === 'main' && (
            <>
              <MenuRow
                label={t('menu.quality')}
                value={
                  casting
                    ? t('value.castChooses')
                    : qualityOptions.length
                    ? qualityLabel(quality)
                    : t('value.unavailable')
                }
                disabled={casting || !qualityOptions.length}
                onPress={() => setMenu('quality')}
              />
              <MenuRow
                label={t('menu.saver')}
                value={
                  casting
                    ? t('value.unavailableCasting')
                    : quality !== 'auto'
                    ? `${saverLabel(dataSaver)} · ${t('saver.noEffect')}`
                    : `${saverLabel(dataSaver)} · ${networkCap.network}: ${
                        networkCap.limit
                      }`
                }
                disabled={casting}
                onPress={() => setMenu('saver')}
              />
              <MenuRow
                label={t('menu.subtitles')}
                value={
                  casting
                    ? t('value.unavailableCasting')
                    : textTracks.length
                    ? subtitleLabel()
                    : t('value.unavailable')
                }
                disabled={casting || !textTracks.length}
                onPress={() => setMenu('subtitles')}
              />
              <MenuRow
                label={t('menu.audio')}
                value={
                  casting
                    ? t('value.unavailableCasting')
                    : audioTracks.length > 1
                    ? audioLabel()
                    : t('value.unavailable')
                }
                disabled={casting || audioTracks.length < 2}
                onPress={() => setMenu('audio')}
              />
              <MenuRow
                label={t('menu.speed')}
                value={
                  casting
                    ? t('value.unavailableCasting')
                    : isLive
                    ? t('value.unavailableLive')
                    : speedLabel(rate)
                }
                disabled={casting || isLive}
                onPress={() => setMenu('speed')}
              />
            </>
          )}

          {menu === 'quality' && (
            <>
              <MenuHeader title={t('menu.quality')} onBack={() => setMenu('main')} />
              <Text style={styles.menuNote}>
                {networkCap.network}: {networkCap.limit}
                {bandwidth > 0 ? t('saver.bandwidth', {rate: mbps(bandwidth)}) : ''}
              </Text>
              {(['auto', ...qualityOptions] as Array<'auto' | number>).map(q => (
                <MenuOption
                  accent={accent}
                  key={q}
                  label={qualityLabel(q)}
                  selected={q === quality}
                  onPress={() => {
                    setQuality(q);
                    updatePrefs({quality: q});
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}

          {menu === 'saver' && (
            <>
              <MenuHeader title={t('menu.saver')} onBack={() => setMenu('main')} />
              <Text style={styles.menuNote}>{t('menu.saverHint')}</Text>
              {(['auto', 'on', 'off'] as DataSaver[]).map(mode => (
                <MenuOption
                  accent={accent}
                  key={mode}
                  label={saverLabel(mode)}
                  selected={mode === dataSaver}
                  onPress={() => {
                    onDataSaverChange?.(mode);
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}

          {menu === 'subtitles' && (
            <>
              <MenuHeader title={t('menu.subtitles')} onBack={() => setMenu('main')} />
              <MenuOption
                accent={accent}
                label={t('subtitles.off')}
                selected={subtitle === 'off'}
                onPress={() => {
                  setSubtitle('off');
                  updatePrefs({subtitleLanguage: 'off'});
                  setMenu(null);
                  touch();
                }}
              />
              {textTracks.map(track => (
                <MenuOption
                  accent={accent}
                  key={track.index}
                  label={trackLabel(track)}
                  selected={track.index === subtitle}
                  onPress={() => {
                    setSubtitle(track.index);
                    updatePrefs({subtitleLanguage: track.language ?? 'off'});
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}

          {menu === 'audio' && (
            <>
              <MenuHeader title={t('menu.audio')} onBack={() => setMenu('main')} />
              <MenuOption
                accent={accent}
                label={t('audio.default')}
                selected={audioTrack === 'auto'}
                onPress={() => {
                  setAudioTrack('auto');
                  updatePrefs({audioLanguage: undefined});
                  setMenu(null);
                  touch();
                }}
              />
              {audioTracks.map(track => (
                <MenuOption
                  accent={accent}
                  key={track.index}
                  label={trackLabel(track)}
                  selected={track.index === audioTrack}
                  onPress={() => {
                    setAudioTrack(track.index);
                    updatePrefs({audioLanguage: track.language});
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}

          {menu === 'speed' && (
            <>
              <MenuHeader
                title={t('menu.speed')}
                onBack={() => setMenu('main')}
              />
              {SPEEDS.map(r => (
                <MenuOption
                  accent={accent}
                  key={r}
                  label={speedLabel(r)}
                  selected={r === rate}
                  onPress={() => {
                    setRate(r);
                    updatePrefs({speed: r});
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}
        </View>
      </Modal>
        </>
      )}
    </View>
  );
}

function MenuRow({
  label,
  value,
  disabled,
  onPress,
}: {
  label: string;
  value: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      style={[styles.menuItem, disabled && styles.dimmed]}
      onPress={onPress}>
      <Text style={styles.menuItemText} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.menuItemValue} numberOfLines={1}>
        {value} ›
      </Text>
    </Pressable>
  );
}

function MenuHeader({title, onBack}: {title: string; onBack: () => void}) {
  return (
    <Pressable style={styles.menuHeader} onPress={onBack} hitSlop={8}>
      <Text style={styles.menuBack}>‹</Text>
      <Text style={styles.menuTitle}>{title}</Text>
    </Pressable>
  );
}

function MenuOption({
  label,
  selected,
  accent,
  onPress,
}: {
  label: string;
  selected: boolean;
  accent: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text
        style={[
          styles.menuItemText,
          selected && styles.menuItemActive,
          selected && {color: accent},
        ]}>
        {label}
      </Text>
      {selected && <Text style={[styles.menuCheck, {color: accent}]}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  fullscreen: {
    // Ocupa el contenedor raíz (área útil, sin barra de navegación).
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
  dim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginHorizontal: 8,
  },
  castDeviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 4,
  },
  castDeviceRowText: {color: 'rgba(255,255,255,0.8)', fontSize: 12},
  centerRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    // Con 6 botones (transmitiendo) el hueco fijo no cabe en pantallas estrechas.
    gap: 20,
  },
  iconButton: {
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
  },
  dimmed: {
    opacity: 0.4,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  liveDotActive: {
    backgroundColor: '#fff',
  },
  liveText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  seekBarSpacer: {
    height: 12,
  },
  offlineBanner: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  offlineText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  boostBadge: {
    position: 'absolute',
    top: 8,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  boostText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  dimVeil: {...StyleSheet.absoluteFill, backgroundColor: '#000'},
  hud: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    minWidth: 140,
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  hudLabel: {color: '#fff', fontSize: 13, fontWeight: '700'},
  hudTrack: {
    width: 120,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden',
  },
  hudFill: {height: '100%'},
  skipIntro: {
    position: 'absolute',
    right: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  skipIntroText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  nextUp: {
    position: 'absolute',
    right: 12,
    maxWidth: 300,
    backgroundColor: 'rgba(0,0,0,0.82)',
    borderRadius: 10,
    padding: 12,
    gap: 2,
  },
  nextUpLabel: {
    color: '#aaa',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  nextUpTitle: {color: '#fff', fontSize: 14, fontWeight: '700'},
  nextUpCountdown: {color: '#aaa', fontSize: 12, marginBottom: 6},
  nextUpButtons: {flexDirection: 'row', gap: 8, justifyContent: 'flex-end'},
  nextUpGhost: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  nextUpGhostText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  nextUpPlay: {paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16},
  nextUpPlayText: {color: '#fff', fontSize: 12, fontWeight: '700'},
  errorOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'center'},
  errorDetail: {color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center'},
  retryButton: {
    marginTop: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryText: {color: '#000', fontWeight: '700'},
  bottomBar: {
    paddingHorizontal: BOTTOM_BAR_PADDING,
  },
  preview: {
    position: 'absolute',
    bottom: 44,
    alignItems: 'center',
    gap: 4,
  },
  previewFrame: {
    width: PREVIEW_WIDTH,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  previewCrop: {transformOrigin: 'top left', overflow: 'hidden'},
  previewTime: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowRadius: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Los botones de AirPlay y de cast son vistas nativas: necesitan tamaño explícito.
  routeButton: {width: 26, height: 26},
  castOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  castTitle: {color: '#fff', fontSize: 15, fontWeight: '600', textAlign: 'center'},
  castDevice: {color: 'rgba(255,255,255,0.7)', fontSize: 12, textAlign: 'center'},
  time: {
    color: '#fff',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  timeDim: {
    color: 'rgba(255,255,255,0.7)',
  },
  miniTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  miniProgress: {
    height: '100%',
    backgroundColor: '#ff0000',
  },
  skipHint: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '35%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skipHintLeft: {
    left: 0,
    borderTopRightRadius: 200,
    borderBottomRightRadius: 200,
  },
  skipHintRight: {
    right: 0,
    borderTopLeftRadius: 200,
    borderBottomLeftRadius: 200,
  },
  skipHintArrows: {color: '#fff', fontSize: 22},
  skipHintText: {color: '#fff', fontSize: 13, marginTop: 4},
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  menu: {
    backgroundColor: '#212121',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingVertical: 8,
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 12,
  },
  menuBack: {color: '#fff', fontSize: 26, lineHeight: 28},
  menuTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  menuItemValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    flexShrink: 1,
    marginLeft: 12,
    textAlign: 'right',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuNote: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  menuItemText: {color: '#fff', fontSize: 15},
  menuItemActive: {fontWeight: '700'},
  menuCheck: {color: '#fff', fontSize: 16},
});
