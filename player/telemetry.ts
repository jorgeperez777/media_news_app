/**
 * Telemetría de reproducción (QoE).
 *
 * El reproductor solo emite hechos (`PlaybackEvent`); aquí se agregan en sesiones
 * con las métricas que de verdad se miran en producción: cuánto tarda en arrancar,
 * cuánto tiempo se pasa recargando (rebuffer) y qué errores hubo. En una app real
 * esto se mandaría a un servidor cada pocos minutos; aquí se guarda en memoria y se
 * enseña en la pestaña Perfil.
 */

export type PlaybackEvent =
  /** Se pide una fuente nueva: empieza a contar el arranque. */
  | {type: 'start'; title: string}
  /** Primer fotograma en pantalla. */
  | {type: 'ready'; live: boolean}
  | {type: 'buffer'; buffering: boolean}
  | {type: 'progress'; seconds: number}
  | {type: 'seek'}
  | {type: 'error'; message: string}
  | {type: 'bitrate'; bps: number}
  | {type: 'end'};

export type PlaybackSession = {
  id: number;
  title: string;
  live: boolean;
  startedAt: number;
  /** Del primer byte pedido al primer fotograma. `null` mientras no haya arrancado. */
  startupMs: number | null;
  /** Tiempo de vídeo efectivamente visto (según el progreso del reproductor). */
  watchedMs: number;
  rebufferCount: number;
  rebufferMs: number;
  seeks: number;
  errors: number;
  lastError?: string;
  bitrateSum: number;
  bitrateSamples: number;
  ended: boolean;
};

type Listener = () => void;

const sessions: PlaybackSession[] = [];
const listeners = new Set<Listener>();
let nextId = 1;

// Estado vivo de la sesión en curso, fuera del objeto que se publica.
let openedAt = 0;
let bufferingSince = 0;
let lastProgress = -1;

const emit = () => listeners.forEach(fn => fn());

const current = () => sessions[0];

/** Métricas derivadas, que es lo que se enseña y lo que se enviaría. */
export function summarize(session: PlaybackSession) {
  const total = session.watchedMs + session.rebufferMs;
  return {
    startupMs: session.startupMs,
    rebufferCount: session.rebufferCount,
    rebufferMs: session.rebufferMs,
    /** Fracción del tiempo con el vídeo parado recargando: el número que manda. */
    rebufferRatio: total > 0 ? session.rebufferMs / total : 0,
    watchedMs: session.watchedMs,
    seeks: session.seeks,
    errors: session.errors,
    lastError: session.lastError,
    avgBitrate:
      session.bitrateSamples > 0
        ? session.bitrateSum / session.bitrateSamples
        : 0,
  };
}

export function record(event: PlaybackEvent) {
  const now = Date.now();

  if (event.type === 'start') {
    // La sesión anterior se cierra: lo que quede sin cerrar no se contabiliza.
    closeBuffering(now);
    sessions.unshift({
      id: nextId++,
      title: event.title,
      live: false,
      startedAt: now,
      startupMs: null,
      watchedMs: 0,
      rebufferCount: 0,
      rebufferMs: 0,
      seeks: 0,
      errors: 0,
      bitrateSum: 0,
      bitrateSamples: 0,
      ended: false,
    });
    sessions.splice(MAX_SESSIONS);
    openedAt = now;
    bufferingSince = 0;
    lastProgress = -1;
    emit();
    return;
  }

  const session = current();
  if (!session) {
    return;
  }

  switch (event.type) {
    case 'ready':
      session.live = event.live;
      if (session.startupMs === null) {
        session.startupMs = now - openedAt;
      }
      break;
    case 'buffer':
      if (event.buffering) {
        // El primer buffering es el arranque, no un corte: no cuenta como rebuffer.
        if (session.startupMs !== null && bufferingSince === 0) {
          bufferingSince = now;
          session.rebufferCount += 1;
        }
      } else {
        closeBuffering(now);
      }
      break;
    case 'progress': {
      const seconds = event.seconds;
      if (lastProgress >= 0) {
        const delta = (seconds - lastProgress) * 1000;
        // Solo avances pequeños: un salto grande es un seek, no tiempo visto.
        if (delta > 0 && delta < 2000) {
          session.watchedMs += delta;
        }
      }
      lastProgress = seconds;
      break;
    }
    case 'seek':
      session.seeks += 1;
      lastProgress = -1;
      break;
    case 'error':
      session.errors += 1;
      session.lastError = event.message;
      break;
    case 'bitrate':
      if (event.bps > 0) {
        session.bitrateSum += event.bps;
        session.bitrateSamples += 1;
      }
      break;
    case 'end':
      session.ended = true;
      closeBuffering(now);
      break;
  }
  emit();
}

function closeBuffering(now: number) {
  const session = current();
  if (session && bufferingSince > 0) {
    session.rebufferMs += now - bufferingSince;
  }
  bufferingSince = 0;
}

/** Cuántas sesiones se guardan; en una app real esto sería una cola de envío. */
const MAX_SESSIONS = 20;

export const getSessions = () => sessions;

export function clearSessions() {
  sessions.length = 0;
  emit();
}

export function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
