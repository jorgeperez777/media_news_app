/**
 * Textos de la interfaz. Sin dependencias nativas: el idioma sale del locale que
 * expone Hermes vía `Intl`, y si algo falla se cae al español.
 *
 * Las claves son planas y descriptivas (`menu.quality`), y los parámetros van
 * entre llaves: `t('error.retryIn', {seconds: 3})`.
 */

const es = {
  // Reproductor: menú
  'menu.quality': 'Calidad',
  'menu.saver': 'Ahorro de datos',
  'menu.subtitles': 'Subtítulos',
  'menu.audio': 'Audio',
  'menu.speed': 'Velocidad de reproducción',
  'menu.episodes': 'Episodios',
  'menu.saverHint':
    'Limita el bitrate cuando no estás en Wi-Fi. La calidad sigue ajustándose sola por debajo de ese tope.',

  // Valores del menú
  'value.unavailable': 'No disponible',
  'value.unavailableCasting': 'No disponible al transmitir',
  'value.unavailableLive': 'No disponible en directo',
  'value.castChooses': 'La elige el Chromecast',
  'quality.auto': 'Auto',
  'quality.autoAt': 'Auto ({height}p)',
  'quality.height': '{height}p',
  'speed.normal': 'Normal',
  'speed.rate': '{rate}x',
  'saver.auto': 'Automático',
  'saver.on': 'Siempre activado',
  'saver.off': 'Desactivado',
  'saver.bandwidth': ' · red estimada en {rate}',
  'saver.noEffect': 'sin efecto: calidad fija',
  'subtitles.off': 'Desactivados',
  'audio.default': 'Predeterminado',
  'track.fallback': 'Pista {number}',

  // Redes (useNetworkCap)
  'network.wifi': 'Wi-Fi',
  'network.ethernet': 'Cable',
  'network.cellular': 'Datos móviles',
  'network.unknown': 'Red desconocida',
  'network.noLimit': 'sin límite',
  'network.limit': 'hasta {rate}',

  // Estados del reproductor
  'live.badge': 'EN VIVO',
  'offline.banner': 'Sin conexión · reconectando…',
  'error.title': 'No se pudo reproducir el vídeo',
  'error.offlineTitle': 'Sin conexión a internet',
  'error.offlineDetail': 'Se reintentará automáticamente al recuperar la red',
  'error.retry': 'Reintentar',
  'error.retryIn': 'Reintentar ({seconds} s)',
  'cast.playingOn': 'Transmitiendo a {device}',
  'cast.failed': 'No se pudo transmitir: {error}',
  'airplay.playingOn': 'Reproduciendo en {device}',
  'airplay.name': 'AirPlay',

  // Capítulos y continuidad
  'chapter.skipIntro': 'Saltar intro',
  'next.upNext': 'A continuación',
  'next.inSeconds': 'Empieza en {seconds} s',
  'next.playNow': 'Reproducir ya',
  'next.cancel': 'Cancelar',
  'next.nextEpisode': 'Siguiente episodio',
  'lock.unlock': 'Desbloquear',

  // Gestos
  'gesture.volume': 'Volumen',
  'gesture.brightness': 'Brillo',
  'gesture.fit': 'Ajustar',
  'gesture.fill': 'Rellenar',

  // Accesibilidad
  'a11y.play': 'Reproducir',
  'a11y.pause': 'Pausar',
  'a11y.replay': 'Volver a reproducir',
  'a11y.back': 'Retroceder {seconds} segundos',
  'a11y.forward': 'Avanzar {seconds} segundos',
  'a11y.previous': 'Vídeo anterior',
  'a11y.next': 'Vídeo siguiente',
  'a11y.settings': 'Ajustes',
  'a11y.subtitlesOn': 'Desactivar subtítulos',
  'a11y.subtitlesOff': 'Activar subtítulos',
  'a11y.pip': 'Ver en ventana flotante',
  'a11y.fullscreenEnter': 'Pantalla completa',
  'a11y.fullscreenExit': 'Salir de pantalla completa',
  'a11y.minimize': 'Minimizar el reproductor',
  'a11y.stopCast': 'Dejar de transmitir',
  'a11y.castControls': 'Controles del dispositivo',
  'a11y.goLive': 'Volver al directo',
  'a11y.atLive': 'Estás en directo',
  'a11y.seekBar': 'Barra de reproducción',
  'a11y.seekBarHint': 'Desliza arriba o abajo para avanzar o retroceder',
  'a11y.position': '{position} de {duration}',
  'a11y.surface': 'Vídeo. Toca para mostrar los controles',
  'a11y.retry': 'Reintentar la reproducción',
  'a11y.back10': 'Retrocede 10 segundos',
  'a11y.lock': 'Bloquear la pantalla',
  'a11y.unlock': 'Desbloquear la pantalla',
  'a11y.locked': 'Pantalla bloqueada. Toca para desbloquear',
  'a11y.episodes': 'Episodios',
  'a11y.closePlayer': 'Cerrar el reproductor',

  // Pantallas
  'tab.live': 'TV en vivo',
  'tab.videos': 'Vídeos',
  'tab.search': 'Buscar',
  'tab.profile': 'Perfil',
  'screen.videosTitle': 'Vídeos',
  'screen.videosIntro':
    'Vídeos a la carta. Abre uno y pulsa ⌄ para dejarlo en el miniplayer; sigue reproduciéndose mientras navegas por las pestañas. Los canales en directo están en «TV en vivo».',
  'screen.liveTitle': 'Guía de canales',
  'screen.livePick': 'Elige un canal para empezar',
  'screen.liveHint':
    'Toca un canal o usa ⏮ ⏭ para cambiar de canal · ⌄ lo deja en el miniplayer y sigue sonando en las demás pestañas',
  'screen.detailHint':
    'Tap: mostrar/ocultar controles · Doble tap en los lados: ±10 s · Mantén pulsado: x2 mientras no sueltes · Desliza arriba/abajo: brillo y volumen · Pellizca: ajustar o rellenar · ⏮ ⏭ cambian de vídeo ({position}/{total}) · ⌄ (junto al título) manda el vídeo al miniplayer',
  'screen.minimize': 'Minimizar',
  'screen.close': 'Cerrar',
  'screen.error': 'Error: {message}',
  'screen.continueWatching': 'Seguir viendo · {position}',
  'screen.liveInMini': 'El canal está en el miniplayer',
  'screen.seriesTitle': 'Series',
  'screen.seriesIntro':
    'Una serie abre sus episodios como Netflix: directo a horizontal y a pantalla completa. Atrás cierra el episodio y te devuelve aquí.',
  'screen.seriesEpisodes': '{count} episodios',
  'screen.seriesBadge': 'T{season}:E{number}',
  'screen.seriesHint':
    'Dentro del episodio: ☰ cambia de episodio sin salir, 🔒 bloquea la pantalla, «Saltar intro» aparece en la intro y al final sale el siguiente episodio.',
  'screen.play': 'Reproducir',
  'screen.resume': 'Seguir viendo',
  'screen.episodeOf': '{position} de {total}',
  'screen.searchTitle': 'Buscar',
  'screen.searchBody':
    'Pestaña de ejemplo. Sirve para comprobar que el miniplayer sigue reproduciendo al cambiar de pestaña.',

  // Diagnóstico (QoE)
  'qoe.title': 'Diagnóstico de reproducción',
  'qoe.intro':
    'Métricas de calidad de experiencia de esta sesión: lo que habría que mandar a un servidor para saber si el vídeo funciona fuera del laboratorio.',
  'qoe.empty': 'Todavía no has reproducido nada.',
  'qoe.startup': 'Arranque',
  'qoe.rebuffer': 'Rebuffers',
  'qoe.rebufferRatio': 'Ratio de rebuffer',
  'qoe.watched': 'Visto',
  'qoe.errors': 'Errores',
  'qoe.seeks': 'Saltos',
  'qoe.bitrate': 'Bitrate medio',
  'qoe.sessions': 'Sesiones',
  'qoe.clear': 'Borrar métricas',
  'qoe.live': 'en curso',
} as const;

