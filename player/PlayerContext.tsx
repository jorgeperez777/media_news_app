import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {View} from 'react-native';
import SOURCES from '../sources';

/** Caja (en coordenadas de ventana) donde debe verse el reproductor expandido. */
export type Anchor = {x: number; y: number; width: number; height: number};

type PlayerState = {
  /** Índice en SOURCES del vídeo abierto, o null si no hay ninguno. */
  index: number | null;
  /** 'full' = pantalla de detalle · 'mini' = barra flotante sobre la lista. */
  mode: 'full' | 'mini';
  paused: boolean;
  fullscreen: boolean;
  pip: boolean;
  error: string | null;
  anchor: Anchor | null;
};

type PlayerApi = PlayerState & {
  open: (index: number) => void;
  close: () => void;
  minimize: () => void;
  expand: () => void;
  goTo: (index: number) => void;
  setPaused: (paused: boolean) => void;
  setFullscreen: (fullscreen: boolean) => void;
  setPip: (pip: boolean) => void;
  setError: (error: string | null) => void;
  setAnchor: (anchor: Anchor | null) => void;
  /**
   * Vista raíz de la app. El hueco del detalle se mide respecto a ella (no con
   * measureInWindow: en Android sus coordenadas no incluyen la barra de estado y
   * el reproductor acababa desplazado hacia arriba).
   */
  rootRef: React.RefObject<View | null>;
  /** Vecinos dentro de la misma sección (canales con canales, vídeos con vídeos). */
  previousIndex: number | null;
  nextIndex: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
};

const PlayerContext = createContext<PlayerApi | null>(null);

/**
 * Estado del reproductor, arriba del todo del árbol.
 *
 * La clave del miniplayer es que el `<Video>` **nunca se desmonta** al cambiar de
 * pantalla: en React Native no se puede reparentar una vista nativa, así que el
 * reproductor vive en la raíz (ver `PlayerHost`) y las pantallas solo dicen dónde
 * debe dibujarse. Si se desmontara, ExoPlayer/AVPlayer se liberan y la
 * reproducción se reinicia.
 */
export function PlayerProvider({children}: {children: React.ReactNode}) {
  const [index, setIndex] = useState<number | null>(null);
  const [mode, setMode] = useState<'full' | 'mini'>('full');
  const [paused, setPaused] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const rootRef = useRef<View | null>(null);

  const open = useCallback((next: number) => {
    setIndex(next);
    setMode('full');
    setPaused(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    setIndex(null);
    setMode('full');
    setAnchor(null);
    setError(null);
  }, []);

  const goTo = useCallback((next: number) => {
    setIndex(Math.max(0, Math.min(SOURCES.length - 1, next)));
    setPaused(false);
    setError(null);
  }, []);

  // ⏮/⏭ se mueven dentro de la sección del elemento actual: un canal en vivo no
  // salta a un vídeo a la carta ni al contrario.
  const neighbour = useCallback((from: number, step: number) => {
    const kind = SOURCES[from].kind;
    for (let i = from + step; i >= 0 && i < SOURCES.length; i += step) {
      if (SOURCES[i].kind === kind) {
        return i;
      }
    }
    return null;
  }, []);

  const previousIndex = index === null ? null : neighbour(index, -1);
  const nextIndex = index === null ? null : neighbour(index, 1);

  const value = useMemo<PlayerApi>(
    () => ({
      index,
      mode,
      paused,
      fullscreen,
      pip,
      error,
      anchor,
      open,
      close,
      minimize: () => setMode('mini'),
      expand: () => setMode('full'),
      goTo,
      setPaused,
      setFullscreen,
      setPip,
      setError,
      setAnchor,
      rootRef,
      previousIndex,
      nextIndex,
      hasPrevious: previousIndex !== null,
      hasNext: nextIndex !== null,
    }),
    [
      index,
      mode,
      paused,
      fullscreen,
      pip,
      error,
      anchor,
      open,
      close,
      goTo,
      previousIndex,
      nextIndex,
    ],
  );

  return (
    <PlayerContext.Provider value={value}>{children}</PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error('usePlayer debe usarse dentro de <PlayerProvider>');
  }
  return context;
}
