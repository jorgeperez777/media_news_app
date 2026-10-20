/**
 * El catálogo de la app.
 *
 * Arranca con las fuentes de prueba públicas de siempre (verificadas con HTTP
 * 200) y, al abrir la app, se le **añaden películas reales** del Internet
 * Archive (ver `api/archive.ts` y `loadMovies`). Por eso el catálogo es una
 * lista viva: quien pinte algo sacado de aquí tiene que suscribirse con
 * `useCatalog()`, igual que con los textos y el idioma.
 *
 * Lo que **no** cambia es el orden: lo nuevo se añade al final, así que el
 * índice de un título sigue valiendo (es lo que mueve el reproductor).
 */
import {useSyncExternalStore} from 'react';
import {fetchMovies, fetchStream} from './api/archive';
import {fetchCatalogPage, fetchFacts} from './api/tmdb';
import type {Chapter, StoryboardSource} from 'react-native-video/controls';

export type Source = {
  /**
   * Los tres tipos del catálogo:
   *
   * - `movie`: película o vídeo suelto, se abre empotrado con su ficha.
   * - `episode`: capítulo de una serie; se abre inmersivo desde la ficha de la
   *   serie, que los agrupa (ver `SERIES`).
   * - `live`: canal en directo.
   */
  kind: 'live' | 'movie' | 'episode';
  label: string;
  title: string;
  description: string;
  /** Se pasa tal cual a <Video>; `metadata` alimenta los controles del sistema. */
  source: {
    uri: string;
    metadata?: {
      title?: string;
      subtitle?: string;
      artist?: string;
      /** Carátula de la notificación y de la pantalla de bloqueo. */
      imageUri?: string;
    };
  };
  /** Miniaturas para la vista previa de la barra (ver scripts/storyboard.swift). */
  storyboard?: StoryboardSource;
  /** Tramos con nombre: muescas en la barra y «Saltar intro» en los saltables. */
  chapters?: Chapter[];
  /** Serie a la que pertenece. Solo en los `episode`. */
  series?: {id: string; title: string; description: string};
  /** Temporada y número dentro de la serie. */
  episode?: {season: number; number: number};
  /** Carátula de verdad, cuando el título viene de archive.org. */
  poster?: string;
  /** Año de estreno, cuando se sabe (lo da el archivo o TMDb). */
  year?: number;
  /** Géneros de TMDb, ya traducidos. De aquí salen las filas por género. */
  genres?: string[];
  /** Fondo apaisado de TMDb: es lo que luce en el carrusel y en la ficha. */
  backdrop?: string;
  /**
   * Item de archive.org del que salió. Su `source.uri` empieza vacío: el vídeo
   * se pide al abrirlo (ver `ensureStream`).
   */
  archiveId?: string;
  /**
   * Título traído del catálogo de TMDb **para probar** (ver `loadTmdbCatalog`).
   * No tiene película detrás: se le pone un vídeo de muestra.
   */
  tmdbId?: number;
};

const OPEN_MOVIES = {
  id: 'open-movies',
  title: 'Open Movies',
  description:
    'Serie de ejemplo para el reproductor inmersivo: cada episodio se abre en horizontal a pantalla completa, con «Saltar intro», lista de episodios y tarjeta de siguiente episodio.',
};

