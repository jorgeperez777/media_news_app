/**
 * Textos de la interfaz. Sin dependencias nativas: el idioma sale del locale que
 * expone Hermes vía `Intl`, y si algo falla se cae al español.
 *
 * Las claves son planas y descriptivas (`menu.quality`), y los parámetros van
 * entre llaves: `t('error.retryIn', {seconds: 3})`.
 *
 * El idioma se puede cambiar en caliente (`setLanguage`). Quien pinte texto tiene
 * que enterarse del cambio: para eso está `useLanguage()`, que suscribe al
 * componente. Por eso tampoco vale llamar a `t()` al cargar el módulo (una tabla
 * de etiquetas en una constante, por ejemplo): ese texto se quedaría congelado en
 * el idioma de arranque.
 */
import {useSyncExternalStore} from 'react';

const es = {
  // Lo poco del reproductor que la app también pinta (los textos de los
  // controles viven en la librería, ver `react-native-video/controls`).
  'live.badge': 'EN VIVO',

  // Capítulos y continuidad
  'next.nextEpisode': 'Siguiente episodio',

  // Accesibilidad
  'a11y.back10': 'Retrocede 10 segundos',

  // Pantallas
  'tab.home': 'Inicio',
  'tab.news': 'Noticias',
  'tab.live': 'TV en vivo',
  'tab.search': 'Buscar',
  'tab.favourites': 'Favoritos',
  'tab.profile': 'Perfil',
  'screen.videosTitle': 'Inicio',
  'screen.featured': 'Destacados',
  'screen.details': 'Detalles',
  'screen.moviesRow': 'Películas',
  'detail.watched': '{percent}% visto',
  'detail.quality': 'HD',
  'detail.score': 'TMDb {rating}',
  'detail.minutes': '{count} min',
  'detail.director': 'Dirección: {name}',
  'detail.cast': 'Reparto: {names}',
  'detail.myList': 'Mi lista',
  'detail.added': 'Añadida',
  'detail.share': 'Compartir',
  'detail.trailer': 'Ver tráiler',
  'detail.close': 'Cerrar',
  'profile.title': 'Mi perfil',
  'profile.guest': 'Invitado',
  'profile.local':
    'Sin cuenta: Mi lista, lo visto y los ajustes se quedan en este teléfono.',
  'profile.share': 'Compartir',
  'profile.shareText': 'Te recomiendo esta app de vídeo.',
  'profile.more': 'Más opciones',
  'profile.dataSaver': 'Ahorro de datos',
  'profile.data.auto': 'Automático',
  'profile.data.on': 'Activado',
  'profile.data.off': 'Desactivado',
  'profile.clearList': 'Vaciar Mi lista',
  'profile.clearWatched': 'Borrar lo visto',
  'profile.diagnostics': 'Diagnóstico',
  'profile.version': 'Versión {version}',
  'settings.language': 'Idioma',
  'credits.title': 'Datos del catálogo',
  'credits.tmdb':
    'Este producto usa la API de TMDb, pero no está avalado ni certificado por TMDb.',
  'tmdb.title': 'Catálogo de pruebas',
  'tmdb.intro':
    'Trae fichas reales de TMDb (carteles, sinopsis y géneros) para ver la app llena. TMDb no sirve vídeo: cada título se reproduce con un vídeo de muestra, así que la película que ves no es la de la ficha.',
  'tmdb.load': 'Traer 100 títulos',
  'tmdb.loading': 'Trayendo…',
  'tmdb.loaded': 'En el catálogo: {count}',
  'tv.title': 'Series de TMDb',
  'tv.intro':
    'Series reales con sus episodios y fotogramas. TMDb no sirve vídeo: cada episodio se abre con uno de muestra. Lo traído se guarda en el dispositivo.',
  'tv.load': 'Traer 20 series',
  'tv.loading': 'Trayendo…',
  'tv.loaded': 'Series en el catálogo: {count}',
  'credits.archive':
    'Las películas y sus vídeos vienen del Internet Archive (archive.org).',
  'language.auto': 'Automático',
  'language.es': 'Español',
  'language.en': 'English',
  'detail.synopsis': 'Sinopsis',
  'detail.readMore': 'Ver completo',
  'detail.readLess': 'Ver menos',
  'detail.chapters': 'Capítulos',
  'detail.more': 'Más películas',
  'detail.skippable': 'Se puede saltar',
  'screen.pause': 'Pausa',
  'favourites.empty': 'Todavía no has añadido nada a Mi lista.',
  'favourites.hint':
    'Usa el + de la ficha de una película para guardarla aquí.',
  'series.meta': 'Serie · {count} episodios · HD',
  'catalog.loading': 'Trayendo películas del Internet Archive…',
  'catalog.error': 'No se pudo cargar el catálogo: {message}',
  'catalog.retry': 'Reintentar',
  'catalog.more': 'Cargar más',
  'catalog.end': 'No hay más títulos',
  'catalog.cached': 'Listado guardado en disco: {count} títulos',
  'catalog.clearCache': 'Vaciar',
  'series.episodesTab': 'Episodios',
  'series.similarTab': 'Títulos similares',
  'series.season': 'Temporada {number}',
  'series.resume': 'Seguir viendo T{season}:E{number}',
  'series.restart': 'Ver desde el principio',
  'series.episodeTitle': '{number}. {title}',
  'series.watched': 'Visto',
  'screen.seeAll': 'Ver todo',
  'screen.remaining': 'Quedan {time}',
  'screen.continueRow': 'Seguir viendo',
  'screen.liveRow': 'En directo',
  'screen.videosIntro':
    'Vídeos a la carta. Abre uno y pulsa ⌄ para dejarlo en el miniplayer; sigue reproduciéndose mientras navegas por las pestañas. Los canales en directo están en «Noticias».',
  'screen.liveTitle': 'TV en vivo',
  'screen.newsTitle': 'Noticias',
  'news.breaking': 'Última hora',
  'news.recommended': 'Recomendadas',
  'news.readMore': 'Seguir leyendo',
  'length.minutes': '{count} min',
  'length.hours': '{hours} h {minutes} min',
  'time.now': 'ahora',
  'time.minutes': 'hace {count} min',
  'time.hours': 'hace {count} h',
  'time.days': 'hace {count} d',
  'news.watchLive': 'Ver en directo',
  'news.trending': 'Tendencia',
  'news.save': 'Guardar',
  'news.saved': 'Guardada',
  'news.all': 'Todos los canales',
  'news.live': 'En directo ahora',
  'live.next': 'A continuación',
  'live.inMini': 'Se está viendo en el miniplayer',
  'live.inPip': 'Se está viendo en picture in picture',
  'live.tabAll': 'Canales',
  'live.chipAll': 'Todos',
  'live.openFull': 'Ver a pantalla completa',
  'live.backHere': 'Tocar para traerlo aquí',
  'news.search': 'Buscar canal',
  'news.searchNews': 'Buscar noticia',
  'news.empty': 'Ningún canal coincide con «{query}».',
  'news.emptyNews': 'Ninguna noticia coincide con «{query}».',
  'screen.liveHint':
    'Toca un canal para verlo en horizontal a pantalla completa · ⏮ ⏭ cambian de canal sin salir',
  'screen.detailHint':
    'Tap: mostrar/ocultar controles · Doble tap en los lados: ±10 s · Mantén pulsado: x2 mientras no sueltes · Desliza arriba/abajo: brillo y volumen · Pellizca: ajustar o rellenar · ⏮ ⏭ cambian de vídeo ({position}/{total}) · ⌄ (junto al título) manda el vídeo al miniplayer',
  'screen.minimize': 'Minimizar',
  'screen.close': 'Cerrar',
  'screen.error': 'Error: {message}',
  'screen.preparingSlow':
    'Esto tarda más de lo normal. Comprueba tu conexión o vuelve a intentarlo.',
  'screen.continueWatching': 'Seguir viendo · {position}',
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
  'screen.searchPlaceholder': 'Películas, series, canales…',
  'screen.noResults': 'Nada coincide con «{query}».',
  'screen.searchBody':
    'Pestaña de ejemplo. Sirve para comprobar que el miniplayer sigue reproduciendo al cambiar de pestaña.',
  'screen.favouritesTitle': 'Favoritos',
  'screen.favouritesBody':
    'Pestaña de ejemplo: aquí irían los vídeos guardados. El miniplayer sigue sonando mientras la visitas.',

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
  'live.badge': 'LIVE',
  'next.nextEpisode': 'Next episode',
  'a11y.back10': 'Goes back 10 seconds',

  'tab.home': 'Home',
  'tab.news': 'News',
  'tab.live': 'Live TV',
  'tab.search': 'Search',
  'tab.favourites': 'Favourites',
  'tab.profile': 'Profile',
  'screen.videosTitle': 'Home',
  'screen.featured': 'Featured',
  'screen.details': 'Details',
  'screen.moviesRow': 'Movies',
  'detail.watched': '{percent}% watched',
  'detail.quality': 'HD',
  'detail.score': 'TMDb {rating}',
  'detail.minutes': '{count} min',
  'detail.director': 'Director: {name}',
  'detail.cast': 'Cast: {names}',
  'detail.myList': 'My list',
  'detail.added': 'Added',
  'detail.share': 'Share',
  'detail.trailer': 'Watch trailer',
  'detail.close': 'Close',
  'profile.title': 'My profile',
  'profile.guest': 'Guest',
  'profile.local':
    'No account: My list, what you watched and the settings stay on this phone.',
  'profile.share': 'Share',
  'profile.shareText': 'I recommend this video app.',
  'profile.more': 'More',
  'profile.dataSaver': 'Data saver',
  'profile.data.auto': 'Automatic',
  'profile.data.on': 'On',
  'profile.data.off': 'Off',
  'profile.clearList': 'Empty My list',
  'profile.clearWatched': 'Clear what you watched',
  'profile.diagnostics': 'Diagnostics',
  'profile.version': 'Version {version}',
  'settings.language': 'Language',
  'credits.title': 'Catalogue data',
  'credits.tmdb':
    'This product uses the TMDb API but is not endorsed or certified by TMDb.',
  'tmdb.title': 'Test catalogue',
  'tmdb.intro':
    'Pulls real TMDb records (posters, overviews and genres) so you can see the app full. TMDb serves no video: every title plays a sample video, so what you watch is not the film on the card.',
  'tmdb.load': 'Fetch 100 titles',
  'tmdb.loading': 'Fetching…',
  'tmdb.loaded': 'In the catalogue: {count}',
  'tv.title': 'TMDb series',
  'tv.intro':
    'Real series with their episodes and stills. TMDb serves no video: every episode plays a sample one. What you fetch is saved on the device.',
  'tv.load': 'Fetch 20 series',
  'tv.loading': 'Fetching…',
  'tv.loaded': 'Series in the catalogue: {count}',
  'credits.archive':
    'Movies and their videos come from the Internet Archive (archive.org).',
  'language.auto': 'Automatic',
  'language.es': 'Español',
  'language.en': 'English',
  'detail.synopsis': 'Synopsis',
  'detail.readMore': 'Read more',
  'detail.readLess': 'Read less',
  'detail.chapters': 'Chapters',
  'detail.more': 'More movies',
  'detail.skippable': 'Skippable',
  'screen.pause': 'Pause',
  'favourites.empty': 'Nothing in My list yet.',
  'favourites.hint': 'Use the + on a movie page to save it here.',
  'series.meta': 'Series · {count} episodes · HD',
  'catalog.loading': 'Fetching movies from the Internet Archive…',
  'catalog.error': 'Could not load the catalogue: {message}',
  'catalog.retry': 'Retry',
  'catalog.more': 'Load more',
  'catalog.end': 'No more titles',
  'catalog.cached': 'Catalogue saved on disk: {count} titles',
  'catalog.clearCache': 'Clear',
  'series.episodesTab': 'Episodes',
  'series.similarTab': 'Similar titles',
  'series.season': 'Season {number}',
  'series.resume': 'Resume S{season}:E{number}',
  'series.restart': 'Start from the beginning',
  'series.episodeTitle': '{number}. {title}',
  'series.watched': 'Watched',
  'screen.seeAll': 'See all',
  'screen.remaining': '{time} left',
  'screen.continueRow': 'Continue watching',
  'screen.liveRow': 'Live now',
  'screen.videosIntro':
    'On-demand videos. Open one and tap ⌄ to send it to the mini player; it keeps playing while you move between tabs. Live channels are under “News”.',
  'screen.liveTitle': 'Live TV',
  'screen.newsTitle': 'News',
  'news.breaking': 'Breaking news',
  'news.recommended': 'Recommendation',
  'news.readMore': 'Keep reading',
  'length.minutes': '{count} min',
  'length.hours': '{hours} h {minutes} min',
  'time.now': 'now',
  'time.minutes': '{count} min ago',
  'time.hours': '{count} h ago',
  'time.days': '{count} d ago',
  'news.watchLive': 'Watch live',
  'news.trending': 'Trending',
  'news.save': 'Save',
  'news.saved': 'Saved',
  'news.all': 'All channels',
  'news.live': 'Live now',
  'live.next': 'Up next',
  'live.inMini': 'Playing in the mini player',
  'live.inPip': 'This video is playing in picture in picture',
  'live.tabAll': 'Channels',
  'live.chipAll': 'All',
  'live.openFull': 'Watch full screen',
  'live.backHere': 'Tap to bring it back here',
  'news.search': 'Search channel',
  'news.searchNews': 'Search news',
  'news.empty': 'No channel matches “{query}”.',
  'news.emptyNews': 'No news matches “{query}”.',
  'screen.liveHint':
    'Tap a channel to watch it full screen in landscape · ⏮ ⏭ switch channels without leaving',
  'screen.detailHint':
    'Tap: show/hide controls · Double tap on the sides: ±10 s · Press and hold: 2x while you hold · Swipe up/down: brightness and volume · Pinch: fit or fill · ⏮ ⏭ change video ({position}/{total}) · ⌄ (next to the title) sends the video to the mini player',
  'screen.minimize': 'Minimise',
  'screen.close': 'Close',
  'screen.error': 'Error: {message}',
  'screen.preparingSlow':
    'This is taking longer than usual. Check your connection or try again.',
  'screen.continueWatching': 'Continue watching · {position}',
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
  'screen.searchPlaceholder': 'Movies, series, channels…',
  'screen.noResults': 'Nothing matches “{query}”.',
  'screen.searchBody':
    'Example tab. It is here to check that the mini player keeps playing when you switch tabs.',
  'screen.favouritesTitle': 'Favourites',
  'screen.favouritesBody':
    'Example tab: saved videos would live here. The mini player keeps playing while you visit it.',

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

const DICTS = {es, en} satisfies Record<string, Record<TextKey, string>>;

/** Idiomas traducidos. */
export type Language = keyof typeof DICTS;
export const LANGUAGES = Object.keys(DICTS) as Language[];
/** Lo que elige el usuario: uno concreto o «el del dispositivo». */
export type LanguagePreference = Language | 'auto';

/** Idioma del dispositivo, reducido a los que hay traducidos. */
function deviceLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const base = locale.toLowerCase().split(/[-_]/)[0];
    return (LANGUAGES as string[]).includes(base) ? (base as Language) : 'es';
  } catch {
    return 'es';
  }
}

let preference: LanguagePreference = 'auto';
let language: Language = deviceLanguage();
const listeners = new Set<() => void>();

/** El que se está usando ahora mismo. */
export const getLanguage = () => language;
/** Lo elegido, que puede ser 'auto'. */
export const getLanguagePreference = () => preference;

/** Cambia el idioma y avisa a quien esté pintando texto. */
export function setLanguage(next: LanguagePreference) {
  preference = next;
  language = next === 'auto' ? deviceLanguage() : next;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Suscribe al componente al idioma: vuelve a renderizar cuando cambia. Devuelve
 * el idioma en uso, por si hace falta para formatear algo.
 */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}

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
