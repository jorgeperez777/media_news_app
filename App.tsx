import React from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import PlayerHost from './components/PlayerHost';
import {PlayerProvider, usePlayer} from './player/PlayerContext';
import DetailScreen from './screens/DetailScreen';
import ListScreen from './screens/ListScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <PlayerProvider>
        <Main />
      </PlayerProvider>
    </SafeAreaProvider>
  );
}

/**
 * Raíz de la app: las pantallas se intercambian debajo y el reproductor vive
 * fuera de ellas, en `PlayerHost`, para que no se desmonte al navegar. Si más
 * adelante se añade react-navigation, el host sigue igual: fuera del navigator.
 */
function Main() {
  const player = usePlayer();
  const showDetail = player.index !== null && player.mode === 'full';

  return (
    <View style={styles.root} ref={player.rootRef} collapsable={false}>
      <SafeAreaView
        style={styles.screens}
        // En pantalla completa / PiP manda el reproductor con sus propios insets.
        edges={
          player.fullscreen || player.pip ? [] : ['top', 'bottom', 'left', 'right']
        }>
        <StatusBar barStyle="light-content" />
        {showDetail ? <DetailScreen /> : <ListScreen />}
      </SafeAreaView>

      <PlayerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0f0f0f'},
  screens: {flex: 1},
});
