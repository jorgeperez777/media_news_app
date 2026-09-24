import React, {useCallback, useEffect, useRef} from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import SOURCES from '../sources';
import {usePlayer} from '../player/PlayerContext';

/**
 * Pantalla de detalle. No renderiza el reproductor: solo reserva su hueco y le
 * dice a `PlayerHost` dónde dibujarlo (el vídeo vive en la raíz para que el
 * miniplayer no lo desmonte).
 */
export default function DetailScreen() {
  const player = usePlayer();
  const boxRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const index = player.index ?? 0;
  const current = SOURCES[index];

  const measure = useCallback(() => {
    const root = player.rootRef.current;
    const box = boxRef.current;
    if (!root || !box) {
      return;
    }
    box.measureLayout(
      root,
      (x, y, width, height) => {
        if (width && height) {
          player.setAnchor({x, y, width, height});
        }
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // El hueco puede acabar en otro sitio sin que su propio layout cambie (los insets
  // llegan después del primer render, o rota la pantalla): volver a medir entonces.
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure, insets.top, insets.bottom, windowWidth, windowHeight]);

  // Atrás minimiza, como en YouTube (en pantalla completa manda el reproductor,
  // que registra su propio handler después que este y por tanto se ejecuta antes).
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (player.fullscreen) {
        return false;
      }
      player.minimize();
      return true;
    });
    return () => sub.remove();
  }, [player]);

  return (
    <View style={styles.container}>
      <View ref={boxRef} style={styles.playerBox} onLayout={measure} />

      <ScrollView contentContainerStyle={styles.info}>
        <Text style={styles.heading}>{current.title}</Text>
        <Text style={styles.description}>{current.description}</Text>
        <Text style={styles.hint}>
          Tap: mostrar/ocultar controles · Doble tap en los lados: ±10 s ·
          Arrastra la barra roja para buscar · ⏮ ⏭ cambian de vídeo (
          {index + 1}/{SOURCES.length}) · Arrastra el vídeo hacia abajo para el
          miniplayer
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={player.minimize}
            style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Minimizar</Text>
          </Pressable>
          <Pressable
            onPress={player.close}
            style={({pressed}) => [styles.button, pressed && styles.buttonPressed]}>
            <Text style={styles.buttonText}>Cerrar</Text>
          </Pressable>
        </View>
        {player.error ? (
          <Text style={styles.error}>Error: {player.error}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  playerBox: {width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000'},
  info: {padding: 16, gap: 10},
  heading: {color: '#fff', fontSize: 18, fontWeight: '600'},
  description: {color: '#ccc', fontSize: 13, lineHeight: 18},
  hint: {color: '#aaa', fontSize: 13, lineHeight: 18},
  actions: {flexDirection: 'row', gap: 10, marginTop: 4},
  button: {
    backgroundColor: '#272727',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  buttonPressed: {opacity: 0.6},
  buttonText: {color: '#fff', fontWeight: '600'},
  error: {color: '#f66'},
});
