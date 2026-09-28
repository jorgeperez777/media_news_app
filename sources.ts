// Fuentes de prueba públicas (verificadas con HTTP 200).
import type {Chapter} from './components/VideoPlayer';
import type {StoryboardSource} from './components/useStoryboard';

export type Source = {
  /** 'live' sale en la pestaña TV en vivo; 'vod' en la lista de vídeos. */
  kind: 'live' | 'vod';
  label: string;
  title: string;
  description: string;
  /** Se pasa tal cual a <Video>; `metadata` alimenta los controles del sistema. */
  source: {
    uri: string;
    metadata?: {title?: string; subtitle?: string; artist?: string};
  };
  /** Miniaturas para la vista previa de la barra (ver scripts/storyboard.swift). */
  storyboard?: StoryboardSource;
  /** Tramos con nombre: muescas en la barra y «Saltar intro» en los saltables. */
  chapters?: Chapter[];
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
      metadata: {title: 'Unified Streaming — directo con DVR', subtitle: 'CANAL 2', artist: 'VideoApp'},
    },
  },
  {
    kind: 'live',
    label: 'CANAL 3',
    title: 'tagesschau (ARD)',
    description: 'Canal de noticias 24/7, útil para ver el cambio de calidad en directo.',
    source: {
      uri: 'https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8',
      metadata: {title: 'tagesschau (ARD)', subtitle: 'CANAL 3', artist: 'VideoApp'},
    },
  },
  {
    kind: 'vod',
    label: 'HLS',
    title: 'Big Buck Bunny (HLS)',
    description:
      'VOD multi-calidad: menú de calidades, velocidad, saltos de ±10 s y vista previa al arrastrar.',
    source: {
      uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      metadata: {title: 'Big Buck Bunny (HLS)', subtitle: 'HLS', artist: 'VideoApp'},
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
    kind: 'vod',
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
    kind: 'vod',
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
    kind: 'vod',
    // Para probar la recuperación de errores (el servidor responde 404).
    label: 'URL rota',
    title: 'URL inexistente (404)',
    description: 'Para probar la recuperación: overlay de error y reintentos con backoff.',
    source: {
      uri: 'https://test-streams.mux.dev/no-existe/master.m3u8',
      metadata: {title: 'URL inexistente (404)', subtitle: 'URL rota', artist: 'VideoApp'},
    },
  },
  {
    kind: 'vod',
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 720p)',
    description: 'MP4 progresivo: una sola calidad, sin menú, con vista previa.',
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
      metadata: {title: 'Big Buck Bunny (MP4 720p)', subtitle: 'MP4', artist: 'VideoApp'},
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
];

/** Entrada del catálogo junto con su índice global (el que usa el reproductor). */
export type IndexedSource = Source & {index: number};

const withIndex = (kind: Source['kind']): IndexedSource[] =>
  SOURCES.map((item, index) => ({...item, index})).filter(
    item => item.kind === kind,
  );

/** Canales de la pestaña «TV en vivo». */
export const LIVE_CHANNELS = withIndex('live');
/** Vídeos a la carta de la pestaña «Vídeos». */
export const VOD_ITEMS = withIndex('vod');

/** Pestaña a la que pertenece un índice del catálogo. */
export const isLive = (index: number | null) =>
  index !== null && SOURCES[index].kind === 'live';

export default SOURCES;
