// Fuentes de prueba públicas (verificadas con HTTP 200).
export type Source = {
  label: string;
  title: string;
  description: string;
  source: {uri: string};
};

const SOURCES: Source[] = [
  {
    label: 'EN VIVO',
    title: 'Unified Streaming — directo (HLS, DVR ~10 min)',
    description: 'Directo con ventana DVR: badge EN VIVO, barra sobre la ventana y vuelta al directo.',
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/live/stable/scte35.isml/.m3u8',
    },
  },
  {
    label: 'HLS',
    title: 'Big Buck Bunny (HLS)',
    description: 'VOD multi-calidad: menú de calidades, velocidad y saltos de ±10 s.',
    source: {uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'},
  },
  {
    // Para probar la recuperación de errores (el servidor responde 404).
    label: 'URL rota',
    title: 'URL inexistente (404)',
    description: 'Para probar la recuperación: overlay de error y reintentos con backoff.',
    source: {uri: 'https://test-streams.mux.dev/no-existe/master.m3u8'},
  },
  {
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 720p)',
    description: 'MP4 progresivo: una sola calidad, sin menú.',
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    },
  },
];

export default SOURCES;
