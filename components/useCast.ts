import {useCallback, useEffect, useRef, useState} from 'react';
import GoogleCast, {
  MediaPlayerState,
  MediaStreamType,
  useCastDevice,
  useCastSession,
  useMediaStatus,
  useRemoteMediaClient,
  useStreamPosition,
  type MediaInfo,
} from 'react-native-google-cast';

type CastMedia = {
  /** URL del vídeo a enviar al receptor. */
  url?: string;
  title?: string;
  isLive: boolean;
  /** Duración en segundos (0 o undefined en directo). */
  duration?: number;
};

type Options = {
  media: CastMedia;
  /** Posición local actual, para arrancar el Chromecast donde lo dejamos. */
  getLocalTime: () => number;
  /** Se llama al conectar: la app debe pausar la reproducción local. */
  onCastStart?: () => void;
  /** Se llama al desconectar, con la posición en la que se quedó el receptor. */
  onCastEnd?: (positionSeconds: number) => void;
};

// El Default Media Receiver reproduce HLS y MP4; con otros formatos hace falta
// una app receptora propia.
function contentTypeFor(url: string) {
  const path = url.split('?')[0].toLowerCase();
  if (path.endsWith('.m3u8')) {
    return 'application/x-mpegURL';
  }
  if (path.endsWith('.mpd')) {
    return 'application/dash+xml';
  }
  if (path.endsWith('.webm')) {
    return 'video/webm';
  }
  return 'video/mp4';
}

/**
 * Envuelve react-native-google-cast: al conectarse un dispositivo carga el vídeo
 * actual en el receptor y expone controles remotos con la misma forma que los
 * locales (play/pause/seek), para que la UI no tenga que saber dónde se reproduce.
 */
export default function useCast({
  media,
  getLocalTime,
  onCastStart,
  onCastEnd,
}: Options) {
  const session = useCastSession();
  const client = useRemoteMediaClient();
  const device = useCastDevice();
  const status = useMediaStatus();
  const streamPosition = useStreamPosition(1);

  const casting = !!session && !!client;
  const [loadError, setLoadError] = useState<string | null>(null);

  // La última posición conocida del receptor, para reanudar en local al desconectar.
  const remoteTimeRef = useRef(0);
  const wasCastingRef = useRef(false);
  // Evita recargar el mismo vídeo (el cliente se vuelve a crear en cada evento).
  const loadedUrlRef = useRef<string | null>(null);
  const callbacks = useRef({onCastStart, onCastEnd, getLocalTime});
  callbacks.current = {onCastStart, onCastEnd, getLocalTime};

  const position = streamPosition ?? status?.streamPosition ?? 0;
  useEffect(() => {
    if (casting) {
      remoteTimeRef.current = position;
    }
  }, [casting, position]);

  // Conexión / cambio de vídeo: cargar en el receptor.
  useEffect(() => {
    if (!client || !media.url) {
      return;
    }
    if (loadedUrlRef.current === media.url) {
      return;
    }
    loadedUrlRef.current = media.url;

    const startTime = media.isLive ? 0 : callbacks.current.getLocalTime();
    const mediaInfo: MediaInfo = {
      contentUrl: media.url,
      contentType: contentTypeFor(media.url),
      streamType: media.isLive ? MediaStreamType.LIVE : MediaStreamType.BUFFERED,
      streamDuration: media.isLive ? undefined : media.duration || undefined,
      metadata: {type: 'generic', title: media.title ?? ''},
    };

    setLoadError(null);
    client
      .loadMedia({mediaInfo, autoplay: true, startTime})
      .catch((e: unknown) =>
        setLoadError(e instanceof Error ? e.message : String(e)),
      );
  }, [client, media.url, media.isLive, media.title, media.duration]);

  // Transiciones conectar / desconectar.
  useEffect(() => {
    if (casting && !wasCastingRef.current) {
      wasCastingRef.current = true;
      callbacks.current.onCastStart?.();
      return;
    }
    if (!casting && wasCastingRef.current) {
      wasCastingRef.current = false;
      loadedUrlRef.current = null;
      callbacks.current.onCastEnd?.(remoteTimeRef.current);
      remoteTimeRef.current = 0;
    }
  }, [casting]);

  const play = useCallback(() => client?.play(), [client]);
  const pause = useCallback(() => client?.pause(), [client]);
  const seek = useCallback(
    (seconds: number) => client?.seek({position: Math.max(0, seconds)}),
    [client],
  );
  /** Termina la sesión y apaga la reproducción en el receptor. */
  const stop = useCallback(
    () => GoogleCast.getSessionManager().endCurrentSession(true),
    [],
  );
  /**
   * Abre el controlador ampliado nativo del SDK (Android: RNGCExpandedControllerActivity,
   * iOS: los controles ampliados por defecto): carátula, volumen del dispositivo,
   * pistas de audio/subtítulos del receptor y desconectar.
   */
  const showRemoteControls = useCallback(
    () => GoogleCast.showExpandedControls(),
    [],
  );
  const playerState = status?.playerState ?? null;

  return {
    casting,
    deviceName: device?.friendlyName ?? device?.deviceId ?? 'Chromecast',
    /** Duración informada por el receptor (0 en directo). */
    duration: status?.mediaInfo?.streamDuration ?? 0,
    position,
    paused: playerState === MediaPlayerState.PAUSED,
    buffering:
      playerState === MediaPlayerState.BUFFERING ||
      playerState === MediaPlayerState.LOADING ||
      (casting && playerState === null),
    loadError,
    play,
    pause,
    seek,
    stop,
    showRemoteControls,
  };
}
