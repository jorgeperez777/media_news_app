import {t} from '../i18n';

// El reloj de la barra lo pone el reproductor, y es el mismo que usan las
// fichas: se reexporta en vez de tener dos copias que acaben separándose.
export {formatTime} from 'react-native-video/controls';

/**
 * `formatLength(1460)` → «24 min»; con una hora o más, «1 h 2 min». Es como se
 * escribe la duración de un episodio en una ficha, no en la barra.
 */
export function formatLength(seconds: number) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) {
    return t('length.minutes', {count: minutes});
  }
  return t('length.hours', {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  });
}

/**
 * `timeAgo('2026-10-15T08:00:00Z')` → «hace 6 h». Es lo que pone una app de
 * noticias bajo el titular; con más de una semana ya se enseña la fecha.
 */
export function timeAgo(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 1) {
    return t('time.now');
  }
  if (minutes < 60) {
    return t('time.minutes', {count: minutes});
  }
  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return t('time.hours', {count: hours});
  }
  const days = Math.round(hours / 24);
  if (days <= 7) {
    return t('time.days', {count: days});
  }
  return new Date(iso).toLocaleDateString();
}
