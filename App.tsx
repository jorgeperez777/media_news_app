import React, {useState} from 'react';
import {Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
import {
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import VideoPlayer from './components/VideoPlayer';

// Fuentes de prueba públicas (verificadas con HTTP 200).
const SOURCES = [
  {
    label: 'EN VIVO',
    title: 'Unified Streaming — directo (HLS, DVR ~10 min)',
    source: {
      uri: 'https://demo.unified-streaming.com/k8s/live/stable/scte35.isml/.m3u8',
    },
  },
  {
    label: 'HLS',
    title: 'Big Buck Bunny (HLS)',
    source: {uri: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'},
  },
  {
    // Para probar la recuperación de errores (el servidor responde 404).
    label: 'URL rota',
    title: 'URL inexistente (404)',
    source: {uri: 'https://test-streams.mux.dev/no-existe/master.m3u8'},
  },
  {
    label: 'MP4',
    title: 'Big Buck Bunny (MP4 720p)',
    source: {
      uri: 'https://archive.org/download/BigBuckBunny_124/Content/big_buck_bunny_720p_surround.mp4',
    },
  },
];

export default function App() {
  return (
    <SafeAreaProvider>
      <Main />
    </SafeAreaProvider>
  );
}

function Main() {
  const [sourceIndex, setSourceIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [pip, setPip] = useState(false);
  const current = SOURCES[sourceIndex];

  const switchSource = () => {
    setError(null);
    setSourceIndex(i => (i + 1) % SOURCES.length);
  };

  return (
    <SafeAreaView
      style={styles.container}
      // En fullscreen el reproductor gestiona sus propios insets.
      edges={fullscreen || pip ? [] : ['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" />

      <VideoPlayer
        key={sourceIndex}
        source={current.source}
        title={current.title}
        style={styles.player}
        onError={setError}
        onFullscreenChange={setFullscreen}
        onPipChange={setPip}
      />

      <View style={styles.info} pointerEvents={fullscreen || pip ? 'none' : 'auto'}>
        <Text style={styles.heading}>{current.title}</Text>
        <Text style={styles.hint}>
          Tap: mostrar/ocultar controles · Doble tap en los lados: ±10 s ·
          Arrastra la barra roja para buscar
        </Text>
        <Pressable
          onPress={switchSource}
          style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>Cambiar fuente ({current.label})</Text>
        </Pressable>
        {error ? <Text style={styles.error}>Error: {error}</Text> : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  player: {width: '100%', aspectRatio: 16 / 9},
  info: {padding: 16, gap: 10},
  heading: {color: '#fff', fontSize: 18, fontWeight: '600'},
  hint: {color: '#aaa', fontSize: 13, lineHeight: 18},
  button: {
    alignSelf: 'flex-start',
    backgroundColor: '#272727',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    marginTop: 4,
  },
  buttonPressed: {opacity: 0.6},
  buttonText: {color: '#fff', fontWeight: '600'},
  error: {color: '#f66'},
});