const en: Record<keyof typeof es, string> = {
  'menu.quality': 'Quality',
  'menu.saver': 'Data saver',
  'menu.subtitles': 'Subtitles',
  'menu.audio': 'Audio',
  'menu.speed': 'Playback speed',
  'menu.episodes': 'Episodes',
  'menu.saverHint':
    'Caps the bitrate when you are off Wi-Fi. Quality still adapts on its own below that cap.',

  'value.unavailable': 'Not available',
  'value.unavailableCasting': 'Not available while casting',
  'value.unavailableLive': 'Not available on live',
  'value.castChooses': 'The Chromecast picks it',
  'quality.auto': 'Auto',
  'quality.autoAt': 'Auto ({height}p)',
  'quality.height': '{height}p',
  'speed.normal': 'Normal',
  'speed.rate': '{rate}x',
  'saver.auto': 'Automatic',
  'saver.on': 'Always on',
  'saver.off': 'Off',
  'saver.bandwidth': ' · network estimated at {rate}',
  'saver.noEffect': 'no effect: quality is fixed',
  'subtitles.off': 'Off',
  'audio.default': 'Default',
  'track.fallback': 'Track {number}',

  'network.wifi': 'Wi-Fi',
  'network.ethernet': 'Ethernet',
  'network.cellular': 'Mobile data',
  'network.unknown': 'Unknown network',
  'network.noLimit': 'no cap',
  'network.limit': 'up to {rate}',

  'live.badge': 'LIVE',
  'offline.banner': 'Offline · reconnecting…',
  'error.title': 'This video could not be played',
  'error.offlineTitle': 'No internet connection',
  'error.offlineDetail': 'It will retry automatically once the network is back',
  'error.retry': 'Retry',
  'error.retryIn': 'Retry ({seconds} s)',
  'cast.playingOn': 'Casting to {device}',
  'cast.failed': 'Could not cast: {error}',
  'airplay.playingOn': 'Playing on {device}',
  'airplay.name': 'AirPlay',

  'chapter.skipIntro': 'Skip intro',
  'next.upNext': 'Up next',
  'next.inSeconds': 'Starts in {seconds} s',
  'next.playNow': 'Play now',
  'next.cancel': 'Cancel',
  'next.nextEpisode': 'Next episode',
  'lock.unlock': 'Unlock',

  'gesture.volume': 'Volume',
  'gesture.brightness': 'Brightness',
  'gesture.fit': 'Fit',
  'gesture.fill': 'Fill',

  'a11y.play': 'Play',
  'a11y.pause': 'Pause',
  'a11y.replay': 'Play again',
  'a11y.back': 'Go back {seconds} seconds',
  'a11y.forward': 'Go forward {seconds} seconds',
  'a11y.previous': 'Previous video',
  'a11y.next': 'Next video',
  'a11y.settings': 'Settings',
  'a11y.subtitlesOn': 'Turn subtitles off',
  'a11y.subtitlesOff': 'Turn subtitles on',
  'a11y.pip': 'Play in a floating window',
  'a11y.fullscreenEnter': 'Full screen',
  'a11y.fullscreenExit': 'Exit full screen',
  'a11y.minimize': 'Minimise the player',
  'a11y.stopCast': 'Stop casting',
  'a11y.castControls': 'Device controls',
  'a11y.goLive': 'Back to live',
  'a11y.atLive': 'You are watching live',
  'a11y.seekBar': 'Playback bar',
  'a11y.seekBarHint': 'Swipe up or down to seek',
  'a11y.position': '{position} of {duration}',
  'a11y.surface': 'Video. Tap to show the controls',
  'a11y.retry': 'Retry playback',
  'a11y.back10': 'Goes back 10 seconds',
  'a11y.lock': 'Lock the screen',
  'a11y.unlock': 'Unlock the screen',
  'a11y.locked': 'Screen locked. Tap to unlock',
  'a11y.episodes': 'Episodes',
  'a11y.closePlayer': 'Close the player',

  'tab.live': 'Live TV',
  'tab.videos': 'Videos',
  'tab.search': 'Search',
  'tab.profile': 'Profile',
  'screen.videosTitle': 'Videos',
  'screen.videosIntro':
    'On-demand videos. Open one and tap ⌄ to send it to the mini player; it keeps playing while you move between tabs. Live channels live in “Live TV”.',
  'screen.liveTitle': 'Channel guide',
  'screen.livePick': 'Pick a channel to start',
  'screen.liveHint':
    'Tap a channel or use ⏮ ⏭ to switch · ⌄ sends it to the mini player and it keeps playing on the other tabs',
  'screen.detailHint':
    'Tap: show/hide controls · Double tap on the sides: ±10 s · Press and hold: 2x while you hold · Swipe up/down: brightness and volume · Pinch: fit or fill · ⏮ ⏭ change video ({position}/{total}) · ⌄ (next to the title) sends the video to the mini player',
  'screen.minimize': 'Minimise',
  'screen.close': 'Close',
  'screen.error': 'Error: {message}',
  'screen.continueWatching': 'Continue watching · {position}',
  'screen.liveInMini': 'The channel is in the mini player',
  'screen.seriesTitle': 'Series',
  'screen.seriesIntro':
    'A series opens its episodes the way Netflix does: straight to landscape and full screen. Back closes the episode and brings you here.',
  'screen.seriesEpisodes': '{count} episodes',
  'screen.seriesBadge': 'S{season}:E{number}',
  'screen.seriesHint':
    'Inside an episode: ☰ switches episode without leaving, 🔒 locks the screen, “Skip intro” shows up during the intro and the next episode card appears at the end.',
  'screen.play': 'Play',
  'screen.resume': 'Resume',
  'screen.episodeOf': '{position} of {total}',
  'screen.searchTitle': 'Search',
  'screen.searchBody':
    'Example tab. It is here to check that the mini player keeps playing when you switch tabs.',

  'qoe.title': 'Playback diagnostics',
  'qoe.intro':
    'Quality-of-experience metrics for this session: what you would ship to a server to know whether video works outside the lab.',
  'qoe.empty': 'Nothing has been played yet.',
  'qoe.startup': 'Startup',
  'qoe.rebuffer': 'Rebuffers',
  'qoe.rebufferRatio': 'Rebuffer ratio',
  'qoe.watched': 'Watched',
  'qoe.errors': 'Errors',
  'qoe.seeks': 'Seeks',
  'qoe.bitrate': 'Average bitrate',
  'qoe.sessions': 'Sessions',
  'qoe.clear': 'Clear metrics',
  'qoe.live': 'in progress',
};

export type TextKey = keyof typeof es;

const DICTS: Record<string, Record<TextKey, string>> = {es, en};

/** Idioma del dispositivo, reducido a los que hay traducidos. */
function deviceLanguage(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const base = locale.toLowerCase().split(/[-_]/)[0];
    return base in DICTS ? base : 'es';
  } catch {
    return 'es';
  }
}

export const language = deviceLanguage();

/** Texto traducido, con `{parámetros}` sustituidos. */
export function t(key: TextKey, params?: Record<string, string | number>) {
  const template = DICTS[language]?.[key] ?? es[key];
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params[name] ?? ''),
  );
}

export default t;
