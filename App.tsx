import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StatusBar, StyleSheet, View} from 'react-native';
import {SafeAreaProvider, SafeAreaView} from 'react-native-safe-area-context';
import FadeIn from './components/FadeIn';
import PlayerHost from './components/PlayerHost';
import Sheet from './components/Sheet';
import Underlay from './components/Underlay';
import TabBar, {type TabKey} from './components/TabBar';
import {PlayerProvider, usePlayer} from './player/PlayerContext';
import {setLanguage, useLanguage} from './i18n';
import {
  setControlsFont,
  setControlsLanguage,
} from 'react-native-video/controls';
import {loadLanguage} from './player/storage';
import {
  hydrateCatalog,
  hydrateSeries,
  isLive,
  loadMovies,
  seriesById,
} from './sources';
import DetailScreen from './screens/DetailScreen';
import DiagnosticsScreen from './screens/DiagnosticsScreen';
import ProfileScreen from './screens/ProfileScreen';
import FavouritesScreen from './screens/FavouritesScreen';
import HomeScreen from './screens/HomeScreen';
import CategoryScreen, {type Category} from './screens/CategoryScreen';
import SeriesScreen from './screens/SeriesScreen';
import LiveScreen from './screens/LiveScreen';
import NewsHomeScreen from './screens/NewsHomeScreen';
import NewsScreen from './screens/NewsScreen';
import PlaceholderScreen from './screens/PlaceholderScreen';
import {FONT} from './theme';