const SOURCES: Source[] = [
  {
    kind: 'live',
    label: 'CANAL 1',
    title: 'Red Bull TV',
    description:
      'Canal lineal 24/7 (HLS multi-calidad). Emite siempre en directo, sin ventana DVR.',
    source: {
      uri: 'https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8',
      metadata: {title: 'Red Bull TV', subtitle: 'CANAL 1', artist: 'VideoApp'},
    },
  },
  {
    kind: 'live',
    label: 'CANAL 2',
    title: 'Unified Streaming — directo con DVR (~10 min)',
    description:
      'Directo con ventana DVR: badge EN VIVO, barra sobre la ventana y botón para volver al directo.',
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/live/stable/scte35.isml/.m3u8',
      metadata: {
        title: 'Unified Streaming — directo con DVR',
        subtitle: 'CANAL 2',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'live',
    label: 'CANAL 3',
    title: 'tagesschau (ARD)',
    description:
      'Canal de noticias 24/7, útil para ver el cambio de calidad en directo.',
    source: {
      uri: 'https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8',
      metadata: {
        title: 'tagesschau (ARD)',
        subtitle: 'CANAL 3',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'live',
    label: 'CANAL 4',
    title: 'Akamai — señal de pruebas',
    description:
      'Señal de pruebas en directo, estable: útil para dejarla sonando en el miniplayer.',
    source: {
      uri: 'https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8',
      metadata: {
        title: 'Akamai — señal de pruebas',
        subtitle: 'CANAL 4',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'HLS',
    title: 'Big Buck Bunny (HLS)',
    description:
      'VOD multi-calidad: menú de calidades, velocidad, saltos de ±10 s y vista previa al arrastrar.',
    source: {
      uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      metadata: {
        title: 'Big Buck Bunny (HLS)',
        subtitle: 'HLS',
        artist: 'VideoApp',
      },
    },
    storyboard: {
      image: require('./assets/storyboards/big-buck-bunny.jpg'),
      index: require('./assets/storyboards/big-buck-bunny.json'),
    },
    chapters: [
      {title: 'Intro', start: 0, end: 33, skippable: true},
      {title: 'El prado', start: 33, end: 190},
      {title: 'La emboscada', start: 190, end: 420},
      {title: 'La venganza', start: 420, end: 634},
    ],
  },
  {
    kind: 'movie',
    label: 'SUBS',
    title: 'Apple BipBop (HLS con subtítulos)',
    description:
      'Trae varias pistas de subtítulos dentro del propio stream: botón CC y lista en ⚙.',
    source: {
      uri: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
      metadata: {title: 'Apple BipBop', subtitle: 'SUBS', artist: 'VideoApp'},
    },
  },
  {
    kind: 'movie',
    label: 'AUDIO',
    title: 'Tears of Steel (varios idiomas)',
    description:
      'Trae audio en inglés y en italiano: fila «Audio» en ⚙ para cambiar de pista.',
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel-multi-lang.ism/.m3u8',
      metadata: {
        title: 'Tears of Steel',
        subtitle: 'AUDIO',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    // Para probar la recuperación de errores (el servidor responde 404).
    label: 'URL rota',
    title: 'URL inexistente (404)',
    description:
      'Para probar la recuperación: overlay de error y reintentos con backoff.',
    source: {
      uri: 'https://test-streams.mux.dev/no-existe/master.m3u8',
      metadata: {
        title: 'URL inexistente (404)',
        subtitle: 'URL rota',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 720p)',
    description:
      'MP4 progresivo: una sola calidad, sin menú, con vista previa.',
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
      metadata: {
        title: 'Big Buck Bunny (MP4 720p)',
        subtitle: 'MP4',
        artist: 'VideoApp',
      },
    },
    storyboard: {
      image: require('./assets/storyboards/big-buck-bunny-mp4.jpg'),
      index: require('./assets/storyboards/big-buck-bunny-mp4.json'),
    },
    chapters: [
      {title: 'Intro', start: 0, end: 33, skippable: true},
      {title: 'El prado', start: 33, end: 190},
      {title: 'La emboscada', start: 190, end: 420},
      {title: 'La venganza', start: 420, end: 634},
    ],
  },
  {
    kind: 'movie',
    label: 'SUBS+',
    title: 'Apple BipBop (avanzado)',
    description:
      'Variante avanzada del BipBop: más calidades y pistas de subtítulos que la básica.',
    source: {
      uri: 'https://d2zihajmogu5jn.cloudfront.net/bipbop-advanced/bipbop_16x9_variant.m3u8',
      metadata: {
        title: 'Apple BipBop (avanzado)',
        subtitle: 'SUBS+',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'HLS',
    title: 'Tears of Steel (HLS)',
    description:
      'Corto de 12 min en HLS multi-calidad: bueno para ver el cambio de resolución.',
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
      metadata: {
        title: 'Tears of Steel (HLS)',
        subtitle: 'HLS',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 25, skippable: true},
      {title: 'La persecución', start: 25, end: 400},
      {title: 'El desenlace', start: 400, end: 734},
    ],
  },
  {
    kind: 'movie',
    label: 'SUBS',
    title: 'Tears of Steel (con subtítulos)',
    description:
      'La misma película empaquetada con varias pistas de subtítulos dentro del stream.',
    source: {
      uri: 'https://test-streams.mux.dev/tos_ismc/main.m3u8',
      metadata: {
        title: 'Tears of Steel (subtítulos)',
        subtitle: 'SUBS',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'HLS',
    title: 'Mux — vídeo de muestra',
    description:
      'Clip corto servido por Mux: arranque rápido, útil para medir el tiempo de inicio.',
    source: {
      uri: 'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
      metadata: {
        title: 'Mux — vídeo de muestra',
        subtitle: 'HLS',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'PTS',
    title: 'Mux — desplazamiento de PTS',
    description:
      'Stream con los tiempos desplazados: comprueba que la barra y los saltos no se descuadran.',
    source: {
      uri: 'https://test-streams.mux.dev/pts_shift/master.m3u8',
      metadata: {
        title: 'Mux — desplazamiento de PTS',
        subtitle: 'PTS',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'HDR',
    title: 'Apple — Dolby Vision y Atmos',
    description:
      'Stream de referencia de Apple en HDR con audio Atmos. En emuladores puede no decodificar.',
    source: {
      uri: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/adv_dv_atmos/main.m3u8',
      metadata: {
        title: 'Apple — Dolby Vision y Atmos',
        subtitle: 'HDR',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'MP4',
    title: 'Popeye for President (1956)',
    description:
      'Dibujo animado de dominio público (archive.org). MP4 progresivo, sin menú de calidad.',
    source: {
      uri: 'https://archive.org/download/Popeye_forPresident/Popeye_forPresident_512kb.mp4',
      metadata: {
        title: 'Popeye for President',
        subtitle: 'MP4',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'movie',
    label: 'MP4',
    title: 'Archivo histórico (NARA)',
    description:
      'Material de dominio público de los archivos nacionales de EE. UU. (archive.org).',
    source: {
      uri: 'https://archive.org/download/gov.archives.arc.1257628/gov.archives.arc.1257628_512kb.mp4',
      metadata: {
        title: 'Archivo histórico (NARA)',
        subtitle: 'MP4',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T1:E1',
    title: 'Angel One',
    description:
      'Episodio corto (1 min): sirve para ver la tarjeta de siguiente episodio sin esperar. Trae audio en 5 idiomas y subtítulos en 4.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 1},
    source: {
      uri: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
      metadata: {
        title: 'Angel One',
        subtitle: 'Open Movies · T1:E1',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 10, skippable: true},
      {title: 'Episodio', start: 10, end: 60},
    ],
  },
  {
    kind: 'episode',
    label: 'T1:E2',
    title: 'Elephants Dream',
    description:
      'Episodio largo (11 min) en MP4 progresivo: reanudar donde lo dejaste y capítulos.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 2},
    source: {
      uri: 'https://archive.org/download/ElephantsDream/ed_hd.mp4',
      metadata: {
        title: 'Elephants Dream',
        subtitle: 'Open Movies · T1:E2',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 25, skippable: true},
      {title: 'La máquina', start: 25, end: 300},
      {title: 'El abismo', start: 300, end: 654},
    ],
  },
  {
    kind: 'episode',
    label: 'T1:E3',
    title: 'Sintel',
    description:
      'Último episodio (15 min): al acabar no hay siguiente, así que la tarjeta no sale.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 3},
    source: {
      uri: 'https://archive.org/download/Sintel/sintel-2048-surround.mp4',
      metadata: {
        title: 'Sintel',
        subtitle: 'Open Movies · T1:E3',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 20, skippable: true},
      {title: 'La búsqueda', start: 20, end: 420},
      {title: 'El reencuentro', start: 420, end: 888},
    ],
  },
  {
    kind: 'episode',
    label: 'T1:E4',
    title: 'El vagabundo',
    description:
      'Corto mudo de dominio público (archive.org). A partir de aquí la temporada se alarga a propósito: con la lista larga se ve el botón de temporada pegarse a la cabecera.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 4},
    source: {
      uri: 'https://archive.org/download/CC_1916_07_10_TheVagabond/CC_1916_07_10_TheVagabond_512kb.mp4',
      metadata: {
        title: 'El vagabundo',
        subtitle: 'Open Movies · T1:E4',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T1:E5',
    title: 'La cura',
    description:
      'Otro MP4 progresivo largo: sirve para dejar varios episodios a medias y ver cómo el botón grande elige por cuál seguir.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 5},
    source: {
      uri: 'https://archive.org/download/CC_1917_04_16_TheCure/CC_1917_04_16_TheCure_512kb.mp4',
      metadata: {
        title: 'La cura',
        subtitle: 'Open Movies · T1:E5',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T1:E6',
    title: 'El inmigrante',
    description:
      'Sin capítulos: la fila enseña la duración en cuanto se reproduce, y hasta entonces su etiqueta.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 6},
    source: {
      uri: 'https://archive.org/download/CC_1917_06_17_TheImmigrant/CC_1917_06_17_TheImmigrant_512kb.mp4',
      metadata: {
        title: 'El inmigrante',
        subtitle: 'Open Movies · T1:E6',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T1:E7',
    title: 'El aventurero',
    description:
      'Episodio de relleno de la temporada larga; también vale para comprobar que la lista de episodios del reproductor baja hasta el final.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 7},
    source: {
      uri: 'https://archive.org/download/CC_1917_10_22_TheAdventurer/CC_1917_10_22_TheAdventurer_512kb.mp4',
      metadata: {
        title: 'El aventurero',
        subtitle: 'Open Movies · T1:E7',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T1:E8',
    title: 'El bombero',
    description:
      'Cierre de la primera temporada: al acabar encadena con el siguiente episodio, que ya es de otra temporada.',
    series: OPEN_MOVIES,
    episode: {season: 1, number: 8},
    source: {
      uri: 'https://archive.org/download/CC_1916_06_12_TheFireman/CC_1916_06_12_TheFireman_512kb.mp4',
      metadata: {
        title: 'El bombero',
        subtitle: 'Open Movies · T1:E8',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T2:E1',
    title: 'Dark Truths',
    description:
      'Arranque de la segunda temporada en HLS: sirve para comprobar que el selector de temporada cambia la lista sin salir de la ficha.',
    series: OPEN_MOVIES,
    episode: {season: 2, number: 1},
    source: {
      uri: 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
      metadata: {
        title: 'Dark Truths',
        subtitle: 'Open Movies · T2:E1',
        artist: 'VideoApp',
      },
    },
    chapters: [{title: 'Intro', start: 0, end: 12, skippable: true}],
  },
  {
    kind: 'episode',
    label: 'T2:E2',
    title: 'BipBop avanzado (fMP4)',
    description:
      'Episodio en HLS con fragmentos fMP4 y varias calidades: el cambio de bitrate se ve en el menú ⚙ sin cortar la imagen.',
    series: OPEN_MOVIES,
    episode: {season: 2, number: 2},
    source: {
      uri: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
      metadata: {
        title: 'BipBop avanzado (fMP4)',
        subtitle: 'Open Movies · T2:E2',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T2:E3',
    title: 'Tears of Steel (HEVC)',
    description:
      'Cierre de temporada en HEVC: donde el dispositivo no lo soporte, el reproductor cae a la variante compatible.',
    series: OPEN_MOVIES,
    episode: {season: 2, number: 3},
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel-hevc.ism/.m3u8',
      metadata: {
        title: 'Tears of Steel (HEVC)',
        subtitle: 'Open Movies · T2:E3',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 18, skippable: true},
      {title: 'El plan', start: 18, end: 420},
      {title: 'La azotea', start: 420, end: 734},
    ],
  },
  {
    kind: 'episode',
    label: 'T3:E1',
    title: 'Big Buck Bunny',
    description:
      'Tercera temporada, en MP4 progresivo (10 min): el largo que mejor enseña reanudar donde lo dejaste.',
    series: OPEN_MOVIES,
    episode: {season: 3, number: 1},
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4',
      metadata: {
        title: 'Big Buck Bunny',
        subtitle: 'Open Movies · T3:E1',
        artist: 'VideoApp',
      },
    },
    chapters: [
      {title: 'Intro', start: 0, end: 33, skippable: true},
      {title: 'El prado', start: 33, end: 310},
      {title: 'La venganza', start: 310, end: 596},
    ],
  },
  {
    kind: 'episode',
    label: 'T3:E2',
    title: 'Popeye: I Don’t Scare',
    description:
      'Corto de dominio público (archive.org). Episodio breve para ver seguidas la tarjeta de siguiente episodio y la vuelta a la ficha.',
    series: OPEN_MOVIES,
    episode: {season: 3, number: 2},
    source: {
      uri: 'https://archive.org/download/popeye_i_dont_scare/popeye_i_dont_scare_512kb.mp4',
      metadata: {
        title: 'Popeye: I Don’t Scare',
        subtitle: 'Open Movies · T3:E2',
        artist: 'VideoApp',
      },
    },
  },
  {
    kind: 'episode',
    label: 'T3:E3',
    title: 'The Floorwalker',
    description:
      'Final de la temporada: cine mudo de dominio público, sin pista de audio con diálogo, útil para probar los subtítulos apagados.',
    series: OPEN_MOVIES,
    episode: {season: 3, number: 3},
    source: {
      uri: 'https://archive.org/download/CC_1916_05_15_TheFloorwalker/CC_1916_05_15_TheFloorwalker_512kb.mp4',
      metadata: {
        title: 'The Floorwalker',
        subtitle: 'Open Movies · T3:E3',
        artist: 'VideoApp',
      },
    },
  },
];

/**
 * Carátula para los controles del sistema, sacada de la propia URL: los vídeos
 * de archive.org tienen la miniatura que genera el archivo, y sin ella la
 * notificación sale con un hueco gris. Los de ejemplo que no son de ahí (y los
 * directos) se quedan sin carátula, que es lo que hay.
 */
const ARCHIVE_DOWNLOAD = /^https?:\/\/archive\.org\/download\/([^/]+)\//;
SOURCES.forEach((item, index) => {
  const id = ARCHIVE_DOWNLOAD.exec(item.source.uri)?.[1];
  if (!id || item.source.metadata?.imageUri) {
    return;
  }
  SOURCES[index] = {
    ...item,
    source: {
      ...item.source,
      metadata: {
        ...item.source.metadata,
        imageUri: `https://archive.org/services/img/${id}`,
      },
    },
  };
});

/** Entrada del catálogo junto con su índice global (el que usa el reproductor). */
export type IndexedSource = Source & {index: number};

const withIndex = (kind: Source['kind']): IndexedSource[] =>
  SOURCES.map((item, index) => ({...item, index})).filter(
    item => item.kind === kind,
  );

/**
 * Estas tres listas recorren el catálogo entero, y las pantallas las piden en
 * cada render. Se calculan una vez por revisión y se guardan: así da igual que
 * el catálogo pase de catorce títulos a doscientos.
 */
let derived: {
  revision: number;
  live?: IndexedSource[];
  movies?: IndexedSource[];
  series?: Series[];
} = {revision: -1};

function cache() {
  if (derived.revision !== revision) {
    derived = {revision};
  }
  return derived;
}

/** Canales de la pestaña «TV en vivo». */
export const liveChannels = () => (cache().live ??= withIndex('live'));
/** Películas y vídeos sueltos. */
export const movies = () => (cache().movies ??= withIndex('movie'));

export type Series = {
  id: string;
  title: string;
  description: string;
  episodes: IndexedSource[];
};

/** Series del catálogo, con sus episodios en orden. */
export const allSeries = (): Series[] =>
  (cache().series ??= withIndex('episode').reduce<Series[]>((list, item) => {
    const meta = item.series;
    if (!meta) {
      return list;
    }
    const found = list.find(candidate => candidate.id === meta.id);
    if (found) {
      found.episodes.push(item);
    } else {
      list.push({...meta, episodes: [item]});
    }
    return list;
  }, []));

export const seriesById = (id: string) =>
  allSeries().find(candidate => candidate.id === id);

/** Serie a la que pertenece un índice del catálogo, si es un episodio. */
export const seriesOf = (index: number | null) =>
  index === null ? undefined : seriesById(SOURCES[index].series?.id ?? '');

/** Pestaña a la que pertenece un índice del catálogo. */
export const isLive = (index: number | null) =>
  index !== null && SOURCES[index].kind === 'live';

/* --------------------------------------------------------------------------
 * El catálogo, como lista viva
 * ------------------------------------------------------------------------ */

const listeners = new Set<() => void>();
/** Sube cada vez que el catálogo cambia; es lo que miran los componentes. */
let revision = 0;

function changed() {
  revision += 1;
  listeners.forEach(listener => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Suscribe al componente a los cambios del catálogo (llegan películas nuevas,
 * se resuelve el vídeo de una). Devuelve la revisión, que no se usa para nada
 * salvo para provocar el repintado.
 */
export function useCatalog() {
  return useSyncExternalStore(
    subscribe,
    () => revision,
    () => revision,
  );
}

/** Estado de la carga del catálogo remoto, para poder enseñarlo. */
export type CatalogState = {loading: boolean; error: string | null};
let state: CatalogState = {loading: false, error: null};
export const catalogState = () => state;

/** Última página del archivo que se ha traído; 0 = ninguna todavía. */
let page = 0;

/**
 * Trae las películas de archive.org y las añade al final del catálogo. Si falla
 * (sin red, por ejemplo) se queda el catálogo de ejemplo y se guarda el error.
 */
export async function loadMovies(next = page === 0 ? 1 : page) {
  if (state.loading || next <= page) {
    return;
  }
  state = {loading: true, error: null};
  changed();
  try {
    const found = await fetchMovies(60, next);
    // Nada de duplicados si esto se vuelve a llamar tras un error.
    const known = new Set(SOURCES.map(item => item.archiveId));
    const fresh = found
      .filter(movie => !known.has(movie.id))
      .map<Source>(movie => ({
        kind: 'movie',
        label: movie.year ? String(movie.year) : 'ARCHIVE',
        title: movie.title,
        description:
          movie.description || 'Sin sinopsis en el Internet Archive.',
        poster: movie.poster,
        year: movie.year,
        archiveId: movie.id,
        // El vídeo se pide al abrirla; hasta entonces no hay uri.
        source: {
          uri: '',
          metadata: {
            title: movie.title,
            subtitle: movie.year ? String(movie.year) : undefined,
            artist: 'Internet Archive',
            // La notificación sin carátula sale con un hueco gris; esta es la
            // del propio archivo, y TMDb la cambia luego por el cartel.
            imageUri: movie.poster,
          },
        },
      }));
    SOURCES.push(...fresh);
    page = next;
    state = {loading: false, error: null};
    // Las fichas de TMDb van por detrás: la lista ya se puede pintar.
    enrichCatalog();
  } catch (error) {
    state = {loading: false, error: String((error as Error).message ?? error)};
  }
  changed();
}

/**
 * Pone cara al catálogo: por cada película del archivo pregunta a TMDb y, si
 * hay coincidencia clara, le cambia el cartel por el oficial y le añade los
 * géneros (de ahí salen las filas por género en Inicio).
 *
 * Va de cuatro en cuatro y en segundo plano: no hay prisa, y así ni se satura
 * la red del móvil ni se castiga a TMDb. Como las respuestas se guardan en
 * disco, en el siguiente arranque esto no toca la red.
 */
async function enrichCatalog() {
  const pending = SOURCES.map((item, index) => ({item, index})).filter(
    entry => entry.item.archiveId && !entry.item.genres,
  );

  for (let from = 0; from < pending.length; from += 4) {
    await Promise.all(
      pending.slice(from, from + 4).map(async ({item, index}) => {
        const facts = await fetchFacts(item.title, item.year);
        if (!facts) {
          // Sin ficha, que no se vuelva a intentar en esta sesión.
          SOURCES[index] = {...SOURCES[index], genres: []};
          return;
        }
        const poster = facts.poster ?? SOURCES[index].poster;
        SOURCES[index] = {
          ...SOURCES[index],
          poster,
          // El cartel oficial manda también en la notificación.
          source: {
            ...SOURCES[index].source,
            metadata: {...SOURCES[index].source.metadata, imageUri: poster},
          },
          backdrop: facts.backdrop,
          year: facts.year ?? SOURCES[index].year,
          genres: facts.genres,
          description: facts.overview ?? SOURCES[index].description,
          label: String(facts.year ?? SOURCES[index].label),
        };
      }),
    );
    changed();
  }
}

/** Siguiente página del archivo: es lo que hace el botón «cargar más». */
export const loadMoreMovies = () => loadMovies(page + 1);

/**
 * Deja listo el vídeo de un título del archivo. Devuelve cuando `source.uri` ya
 * vale, o lanza si ese item no tiene MP4.
 */
export async function ensureStream(index: number) {
  const item = SOURCES[index];
  if (!item?.archiveId || item.source.uri) {
    return;
  }
  const uri = await fetchStream(item.archiveId);
  SOURCES[index] = {...item, source: {...item.source, uri}};
  changed();
}

export default SOURCES;

/**
 * Catálogo de pruebas: miles de fichas reales de TMDb.
 *
 * Esto **no** se carga solo: se pide a mano desde Diagnóstico (pestaña Perfil).
 * Sirve para ver la app llena —filas por género, rejillas largas, carátulas de
 * verdad, scroll de los de verdad— sin depender de lo poco que trae el archivo.
 *
 * Cada ficha lleva un **vídeo de muestra** en rotación, porque TMDb no sirve
 * vídeo (ver `api/tmdb.ts`): la ficha es real y la película no, así que tocar
 * play reproduce otra cosa. Es para probar, no para publicar.
 */
const DEMO_STREAMS = [
  'https://archive.org/download/BigBuckBunny_328/BigBuckBunny_512kb.mp4',
  'https://archive.org/download/ElephantsDream/ed_hd.mp4',
  'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
  'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
  'https://stream.mux.com/v69RSHhFelSm4701snP22dYz2jICy4E4FUyk02rW4gxRM.m3u8',
];

/** Última página de TMDb traída; 0 = ninguna. */
let tmdbPage = 0;

/** Cuántas páginas (de 20 títulos) se traen de una vez. */
const TMDB_BATCH = 5;

/** Cuántos títulos de TMDb hay ya en el catálogo. */
export const tmdbCount = () =>
  SOURCES.reduce((total, item) => total + (item.tmdbId ? 1 : 0), 0);

/**
 * Trae el siguiente tramo del catálogo de TMDb y lo añade al final. Las filas
 * por género de Inicio salen solas: cada ficha ya viene con sus géneros.
 */
export async function loadTmdbCatalog() {
  if (state.loading) {
    return;
  }
  state = {loading: true, error: null};
  changed();
  try {
    const known = new Set(SOURCES.map(item => item.tmdbId));
    for (let step = 0; step < TMDB_BATCH; step++) {
      const found = await fetchCatalogPage(tmdbPage + 1);
      const fresh = found
        .filter(movie => !known.has(movie.tmdbId))
        .map<Source>((movie, order) => {
          const uri =
            DEMO_STREAMS[(SOURCES.length + order) % DEMO_STREAMS.length] ?? '';
          return {
            kind: 'movie',
            label: movie.year ? String(movie.year) : 'TMDB',
            title: movie.title,
            description: movie.overview ?? '',
            poster: movie.poster,
            backdrop: movie.backdrop,
            year: movie.year,
            genres: movie.genres,
            tmdbId: movie.tmdbId,
            source: {
              uri,
              metadata: {
                title: movie.title,
                subtitle: movie.year ? String(movie.year) : undefined,
                artist: 'TMDb (pruebas)',
                imageUri: movie.poster,
              },
            },
          };
        });
      fresh.forEach(item => known.add(item.tmdbId));
      SOURCES.push(...fresh);
      tmdbPage += 1;
      // Se avisa en cada página: la lista crece a la vista en vez de aparecer
      // entera al final.
      changed();
    }
    state = {loading: false, error: null};
  } catch (error) {
    state = {loading: false, error: String((error as Error).message ?? error)};
  }
  changed();
}
