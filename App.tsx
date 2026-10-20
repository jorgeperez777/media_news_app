import React, {useCallback, useEffect, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import FadeIn from './components/FadeIn';
import PlayerHost from './components/PlayerHost';
import Sheet from './components/Sheet';
import TabBar, {type TabKey} from './components/TabBar';
import {PlayerProvider, usePlayer} from './player/PlayerContext';
import {setLanguage, useLanguage} from './i18n';
import {setControlsLanguage} from 'react-native-video/controls';
import {loadLanguage} from './player/storage';
import {isLive, loadMovies, seriesById} from './sources';
import DetailScreen from './screens/DetailScreen';
import DiagnosticsScreen from './screens/DiagnosticsScreen';
import FavouritesScreen from './screens/FavouritesScreen';
import HomeScreen from './screens/HomeScreen';
import CategoryScreen, {type Category} from './screens/CategoryScreen';
import SeriesScreen from './screens/SeriesScreen';
import LiveScreen from './screens/LiveScreen';
import NewsScreen from './screens/NewsScreen';
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
  const [tab, setTab] = useState<TabKey>('inicio');
  // Todo el árbol cuelga de aquí: suscribirse al idioma basta para que al
  // cambiarlo se repinte la app entera.
  const language = useLanguage();
  // Los controles del reproductor traen sus propios textos (viven en la
  // librería, ver `react-native-video/controls`): aquí solo se les dice en qué
  // idioma va la app.
  useEffect(() => setControlsLanguage(language), [language]);
  // El idioma elegido se recuerda; hasta que llega, manda el del dispositivo.
  useEffect(() => {
    loadLanguage().then(setLanguage);
    // Películas reales del Internet Archive, al final del catálogo de ejemplo.
    // Si falla no pasa nada: la app se queda con lo que trae de serie.
    loadMovies();
  }, []);
  // Fichas abiertas dentro de la pestaña (una pila de dos niveles): la de una
  // serie o la de una película. Ninguna de las dos lleva reproductor: se mira la
  // ficha y, al dar a reproducir, el vídeo se abre en horizontal.
  const [seriesId, setSeriesId] = useState<string | null>(null);
  const [movie, setMovie] = useState<number | null>(null);
  // Categoría abierta con «Ver todo» (Películas, Series o En directo). Queda por
  // debajo de las fichas: al cerrar una se vuelve aquí, no a Inicio.
  const [category, setCategory] = useState<Category | null>(null);
  // Noticia abierta dentro de la pestaña Noticias (ver `news.ts`).
  const [news, setNews] = useState<string | null>(null);
  const series = seriesId ? seriesById(seriesId) : undefined;
  // Estables: si cambiaran en cada render, el BackHandler de la ficha se volvería
  // a registrar sin parar.
  const closeSeries = useCallback(() => setSeriesId(null), []);
  const closeMovie = useCallback(() => setMovie(null), []);
  const closeCategory = useCallback(() => setCategory(null), []);
  const closeNews = useCallback(() => setNews(null), []);

  // Inicio es el catálogo entero (películas, series y directos); las fichas se
  // abren dentro de esa pestaña.
  const vodTab = tab === 'inicio';

  // La ficha de película se abre desde una carátula, no por tener el vídeo
  // sonando: el reproductor ya no vive aquí dentro.
  const showDetail = vodTab && movie !== null && !series;
  // El reproductor tapa la app entera: fuera barra de pestañas e insets.
  const covering =
    player.mode !== 'mini' &&
    (player.fullscreen || player.pip || player.presentation === 'immersive');

  /** Si esa pestaña es «la casa» de lo que está abierto en el reproductor. */
  const isHomeFor = (next: TabKey) =>
    isLive(player.index) ? next === 'noticias' : next === 'inicio';

  /** Cambiar de pestaña, venga de la barra o de un botón de una pantalla. */
  const goTo = (next: TabKey) => {
    // Cambiar de pestaña cierra las fichas: cada pestaña empieza en su raíz.
    setSeriesId(null);
    setMovie(null);
    setCategory(null);
    setNews(null);
    if (player.index !== null && !isHomeFor(next)) {
      // Ir a una pestaña que no es la suya lo deja en miniplayer; si no, el
      // vídeo taparía la pestaña nueva.
      //
      // Y volver a la suya **no lo vuelve a abrir**: un canal se abre en
      // inmersivo, así que expandirlo es ponerlo a pantalla completa, y quien
      // acaba de mandarlo al miniplayer está navegando, no pidiendo vídeo. Se
      // sale del mini con su propio botón, que para eso está.
      player.minimize();
    }
    setTab(next);
  };

  /**
   * Lo que va **encima** de la pantalla de la pestaña: la ficha, la rejilla de
   * «Ver todo» o la noticia. Se monta aparte para que la de abajo siga viva y
   * conserve su scroll.
   */
  const vodOverlay = showDetail ? (
    <DetailScreen index={movie} onBack={closeMovie} onOpenMovie={setMovie} />
  ) : series ? (
    <SeriesScreen
      series={series}
      onBack={closeSeries}
      onOpenSeries={setSeriesId}
      onOpenMovie={setMovie}
    />
  ) : category ? (
    <CategoryScreen
      category={category}
      onBack={closeCategory}
      onOpenMovie={setMovie}
      onOpenSeries={setSeriesId}
    />
  ) : null;

  const newsOverlay =
    news !== null ? (
      <NewsScreen id={news} onBack={closeNews} />
    ) : category ? (
      <CategoryScreen
        category={category}
        onBack={closeCategory}
        onOpenMovie={setMovie}
        onOpenSeries={setSeriesId}
      />
    ) : null;

  return (
    <View style={styles.root} ref={player.rootRef} collapsable={false}>
      <SafeAreaView
        style={styles.screens}
        // En pantalla completa / PiP manda el reproductor con sus propios insets;
        // abajo manda la barra de pestañas, que ya aplica el inset inferior.
        edges={covering ? [] : ['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" />
        {/* `key={tab}`: al cambiar de pestaña se monta otro y la entrada se
            repite (ver `FadeIn`). */}
        <FadeIn key={tab} style={styles.screens}>
          {tab === 'noticias' ? (
            // Noticias también es una pila: la guía abajo y, encima, la noticia o
            // la rejilla de canales.
            <View style={styles.stack}>
              <LiveScreen
                onSeeAll={() => setCategory('live')}
                onOpenNews={setNews}
              />
              <Sheet>{newsOverlay}</Sheet>
            </View>
          ) : vodTab ? (
            // Inicio **no se desmonta** al abrir una ficha: la ficha se pone
            // encima. Si se desmontara, al volver la portada empezaría otra vez
            // desde arriba y se perdería por dónde iba el scroll.
            <View style={styles.stack}>
              <HomeScreen
                onOpenSeries={setSeriesId}
                onOpenMovie={setMovie}
                onSeeAll={setCategory}
                // Tapada no tiene que seguir pasando destacados sola.
                active={!vodOverlay}
              />
              <Sheet>{vodOverlay}</Sheet>
            </View>
          ) : tab === 'favoritos' ? (
            <FavouritesScreen
              onOpenSeries={setSeriesId}
              onOpenMovie={setMovie}
              // Una noticia guardada se lee en su pestaña, no aquí.
              onOpenNews={id => {
                setNews(id);
                setTab('noticias');
              }}
            />
          ) : tab === 'perfil' ? (
            <DiagnosticsScreen />
          ) : (
            <PlaceholderScreen tab={tab} />
          )}
        </FadeIn>
      </SafeAreaView>

      {!covering && <TabBar active={tab} onChange={goTo} />}

      <PlayerHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0f0f0f'},
  screens: {flex: 1},
  stack: {flex: 1},
});
