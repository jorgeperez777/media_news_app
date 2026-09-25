import React, {useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import PlayerHost from './components/PlayerHost';
import TabBar, {type TabKey} from './components/TabBar';
import {PlayerProvider, usePlayer} from './player/PlayerContext';
import {isLive} from './sources';
import DetailScreen from './screens/DetailScreen';
import ListScreen from './screens/ListScreen';
import LiveScreen from './screens/LiveScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';

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
 * Raíz de la app: pestañas abajo, pantallas en medio y el reproductor fuera de
 * todas ellas, en `PlayerHost`, para que no se desmonte al cambiar de pestaña.
 * Si más adelante se añade react-navigation, el host sigue igual: fuera del
 * navigator.
 */
function Main() {
  const player = usePlayer();
  const [tab, setTab] = useState<TabKey>('videos');

  const showDetail =
    tab === 'videos' &&
    player.index !== null &&
    !isLive(player.index) &&
    player.mode === 'full';
  const immersive = player.fullscreen || player.pip;

  /** Pestaña a la que pertenece lo que está abierto en el reproductor. */
  const homeTab: TabKey = isLive(player.index) ? 'envivo' : 'videos';

  return (
    <View style={styles.root} ref={player.rootRef} collapsable={false}>
      <SafeAreaView
        style={styles.screens}
        // En pantalla completa / PiP manda el reproductor con sus propios insets;
        // abajo manda la barra de pestañas, que ya aplica el inset inferior.
        edges={immersive ? [] : ['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        {tab === 'envivo' ? (
          <LiveScreen />
        ) : tab === 'videos' ? (
          showDetail ? (
            <DetailScreen />
          ) : (
            <ListScreen />
          )
        ) : (
          <PlaceholderScreen tab={tab} />
        )}
      </SafeAreaView>

      {!immersive && (
        <TabBar
          active={tab}
          onChange={next => {
            if (player.index !== null) {
              if (next !== homeTab) {
                // Ir a una pestaña que no es la suya lo deja en miniplayer; si no,
                // el vídeo taparía la pestaña nueva.
                player.minimize();
              } else if (next === 'envivo') {
                // Volver a TV en vivo vuelve a acoplar el canal arriba.
                player.expand();
              }
            }
            setTab(next);
          }}
        />
      )}

      <PlayerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0f0f0f'},
  screens: {flex: 1},
});