// Los controles del reproductor, con la misma letra que la app (ver `FONT`).
setControlsFont(FONT);

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
    // Primero lo que ya se trajo la última vez, que está en disco y aparece
    // sin red; después, si hace falta, el archivo. En ese orden: con el
    // listado guardado al día, `loadMovies` no pide nada.
    //
    // Si falla no pasa nada: la app se queda con lo que trae de serie.
    hydrateCatalog().then(() => loadMovies());
    // Las series de TMDb que se trajeron alguna vez (ver `loadTmdbSeries`).
    hydrateSeries();
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
  // Diagnóstico, abierto encima de Perfil.
  const [diagnostics, setDiagnostics] = useState(false);
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

  // El reproductor tapa la app entera: fuera barra de pestañas e insets.
  const covering =
    player.mode !== 'mini' &&
    (player.fullscreen || player.pip || player.presentation === 'immersive');

  /** Si esa pestaña es «la casa» de lo que está abierto en el reproductor. */
  const isHomeFor = (next: TabKey) =>
    isLive(player.index) ? next === 'envivo' : next === 'inicio';

  /** Cambiar de pestaña, venga de la barra o de un botón de una pantalla. */
  const goTo = (next: TabKey) => {
    // Cambiar de pestaña cierra las fichas: cada pestaña empieza en su raíz.
    setSeriesId(null);
    setMovie(null);
    setCategory(null);
    setNews(null);
    setDiagnostics(false);
    if (player.index !== null && !isHomeFor(next)) {
      // Ir a una pestaña que no es la suya lo deja en miniplayer; si no, el
      // vídeo taparía la pestaña nueva.
      player.minimize();
    } else if (isLive(player.index) && player.mode === 'mini' && !player.pip) {
      // Y un canal que vuelve a la guía vuelve a su hueco de arriba: con el
      // mini y el hueco a la vez se veía «sonando en la miniatura» encima de
      // la propia miniatura.
      player.expand();
    }
    setTab(next);
  };

  // Por lo mismo, el ⌄ en la guía no deja el mini sobre ella: lo manda a
  // Inicio, como YouTube, para seguir navegando con el canal sonando abajo.
  useEffect(() => {
    if (
      player.mode === 'mini' &&
      tab === 'envivo' &&
      !category &&
      isLive(player.index) &&
      !player.pip
    ) {
      goTo('inicio');
    }
    // Solo importa el paso a mini; el resto se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.mode]);

  /**
   * Expandir desde el miniplayer abre el vídeo a pantalla completa.
   *
   * Empotrado, el reproductor se dibuja en el hueco que publica su pantalla (la
   * guía de TV en vivo, la ficha de una película). Desde otra pestaña ese hueco
   * no existe y caía arriba del todo, encima de lo que hubiera. Ahí se pide su
   * pantalla completa de siempre (la del ⤢, con su ⌄ para volver al mini). Si
   * el hueco sí está —en la propia guía—, vuelve a él. Un inmersivo ya se
   * expande a pantalla completa de por sí.
   */
  const wasMini = useRef(false);
  useEffect(() => {
    if (player.mode === 'mini') {
      wasMini.current = true;
      return;
    }
    if (!wasMini.current || player.index === null) {
      return;
    }
    wasMini.current = false;
    // Sin hueco donde dibujarse (se expande desde otra pestaña), la pantalla
    // completa del propio reproductor, la del ⤢, con su ⌄ para volver al mini.
    // En la guía de TV en vivo el hueco acaba de publicarse y aún no se ve
    // aquí (`player.anchor` es el de antes de entrar): ahí vuelve a él.
    const toGuide = isLive(player.index) && tab === 'envivo';
    if (
      player.presentation === 'inline' &&
      player.anchor === null &&
      !toGuide
    ) {
      player.setFullscreen(true);
    }
    // Solo importa el paso de mini a grande; el resto se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.mode]);

  // Y al revés: salir de esa pantalla completa sin hueco al que volver lo
  // devuelve al miniplayer, de donde venía. Si no, se quedaba pintado arriba,
  // encima de la pantalla que hubiera.
  const wasFullscreen = useRef(player.fullscreen);
  useEffect(() => {
    const left = wasFullscreen.current && !player.fullscreen;
    wasFullscreen.current = player.fullscreen;
    if (
      left &&
      player.index !== null &&
      player.mode === 'full' &&
      player.presentation === 'inline' &&
      player.anchor === null
    ) {
      player.minimize();
    }
    // Solo importa el paso de grande a normal; el resto se lee en ese momento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.fullscreen]);

  /**
   * Lo que va **encima** de Inicio, en capas: la rejilla de «Ver todo», la
   * ficha de una serie y la de una película, cada una sobre la anterior.
   *
   * Son tres capas y no un hueco con tres inquilinos porque abrir una ficha no
   * debe desmontar lo de debajo: si la rejilla se desmonta, al volver empieza
   * otra vez por arriba y hay que bajar de nuevo hasta donde estabas.
   */
  const categoryLayer = category ? (
    <CategoryScreen
      category={category}
      onBack={closeCategory}
      onOpenMovie={setMovie}
      onOpenSeries={setSeriesId}
    />
  ) : null;
  const seriesLayer = series ? (
    <SeriesScreen
      series={series}
      onBack={closeSeries}
      onOpenSeries={setSeriesId}
      onOpenMovie={setMovie}
    />
  ) : null;
  const detailLayer =
    movie !== null ? (
      <DetailScreen index={movie} onBack={closeMovie} onOpenMovie={setMovie} />
    ) : null;
  const covered = !!(categoryLayer || seriesLayer || detailLayer);

  /** Encima de TV en vivo solo cabe la rejilla de canales. */
  const liveOverlay = category ? (
    <CategoryScreen
      category={category}
      onBack={closeCategory}
      onOpenMovie={setMovie}
      onOpenSeries={setSeriesId}
    />
  ) : null;

  /** Encima de Noticias, la noticia abierta. */
  const newsOverlay =
    news !== null ? <NewsScreen id={news} onBack={closeNews} /> : null;

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
          {tab === 'envivo' ? (
            // TV en vivo también es una pila: la guía de canales abajo y,
            // encima, la rejilla de «Ver todo».
            <View style={styles.stack}>
              <Underlay covered={!!liveOverlay}>
                <LiveScreen onSeeAll={() => setCategory('live')} />
              </Underlay>
              <Sheet>{liveOverlay}</Sheet>
            </View>
          ) : tab === 'noticias' ? (
            // Noticias no está en la barra (ver `TabBar`): se llega desde una
            // noticia guardada en Favoritos.
            <View style={styles.stack}>
              <Underlay covered={!!newsOverlay}>
                <NewsHomeScreen onOpenNews={setNews} />
              </Underlay>
              <Sheet>{newsOverlay}</Sheet>
            </View>
          ) : vodTab ? (
            // Inicio **no se desmonta** al abrir una ficha: la ficha se pone
            // encima. Si se desmontara, al volver la portada empezaría otra vez
            // desde arriba y se perdería por dónde iba el scroll.
            <View style={styles.stack}>
              {/* Da un paso atrás cuando se le pone algo encima: se ve que
                  sigue ahí, detrás. */}
              <Underlay covered={covered}>
                <HomeScreen
                  onOpenSeries={setSeriesId}
                  onOpenMovie={setMovie}
                  onSeeAll={setCategory}
                  // Tapada no tiene que seguir pasando destacados sola.
                  active={!covered}
                />
              </Underlay>
              <Sheet>{categoryLayer}</Sheet>
              <Sheet>{seriesLayer}</Sheet>
              <Sheet>{detailLayer}</Sheet>
            </View>
          ) : tab === 'favoritos' ? (
            // Favoritos abre fichas como Inicio: encima, en capas. Sin ellas
            // tocar una serie o una película guardaba cuál y no pintaba nada.
            <View style={styles.stack}>
              <Underlay covered={!!(seriesLayer || detailLayer)}>
                <FavouritesScreen
                  onOpenSeries={setSeriesId}
                  onOpenMovie={setMovie}
                  // Una noticia guardada se lee en su pestaña, no aquí.
                  onOpenNews={id => {
                    setNews(id);
                    setTab('noticias');
                  }}
                />
              </Underlay>
              <Sheet>{seriesLayer}</Sheet>
              <Sheet>{detailLayer}</Sheet>
            </View>
          ) : tab === 'perfil' ? (
            // Perfil es la portada; Diagnóstico se abre encima, como una ficha.
            <View style={styles.stack}>
              <Underlay covered={diagnostics}>
                <ProfileScreen
                  onGo={goTo}
                  onDiagnostics={() => setDiagnostics(true)}
                />
              </Underlay>
              <Sheet>
                {diagnostics ? (
                  <DiagnosticsScreen onBack={() => setDiagnostics(false)} />
                ) : null}
              </Sheet>
            </View>
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
