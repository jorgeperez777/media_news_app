import React, {useCallback, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import PlayerHost from './components/PlayerHost';
import TabBar, {type TabKey} from './components/TabBar';
import {PlayerProvider, usePlayer} from './player/PlayerContext';
import {isLive, seriesById} from './sources';
import DetailScreen from './screens/DetailScreen';
import DiagnosticsScreen from './screens/DiagnosticsScreen';
import ListScreen from './screens/ListScreen';
import SeriesScreen from './screens/SeriesScreen';
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
  // Ficha de serie abierta dentro de la pestaña Vídeos (una pila de dos niveles).
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const series = seriesId ? seriesById(seriesId) : undefined;
  // Estable: si cambiara en cada render, el BackHandler de la ficha se volvería a
  // registrar sin parar.
  const closeSeries = useCallback(() => setSeriesId(null), []);

  const showDetail =
    tab === 'videos' &&
    player.index !== null &&
    !isLive(player.index) &&
    player.mode === 'full' &&
    // Los episodios no se empotran: se abren a pantalla completa sobre la ficha.
    player.presentation === 'inline';
  // El reproductor tapa la app entera: fuera barra de pestañas e insets.
  const covering =
    player.fullscreen || player.pip || player.presentation === 'immersive';

  /** Pestaña a la que pertenece lo que está abierto en el reproductor. */
  const homeTab: TabKey = isLive(player.index) ? 'envivo' : 'videos';

  return (
    <View style={styles.root} ref={player.rootRef} collapsable={false}>
      <SafeAreaView
        style={styles.screens}
        // En pantalla completa / PiP manda el reproductor con sus propios insets;
        // abajo manda la barra de pestañas, que ya aplica el inset inferior.
        edges={covering ? [] : ['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        {tab === 'envivo' ? (
          <LiveScreen />
        ) : tab === 'videos' ? (
          showDetail ? (
            <DetailScreen />
          ) : series ? (
            <SeriesScreen series={series} onBack={closeSeries} />
          ) : (
            <ListScreen onOpenSeries={setSeriesId} />
          )
        ) : tab === 'perfil' ? (
          <DiagnosticsScreen />
        ) : (
          <PlaceholderScreen tab={tab} />
        )}
      </SafeAreaView>

      {!covering && (
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
