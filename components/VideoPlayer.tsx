import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Modal,
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
  SelectedVideoTrackType,
  type OnBufferData,
  type OnExternalPlaybackChangeData,
  type OnLoadData,
  type OnProgressData,
  type OnVideoErrorData,
  type OnVideoTracksData,
  type ReactVideoSource,
  type VideoRef,
  type VideoTrack,
} from 'react-native-video';
import SeekBar from './SeekBar';
import useCast from './useCast';
import {
  AirPlayGlyph,
  CastIcon,
  FullscreenIcon,
  StopIcon,
  PipIcon,
  PauseIcon,
  PlayIcon,
  ReplayIcon,
  SettingsIcon,
  SkipIcon,
  TrackIcon,
} from './icons';

const SKIP_SECONDS = 10;
const DOUBLE_TAP_MS = 300;
// Tras un doble tap, taps sencillos dentro de esta ventana siguen saltando.
const SKIP_CHAIN_MS = 800;
const AUTO_HIDE_MS = 3000;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
// Por debajo de este retraso (respecto a la posición live del reproductor) se
// considera que estás "en directo".
const LIVE_EDGE_TOLERANCE_S = 5;
// Directos con ventana DVR menor que esto no muestran barra ni saltos.
const MIN_DVR_WINDOW_S = 30;
// Reintentos automáticos tras un error: 2 s, 4 s, 8 s, 16 s, 30 s (tope) y luego se detiene.
const RETRY_DELAYS_MS = [2000, 4000, 8000, 16000, 30000];

type Side = 'left' | 'right';

type Props = {
  source: ReactVideoSource;
  title?: string;
  style?: StyleProp<ViewStyle>;
  onError?: (message: string) => void;
  /** Se llama al entrar/salir de pantalla completa (útil para ocultar el resto de la UI). */
  onFullscreenChange?: (fullscreen: boolean) => void;
  /** Se llama al entrar/salir de Picture in Picture. */
  onPipChange?: (active: boolean) => void;
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
};

// ⏮ con más de este tiempo reproducido vuelve al inicio en vez de al anterior (como YouTube).
const PREVIOUS_RESTART_THRESHOLD_S = 3;

