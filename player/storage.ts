/**
 * Lo que sobrevive a cerrar la app: dónde ibas en cada vídeo («seguir viendo») y
 * las preferencias del reproductor (idioma de subtítulos y de audio, calidad,
 * velocidad y ahorro de datos).
 *
 * Todo pasa por AsyncStorage con escrituras agrupadas: la posición se guarda cada
 * pocos segundos, así que no conviene tocar el disco en cada `onProgress`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {DataSaver} from '../components/useNetworkCap';

const POSITIONS_KEY = 'player.positions.v1';
const PREFS_KEY = 'player.prefs.v1';

/** Por debajo de esto no merece la pena recordar nada. */
const MIN_RESUME_S = 15;
/** Tan cerca del final que lo suyo es empezar de nuevo. */
const END_MARGIN_S = 20;
/** Cuántos vídeos se recuerdan (los más recientes). */
const MAX_POSITIONS = 100;
/** Cada cuánto se baja a disco la posición mientras se reproduce. */
export const SAVE_EVERY_MS = 5000;

export type Position = {seconds: number; duration: number; updatedAt: number};
export type Positions = Record<string, Position>;

export type Prefs = {
  /** Idioma de subtítulos elegido, o 'off'. Se guarda el idioma, no el índice:
   *  los índices cambian de un stream a otro. */
  subtitleLanguage?: string | 'off';
  audioLanguage?: string;
  quality?: 'auto' | number;
  speed?: number;
  dataSaver?: DataSaver;
};

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // Un almacén corrupto o lleno no puede tumbar la reproducción.
    return fallback;
  }
}

async function writeJson(key: string, value: unknown) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Igual: si no se puede guardar, se sigue reproduciendo.
  }
}

export const loadPositions = () => readJson<Positions>(POSITIONS_KEY, {});
export const loadPrefs = () => readJson<Prefs>(PREFS_KEY, {});
export const savePrefs = (prefs: Prefs) => writeJson(PREFS_KEY, prefs);

/**
 * Aplica las reglas de «seguir viendo» a un mapa en memoria: guarda la posición,
 * o la borra si ya no merece la pena recordarla (demasiado pronto, demasiado
 * cerca del final, o sin duración conocida).
 *
 * Está separado de `savePosition` para que quien pinte la lista sin esperar al
 * disco use exactamente el mismo criterio: si no, se quedan barras de «seguir
 * viendo» en vídeos que ya se habían terminado.
 */
export function withPosition(
  positions: Positions,
  uri: string,
  seconds: number,
  duration: number,
): Positions {
  const next = {...positions};
  if (
    duration <= 0 ||
    seconds < MIN_RESUME_S ||
    seconds > duration - END_MARGIN_S
  ) {
    delete next[uri];
  } else {
    next[uri] = {seconds, duration, updatedAt: Date.now()};
  }
  const trimmed = Object.entries(next)
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, MAX_POSITIONS);
  return Object.fromEntries(trimmed);
}

/** Guarda (o borra, si ya no merece la pena) la posición de un vídeo. */
export async function savePosition(
  uri: string,
  seconds: number,
  duration: number,
) {
  const positions = await loadPositions();
  await writeJson(POSITIONS_KEY, withPosition(positions, uri, seconds, duration));
}

/** Posición desde la que arrancar, o 0 si toca empezar de cero. */
export function resumeFrom(positions: Positions, uri?: string) {
  if (!uri) {
    return 0;
  }
  const saved = positions[uri];
  if (!saved || saved.seconds < MIN_RESUME_S) {
    return 0;
  }
  if (saved.duration > 0 && saved.seconds > saved.duration - END_MARGIN_S) {
    return 0;
  }
  return saved.seconds;
}

export async function clearPositions() {
  await writeJson(POSITIONS_KEY, {});
}
