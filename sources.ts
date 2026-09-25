// Fuentes de prueba públicas (verificadas con HTTP 200).
export type Source = {
  /** 'live' sale en la pestaña TV en vivo; 'vod' en la lista de vídeos. */
  kind: 'live' | 'vod';
  label: string;
  title: string;
  description: string;
  source: {uri: string};
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
    },
  },
  {
    kind: 'live',
    label: 'CANAL 3',
    title: 'tagesschau (ARD)',
    description: 'Canal de noticias 24/7, útil para ver el cambio de calidad en directo.',
    source: {
      uri: 'https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8',
    },
  },
  {
    kind: 'vod',
    label: 'HLS',
    title: 'Big Buck Bunny (HLS)',
    description: 'VOD multi-calidad: menú de calidades, velocidad y saltos de ±10 s.',
    source: {uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'},
  },
  {
    kind: 'vod',
    // Para probar la recuperación de errores (el servidor responde 404).
    label: 'URL rota',
    title: 'URL inexistente (404)',
    description: 'Para probar la recuperación: overlay de error y reintentos con backoff.',
    source: {uri: 'https://test-streams.mux.dev/no-existe/master.m3u8'},
  },
  {
    kind: 'vod',
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 720p)',
    description: 'MP4 progresivo: una sola calidad, sin menú.',
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    },
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