export function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString();
  return `${h > 0 ? `${h}:` : ''}${mm}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlayer({
  source,
  title,
  style,
  onError,
  onFullscreenChange,
  onPipChange,
  onNext,
  onPrevious,
  hasNext = false,
  hasPrevious = false,
  autoplayNext = true,
  compact = false,
  paused: pausedProp,
  onPausedChange,
}: Props) {
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
  // Directo: isLive viene de onLoad/onProgress (campo añadido a la librería);
  // liveOffset son los segundos por detrás del borde del directo (-1 = desconocido).
  const [isLive, setIsLive] = useState(false);
  const [liveOffset, setLiveOffset] = useState(-1);
  const [seekableDuration, setSeekableDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  // Picture in Picture. En Android la ventana PiP muestra la Activity entera escalada,
  // así que mientras está activo ocultamos los controles y el vídeo ocupa todo.
  const [pipActive, setPipActive] = useState(false);
  // AirPlay (iOS): AVPlayer enruta el vídeo él mismo; aquí solo sabemos que está activo
  // y a qué dispositivo va, para avisarlo en pantalla.
  const [airplay, setAirplay] = useState<{active: boolean; deviceName?: string | null}>({
    active: false,
  });
  const [controlsVisible, setControlsVisible] = useState(true);
  // Menú ⚙: principal → Calidad / Velocidad.
  const [menu, setMenu] = useState<'main' | 'quality' | 'speed' | null>(null);
  // Calidad: 'auto' (ABR) o el alto en px de la variante elegida. Solo Android.
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [quality, setQuality] = useState<'auto' | number>('auto');
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
    if (!controlsVisible || paused || scrubbing || menu || buffering) {
      return;
    }
    const t = setTimeout(() => setControlsVisible(false), AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [controlsVisible, paused, scrubbing, menu, buffering, interaction]);

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

  // Chromecast: al conectar un dispositivo, el vídeo pasa al receptor y la
  // reproducción local se pausa; al desconectar, se reanuda donde iba el receptor.
  const sourceUri =
    typeof source === 'object' && source !== null && 'uri' in source
      ? (source as {uri?: string}).uri
      : undefined;
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
      if (ended && clamped < duration) {
        setEnded(false);
      }
    },
    [cast, casting, duration, ended, isLive, seekableDuration],
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
    if (!canSkip) {
      // Directo: sin doble tap, el tap actúa al instante.
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

  const onLoad = (data: OnLoadData) => {
    setDuration(data.duration);
    setIsLive(!!data.isLive);
    setBuffering(false);
    if (data.videoTracks?.length) {
      setVideoTracks(data.videoTracks);
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
    setControlsVisible(false);
    onError?.(message);
  };

  const onVideoTracks = (data: OnVideoTracksData) => setVideoTracks(data.videoTracks);

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
  };

  const onBuffer = (data: OnBufferData) => setBuffering(data.isBuffering);

  const onEnd = () => {
    if (autoplayNext && hasNext && onNext) {
      onNext();
      return;
    }
    setEnded(true);
    setPaused(true);
    setCurrentTime(duration);
    showControls();
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
    new Set(videoTracks.map(t => t.height ?? 0).filter(h => h > 0)),
  ).sort((a, b) => b - a);
  const playingHeight = videoTracks.find(t => t.selected)?.height;
  const qualityLabel = (q: 'auto' | number) =>
    q === 'auto'
      ? `Auto${playingHeight ? ` (${playingHeight}p)` : ''}`
      : `${q}p`;
  const speedLabel = (r: number) => (r === 1 ? 'Normal' : `${r}x`);

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
  // Botones de pista anterior/siguiente cuando hay lista (también en directo: una
  // lista puede tener varios canales en vivo).
  const showTrackButtons = !!onNext || !!onPrevious;
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

  const containerStyle =
    (fullscreen || pipActive) && !compact
      ? [styles.container, styles.fullscreen]
      : [styles.container, style];

  return (
    <View
      style={containerStyle}
      onLayout={e => {
        surfaceWidth.current = e.nativeEvent.layout.width || 1;
      }}>
      <StatusBar hidden={fullscreen && !compact} />

      <Video
        key={playerKey}
        ref={videoRef}
        source={source}
        style={StyleSheet.absoluteFill}
        paused={paused}
        rate={rate}
        resizeMode="contain"
        controls={false}
        // Android: sin esta prop la librería usa la política por defecto de ExoPlayer
        // (3 reintentos y error). Con ella, los fallos de red reintentan hasta que vuelva.
        disableDisconnectError
        // PiP automático al salir de la app (Android 12+ / iOS 14.2+) y manual con el botón.
        enterPictureInPictureOnLeave
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
        progressUpdateInterval={250}
        onLoad={onLoad}
        onProgress={onProgress}
        onBuffer={onBuffer}
        onVideoTracks={onVideoTracks}
        selectedVideoTrack={
          quality === 'auto'
            ? {type: SelectedVideoTrackType.AUTO}
            : {type: SelectedVideoTrackType.RESOLUTION, value: quality}
        }
        onEnd={onEnd}
        onError={onPlayerError}
      />

      {/* Superficie táctil: tap / doble tap. En miniplayer los gestos los maneja quien
          nos envuelve, así que aquí no se pinta nada más que el vídeo. */}
      {!compact && (
        <Pressable style={StyleSheet.absoluteFill} onPress={onSurfacePress} />
      )}

      {/* AirPlay: el vídeo se ve en la tele; aquí queda el estado (los controles siguen
          gobernando el mismo AVPlayer, por eso no hay controles remotos aparte) */}
      {airplay.active && !casting && (
        <View pointerEvents="none" style={styles.castOverlay}>
          {/* Igual que al transmitir: con los controles visibles solo queda el fondo,
              el dispositivo se lee en la fila de abajo. */}
          {!controlsVisible && (
            <>
              <AirPlayGlyph />
              <Text style={styles.castTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              <Text style={styles.castDevice} numberOfLines={1}>
                {`Reproduciendo en ${airplay.deviceName ?? 'AirPlay'}`}
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
              <CastIcon size={56} />
              <Text style={styles.castTitle} numberOfLines={1}>
                {title ?? ''}
              </Text>
              <Text style={styles.castDevice} numberOfLines={1}>
                {cast.loadError
                  ? `No se pudo transmitir: ${cast.loadError}`
                  : `Transmitiendo a ${cast.deviceName}`}
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

      {/* Spinner de carga */}
      {uiBuffering && !scrubbing && !playerError && (
        <View pointerEvents="none" style={styles.center}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Aviso de red caída (sin error todavía: ExoPlayer/AVPlayer siguen reintentando) */}
      {!online && !playerError && (
        <View pointerEvents="none" style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Sin conexión · reconectando…</Text>
        </View>
      )}

      {/* Error con reintento */}
      {playerError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorTitle}>
            {online ? 'No se pudo reproducir el vídeo' : 'Sin conexión a internet'}
          </Text>
          <Text style={styles.errorDetail} numberOfLines={2}>
            {online ? playerError : 'Se reintentará automáticamente al recuperar la red'}
          </Text>
          <Pressable
            style={({pressed}) => [styles.retryButton, pressed && styles.dimmed]}
            onPress={() => setRetryNow(n => n + 1)}>
            <Text style={styles.retryText}>
              {retryCountdown !== null ? `Reintentar (${retryCountdown} s)` : 'Reintentar'}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Barra fina de progreso cuando los controles están ocultos */}
      {!controlsVisible && !pipActive && hasDvr && timelineDuration > 0 && (
        <View pointerEvents="none" style={styles.miniTrack}>
          <View
            style={[
              styles.miniProgress,
              {width: `${Math.min(100, (currentTime / timelineDuration) * 100)}%`},
            ]}
          />
        </View>
      )}

      {controlsVisible && !playerError && !pipActive && (
        <View
          style={[StyleSheet.absoluteFill, fullscreen && controlsInsets]}
          pointerEvents="box-none">
          <View pointerEvents="none" style={styles.dim} />

          {/* Barra superior */}
          <View style={styles.topBar} pointerEvents="box-none">
            <Text style={styles.title} numberOfLines={1}>
              {title ?? ''}
            </Text>
            <View style={styles.topRight} pointerEvents="box-none">
              {/* AirPlay (iOS): abre el selector de rutas del sistema. */}
              <AirPlayButton
                style={styles.routeButton}
                iconColor="#fff"
                activeIconColor="#3ea6ff"
              />
              {/* Chromecast: el botón nativo se oculta solo si no hay dispositivos. */}
              <CastButton style={styles.routeButton} tintColor="#fff" />
              {!casting && !airplay.active && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    videoRef.current?.enterPictureInPicture();
                    touch();
                  }}>
                  <PipIcon />
                </Pressable>
              )}
              <Pressable
                hitSlop={12}
                style={styles.iconButton}
                onPress={() => {
                  setMenu('main');
                  touch();
                }}>
                <SettingsIcon />
              </Pressable>
            </View>
          </View>

          {/* Controles centrales. La fila siempre se renderiza (flex: 1 empuja la
              barra inferior al fondo); solo el botón de play se oculta mientras
              hace buffering, porque el spinner ocupa su sitio. */}
          <View style={styles.centerRow} pointerEvents="box-none">
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
                onPress={goPrevious}>
                <TrackIcon direction="previous" />
              </Pressable>
            )}
            <Pressable
              hitSlop={12}
              style={[styles.iconButton, !canSkip && styles.hidden]}
              disabled={!canSkip}
              onPress={() => skip('left', false)}>
              <SkipIcon direction="back" seconds={SKIP_SECONDS} />
            </Pressable>
            <Pressable
              hitSlop={12}
              style={[styles.playButton, uiBuffering && styles.hidden]}
              disabled={uiBuffering}
              onPress={togglePlay}>
              {ended && !casting ? (
                <ReplayIcon size={40} />
              ) : uiPaused ? (
                <PlayIcon size={34} />
              ) : (
                <PauseIcon size={34} />
              )}
            </Pressable>
            <Pressable
              hitSlop={12}
              style={[styles.iconButton, !canSkip && styles.hidden]}
              disabled={!canSkip}
              onPress={() => skip('right', false)}>
              <SkipIcon direction="forward" seconds={SKIP_SECONDS} />
            </Pressable>
            {showTrackButtons && (
              <Pressable
                hitSlop={12}
                style={[styles.iconButton, !hasNext && styles.dimmed]}
                disabled={!hasNext}
                onPress={() => {
                  onNext?.();
                  touch();
                }}>
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
                }}>
                <StopIcon size={22} />
              </Pressable>
            )}
          </View>

          {/* Barra inferior */}
          <View style={styles.bottomBar} pointerEvents="box-none">
            <View style={styles.bottomRow} pointerEvents="box-none">
              {isLive ? (
                <View style={styles.liveRow} pointerEvents="box-none">
                  {/* Rojo en directo; gris cuando vas atrasado (tap = volver al directo) */}
                  <Pressable
                    hitSlop={8}
                    disabled={atLiveEdge}
                    onPress={goToLive}
                    style={[styles.liveBadge, atLiveEdge && styles.liveBadgeActive]}>
                    <View style={[styles.liveDot, atLiveEdge && styles.liveDotActive]} />
                    <Text style={styles.liveText}>EN VIVO</Text>
                  </Pressable>
                  {!atLiveEdge && displayLiveOffset >= 0 && (
                    <Text style={styles.time}>-{formatTime(displayLiveOffset)}</Text>
                  )}
                </View>
              ) : (
                <Text style={styles.time}>
                  {formatTime(displayTime)}
                  <Text style={styles.timeDim}> / {formatTime(duration)}</Text>
                </Text>
              )}
              {!casting && (
                <Pressable
                  hitSlop={12}
                  style={styles.iconButton}
                  onPress={() => {
                    setFullscreen(f => !f);
                    touch();
                  }}>
                  <FullscreenIcon exit={fullscreen} />
                </Pressable>
              )}
            </View>
            {hasDvr ? (
              <SeekBar
                currentTime={displayTime}
                duration={timelineDuration}
                buffered={isLive ? timelineDuration : buffered}
                scrubbing={scrubbing}
                onScrubStart={t => {
                  setScrubbing(true);
                  setScrubTime(t);
                }}
                onScrub={setScrubTime}
                onScrubEnd={t => {
                  setScrubbing(false);
                  // Soltar cerca de la posición live = volver al directo.
                  if (isLive && livePosition - t <= LIVE_EDGE_TOLERANCE_S) {
                    goToLive();
                  } else {
                    seekTo(t);
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
                <AirPlayGlyph size={16} />
                <Text style={styles.castDeviceRowText} numberOfLines={1}>
                  {airplay.deviceName ?? 'AirPlay'}
                </Text>
              </View>
            )}

            {casting && (
              <Pressable
                style={({pressed}) => [styles.castDeviceRow, pressed && styles.dimmed]}
                onPress={() => {
                  cast.showRemoteControls();
                  touch();
                }}>
                <CastIcon size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.castDeviceRowText} numberOfLines={1}>
                  {cast.loadError
                    ? `No se pudo transmitir: ${cast.loadError}`
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
                label="Calidad"
                value={
                  casting
                    ? 'La elige el Chromecast'
                    : qualityOptions.length
                    ? qualityLabel(quality)
                    : 'No disponible'
                }
                disabled={casting || !qualityOptions.length}
                onPress={() => setMenu('quality')}
              />
              <MenuRow
                label="Velocidad de reproducción"
                value={
                  casting
                    ? 'No disponible al transmitir'
                    : isLive
                    ? 'No disponible en directo'
                    : speedLabel(rate)
                }
                disabled={casting || isLive}
                onPress={() => setMenu('speed')}
              />
            </>
          )}

          {menu === 'quality' && (
            <>
              <MenuHeader title="Calidad" onBack={() => setMenu('main')} />
              {(['auto', ...qualityOptions] as Array<'auto' | number>).map(q => (
                <MenuOption
                  key={q}
                  label={qualityLabel(q)}
                  selected={q === quality}
                  onPress={() => {
                    setQuality(q);
                    setMenu(null);
                    touch();
                  }}
                />
              ))}
            </>
          )}

          {menu === 'speed' && (
            <>
              <MenuHeader title="Velocidad de reproducción" onBack={() => setMenu('main')} />
              {SPEEDS.map(r => (
                <MenuOption
                  key={r}
                  label={speedLabel(r)}
                  selected={r === rate}
                  onPress={() => {
                    setRate(r);
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
      <Text style={styles.menuItemText}>{label}</Text>
      <Text style={styles.menuItemValue}>{value} ›</Text>
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
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, selected && styles.menuItemActive]}>{label}</Text>
      {selected && <Text style={styles.menuCheck}>✓</Text>}
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
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 100,
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
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
    marginRight: 12,
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
  liveBadgeActive: {
    backgroundColor: '#cc0000',
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
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    paddingHorizontal: 12,
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
    ...StyleSheet.absoluteFillObject,
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
  menuItemValue: {color: 'rgba(255,255,255,0.6)', fontSize: 14},
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItemText: {color: '#fff', fontSize: 15},
  menuItemActive: {fontWeight: '700'},
  menuCheck: {color: '#fff', fontSize: 16},
});
