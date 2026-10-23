import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, FlatList, Image, Pressable, ScrollView, StyleSheet, TextInput, useWindowDimensions, View} from 'react-native';
import Text from '../components/Text';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import SOURCES, {
  allSeries,
  catalogState,
  liveChannels,
  loadMovies,
  movies,
  useCatalog,
} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {useTabBarSpace} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import Poster, {posterSize, wideSize} from '../components/Poster';
import GradientFill from '../components/GradientFill';
import {
  ArrowBackIcon,
  CloseIcon,
  PlayIcon,
  SearchIcon,
} from '../components/icons';
import {loadPositions, resumeFrom, type Positions} from '../player/storage';
import {formatLength} from '../components/format';
import Skeleton, {SkeletonRow} from '../components/Skeleton';
import type {Category} from './CategoryScreen';
import {FONT} from '../theme';

/** Cada cuánto pasa solo a la siguiente página el carrusel de destacados. */
const HERO_AUTOPLAY_MS = 5000;
/** Alto de la cabecera que aparece al bajar, y cuánto hay que bajar para verla. */
/**
 * Un género entra en Inicio a partir de dos películas: con una sola no es una
 * fila, es una tarjeta suelta.
 */
const GENRE_MIN = 2;
/**
 * Cuántos títulos entran en una fila antes de la tarjeta de «Ver todo».
 *
 * Una fila es un aperitivo, no el catálogo: con el género bien lleno puede
 * haber doscientos, y deslizar doscientas carátulas de lado no lo hace nadie.
 * El resto está a un toque, en la rejilla, que es donde se busca de verdad.
 */
const ROW_MAX = 20;
/** Más destacados que esto y los puntos se cambian por «3 / 42». */
const DOTS_MAX = 8;
/**
 * Cuántos destacados entran en el carrusel. Ocho, como HBO Max: Netflix en
 * móvil ni siquiera tiene carrusel (un solo título fijo) y nadie pasa de diez,
 * porque de la cuarta tarjeta en adelante la gente ya ha bajado a las filas.
 */
const HERO_MAX = 8;
const HEADER_HEIGHT = 52;
const HEADER_FADE = 140;
/** Colores de los degradados de los destacados. */
const HERO_COLORS: Array<[string, string]> = [
  ['#8a3b12', '#3a1709'],
  ['#1f3a5f', '#131f2e'],
  ['#4a2b6b', '#1f1430'],
  ['#1d4d43', '#0f2420'],
];

/**
 * Portada de la app: cabecera flotante sobre un destacado a toda pantalla y,
 * debajo, carruseles horizontales. Las carátulas se dibujan (ver `Poster`).
 */
export default function HomeScreen({
  onOpenSeries,
  onOpenMovie,
  onSeeAll,
  active = true,
}: {
  onOpenSeries: (id: string) => void;
  /** Una carátula de película abre su ficha; el vídeo solo al darle a play. */
  onOpenMovie: (index: number) => void;
  /** «Ver todo» abre esa categoría entera en su propia pantalla. */
  onSeeAll: (category: Category) => void;
  /**
   * `false` cuando hay una ficha encima: la portada sigue montada —para no
   * perder por dónde iba el scroll— pero deja de pasar destacados sola.
   */
  active?: boolean;
}) {
  const player = usePlayer();
  const insets = useSafeAreaInsets();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  // Las carátulas miden lo mismo aquí que en la rejilla de «Ver todo»: una
  // película no debe cambiar de tamaño al pasar de una vista a la otra.
  const {width: posterWidth, height: posterHeight} = posterSize(width);
  const {width: wideWidth, height: wideHeight} = wideSize(width);
  const [positions, setPositions] = useState<Positions>({});
  // Mientras se lee lo guardado se enseña el esqueleto: si no, la portada
  // aparece sin las barras de «seguir viendo» y se recoloca al llegar.
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    loadPositions().then(saved => {
      setPositions(saved);
      setLoading(false);
    });
  }, [player.index]);

  const heroHeight = Math.round(width * 1.15);
  const [heroPage, setHeroPage] = useState(0);
  const heroRef = useRef<FlatList<Highlight>>(null);
  // Mientras el dedo manda, el automático se calla.
  const [heroHeld, setHeroHeld] = useState(false);
  // Buscador: `null` cerrado, cadena abierta (vacía incluida).
  const [query, setQuery] = useState<string | null>(null);
  // Cuánto se ha bajado: de aquí sale la cabecera que aparece al hacer scroll.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  // El fondo de la lupa solo hace falta sobre el destacado: con la cabecera
  // puesta, el icono va suelto sobre ella.
  const glassOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  // El catálogo es una lista viva: al arrancar se le añaden las películas del
  // Internet Archive (ver `sources`), así que hay que repintar cuando lleguen.
  // Las listas se calculan una vez por revisión del catálogo (ver `sources`),
  // así que pedirlas en cada render no cuesta nada.
  useCatalog();
  const seriesList = allSeries();
  const movieList = movies();
  const channels = liveChannels();
  // Cómo va la descarga del catálogo real (ver `loadMovies`).
  const catalog = catalogState();

  // Películas agrupadas por género de TMDb, de más llena a menos. Los géneros
  // llegan después que la lista, así que esto se rellena solo.
  const genreRows = useMemo(
    () =>
      Object.entries(
        movieList.reduce<Record<string, typeof movieList>>((rows, item) => {
          (item.genres ?? []).forEach(genre => {
            rows[genre] = [...(rows[genre] ?? []), item];
          });
          return rows;
        }, {}),
      )
        .filter(([, items]) => items.length >= GENRE_MIN)
        .sort((a, b) => b[1].length - a[1].length),
    [movieList],
  );

  /**
   * Destacados del carrusel: las series primero (es lo que mejor luce en grande)
   * y detrás un par de títulos sueltos.
   */
  const allFeatured: Highlight[] = [
    ...seriesList.map(series => {
      // Episodio por el que seguir: el primero empezado, o el primero.
      const next =
        series.episodes.find(
          episode => resumeFrom(positions, episode.source.uri) > 0,
        ) ?? series.episodes[0];
      return {
        key: series.id,
        title: series.title,
        meta: t('screen.seriesEpisodes', {count: series.episodes.length}),
        // En grande manda el fondo apaisado, igual que con las películas.
        image: series.backdrop ?? series.poster,
        onPlay: () =>
          next && player.open(next.index, {presentation: 'immersive'}),
        onDetails: () => onOpenSeries(series.id),
      };
    }),
    // En el carrusel entran todas las películas con imagen; sin imagen, el
    // destacado es un degradado con letras y no aporta nada.
    ...movieList
      .filter(item => item.backdrop ?? item.poster)
      .map(item => ({
        key: `movie-${item.index}`,
        // En grande manda el fondo apaisado; el cartel vertical queda fatal.
        image: item.backdrop ?? item.poster,
        title: item.title,
        meta: item.label,
        // Como una serie: reproducir va al vídeo en horizontal y «Detalles» a la ficha.
        onPlay: () => player.open(item.index, {presentation: 'immersive'}),
        onDetails: () => onOpenMovie(item.index),
      })),
  ];

  // «Seguir viendo»: cualquier cosa del catálogo con posición guardada.
  const continueItems = SOURCES.map((item, index) => ({...item, index})).filter(
    item => positions[item.source.uri]?.duration,
  );

  const featured = allFeatured.slice(0, HERO_MAX);
  const pages = featured.length;

  const term = (query ?? '').trim().toLowerCase();
  const matches = (text: string) => text.toLowerCase().includes(term);
  const foundMovies = movieList.filter(
    item => matches(item.title) || matches(item.label),
  );
  const foundSeries = seriesList.filter(series => matches(series.title));
  const foundChannels = channels.filter(
    channel => matches(channel.title) || matches(channel.label),
  );
  const found = foundMovies.length + foundSeries.length + foundChannels.length;

  const progressOf = (uri: string) => {
    const saved = positions[uri];
    return saved && saved.duration > 0 ? saved.seconds / saved.duration : 0;
  };

  /** «Quedan 12 min» de un vídeo empezado, si ya se sabe cuánto dura. */
  const remainingOf = (uri: string) => {
    const saved = positions[uri];
    if (!saved || saved.duration <= 0) {
      return undefined;
    }
    return t('screen.remaining', {
      time: formatLength(Math.max(0, saved.duration - saved.seconds)),
    });
  };

  /**
   * Las filas, como datos. La lista monta solo las que se ven, así que aquí
   * puede entrar el catálogo entero: Películas con todo lo que haya, una fila
   * por género y las de siempre.
   */
  const sections: Section[] = [
    {
      key: 'movies',
      render: () => (
        <Row title={t('screen.moviesRow')} onSeeAll={() => onSeeAll('movies')}>
          {movieList.slice(0, ROW_MAX).map(item => (
            <Poster
              key={item.index}
              title={item.title}
              subtitle={item.label}
              image={item.poster}
              width={posterWidth}
              height={posterHeight}
              progress={progressOf(item.source.uri)}
              onPress={() => onOpenMovie(item.index)}
            />
          ))}
          {movieList.length > ROW_MAX && (
            <SeeAllCard
              width={posterWidth}
              height={posterHeight}
              onPress={() => onSeeAll('movies')}
            />
          )}
        </Row>
      ),
    },
    // Una fila por género, con lo que TMDb haya reconocido del catálogo (ver
    // `enrichCatalog`).
    ...genreRows.map(([genre, items]) => ({
      key: `genre-${genre}`,
      render: () => (
        <Row title={genre} onSeeAll={() => onSeeAll({genre})}>
          {items.slice(0, ROW_MAX).map(item => (
            <Poster
              key={item.index}
              title={item.title}
              subtitle={item.label}
              image={item.poster}
              width={posterWidth}
              height={posterHeight}
              progress={progressOf(item.source.uri)}
              onPress={() => onOpenMovie(item.index)}
            />
          ))}
          {items.length > ROW_MAX && (
            <SeeAllCard
              width={posterWidth}
              height={posterHeight}
              onPress={() => onSeeAll({genre})}
            />
          )}
        </Row>
      ),
    })),
    {
      key: 'series',
      render: () => (
        <Row
          title={t('screen.seriesTitle')}
          onSeeAll={() => onSeeAll('series')}>
          {seriesList.slice(0, ROW_MAX).map(series => (
            <Poster
              key={series.id}
              title={series.title}
              subtitle={t('screen.seriesEpisodes', {
                count: series.episodes.length,
              })}
              image={series.poster}
              width={posterWidth}
              height={posterHeight}
              onPress={() => onOpenSeries(series.id)}
            />
          ))}
          {seriesList.length > ROW_MAX && (
            <SeeAllCard
              width={posterWidth}
              height={posterHeight}
              onPress={() => onSeeAll('series')}
            />
          )}
        </Row>
      ),
    },
    {
      key: 'live',
      render: () => (
        <Row title={t('screen.liveRow')} onSeeAll={() => onSeeAll('live')}>
          {channels.slice(0, ROW_MAX).map(channel => (
            <Poster
              key={channel.index}
              title={channel.title}
              subtitle={channel.label}
              badge={t('live.badge')}
              width={wideWidth}
              height={wideHeight}
              onPress={() =>
                player.open(channel.index, {presentation: 'immersive'})
              }
            />
          ))}
          {channels.length > ROW_MAX && (
            <SeeAllCard
              width={wideWidth}
              height={wideHeight}
              onPress={() => onSeeAll('live')}
            />
          )}
        </Row>
      ),
    },
  ];

  // Pasa solo de destacado. No anima el scroll con `useNativeDriver` porque no
  // es una animación nuestra: le pedimos a la lista que se desplace.
  useEffect(() => {
    if (!active || loading || heroHeld || pages < 2) {
      return;
    }
    const timer = setInterval(() => {
      setHeroPage(current => {
        const next = (current + 1) % pages;
        heroRef.current?.scrollToOffset({offset: next * width, animated: true});
        return next;
      });
    }, HERO_AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [active, loading, heroHeld, pages, width]);

  if (loading) {
    return <HomeSkeleton heroHeight={heroHeight} insetTop={insets.top} />;
  }

  const bottomSpace =
    tabBarSpace +
    24 +
    (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0);

  // Buscando, la portada deja sitio a los resultados: el carrusel y las filas
  // estorbarían más que ayudar.
  if (query !== null) {
    return (
      <View style={styles.container}>
        <View style={styles.searchBar}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('screen.searchPlaceholder')}
            placeholderTextColor="#8a8a8f"
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('screen.close')}
            onPress={() => setQuery(null)}
            hitSlop={8}
            style={({pressed}) => [styles.round, pressed && styles.pressed]}>
            <CloseIcon size={20} />
          </Pressable>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{paddingBottom: bottomSpace}}>
          {/* Con el catálogo todavía llegando, «no hay nada» sería mentira:
              puede estar a punto de entrar. Se enseñan huecos hasta que acabe
              de cargarse. */}
          {term !== '' && found === 0 && !catalog.loading && (
            <Text style={styles.noResults}>
              {t('screen.noResults', {query: term})}
            </Text>
          )}

          {(foundMovies.length > 0 || catalog.loading) && (
            <Row title={t('screen.moviesRow')}>
              {foundMovies.map(item => (
                <Poster
                  key={item.index}
                  title={item.title}
                  subtitle={item.label}
                  image={item.poster}
                  width={posterWidth}
                  height={posterHeight}
                  progress={progressOf(item.source.uri)}
                  onPress={() => onOpenMovie(item.index)}
                />
              ))}
              {/* El catálogo sigue llegando: al final de lo encontrado van los
                  huecos de lo que puede entrar todavía. */}
              {catalog.loading && (
                <SkeletonRow
                  count={3}
                  width={posterWidth}
                  height={posterHeight}
                  radius={12}
                />
              )}
            </Row>
          )}

          {foundSeries.length > 0 && (
            <Row title={t('screen.seriesTitle')}>
              {foundSeries.map(series => (
                <Poster
                  key={series.id}
                  title={series.title}
                  subtitle={t('screen.seriesEpisodes', {
                    count: series.episodes.length,
                  })}
                  image={series.poster}
                  width={posterWidth}
                  height={posterHeight}
                  onPress={() => onOpenSeries(series.id)}
                />
              ))}
            </Row>
          )}

          {foundChannels.length > 0 && (
            <Row title={t('screen.liveRow')}>
              {foundChannels.map(channel => (
                <Poster
                  key={channel.index}
                  title={channel.title}
                  subtitle={channel.label}
                  badge={t('live.badge')}
                  width={wideWidth}
                  height={wideHeight}
                  onPress={() =>
                    player.open(channel.index, {presentation: 'immersive'})
                  }
                />
              ))}
            </Row>
          )}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* El cuerpo es una lista de filas, no un ScrollView: así Inicio puede
          enseñar el catálogo entero sin montarlo entero. */}
      <Animated.FlatList
        data={sections}
        keyExtractor={(section: Section) => section.key}
        renderItem={({item}: {item: Section}) => item.render()}
        contentContainerStyle={{paddingBottom: bottomSpace}}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        initialNumToRender={3}
        maxToRenderPerBatch={2}
        windowSize={5}
        removeClippedSubviews
        // Solo mueve una opacidad: puede ir por el hilo nativo.
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        ListHeaderComponent={
          <>
            {/* Destacados, en carrusel */}
            <View style={{height: heroHeight}}>
              {/* El carrusel lleva el catálogo entero, así que también va con
                  ventana: una página ocupa la pantalla y solo se montan la que
                  se ve y sus vecinas. */}
              <FlatList<Highlight>
                ref={heroRef}
                data={featured}
                keyExtractor={item => item.key}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                // Todas las páginas miden lo mismo: no hay que medir nada.
                getItemLayout={(_data, index) => ({
                  length: width,
                  offset: width * index,
                  index,
                })}
                initialNumToRender={1}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews
                renderItem={({item}) => (
                  <Hero item={item} width={width} height={heroHeight} />
                )}
                onScrollBeginDrag={() => setHeroHeld(true)}
                // Con qué página nos hemos quedado, para los puntos de abajo. Al
                // soltar, el automático sigue desde donde lo dejó el usuario.
                onMomentumScrollEnd={e => {
                  setHeroPage(
                    Math.round(
                      e.nativeEvent.contentOffset.x / Math.max(1, width),
                    ),
                  );
                  setHeroHeld(false);
                }}
              />

              {/* Puntos mientras sean pocos; con el catálogo entero en el
                  carrusel, una tira de cuarenta puntos no dice nada, así que
                  se cambia por el número de página. */}
              {featured.length > 1 && featured.length <= DOTS_MAX ? (
                <View style={styles.dots} pointerEvents="none">
                  {featured.map((item, index) => (
                    <View
                      key={item.key}
                      style={[
                        styles.dot,
                        index === heroPage && styles.dotActive,
                      ]}
                    />
                  ))}
                </View>
              ) : featured.length > 1 ? (
                <View style={styles.count} pointerEvents="none">
                  <Text style={styles.countText}>
                    {heroPage + 1} / {featured.length}
                  </Text>
                </View>
              ) : null}
            </View>

            {continueItems.length > 0 && (
              <Row title={t('screen.continueRow')}>
                {continueItems.map(item => (
                  <Poster
                    key={item.index}
                    title={item.title}
                    // Lo que queda, que es lo que importa aquí; si aún no se
                    // sabe la duración, la etiqueta de siempre.
                    subtitle={remainingOf(item.source.uri) ?? item.label}
                    // La tarjeta es apaisada: el cartel vertical recortado a lo
                    // ancho sale por la mitad. Manda el fondo.
                    image={item.backdrop ?? item.poster}
                    play
                    width={wideWidth}
                    height={wideHeight}
                    progress={progressOf(item.source.uri)}
                    // Seguir viendo reproduce directamente, en horizontal.
                    onPress={() =>
                      player.open(item.index, {presentation: 'immersive'})
                    }
                  />
                ))}
              </Row>
            )}

            {/* Lo que pasa con el catálogo real: se trae al arrancar y, si falla,
            la app se queda con lo de ejemplo y aquí se puede reintentar. */}
            {catalog.loading && (
              <Text style={styles.catalogNote}>{t('catalog.loading')}</Text>
            )}
            {catalog.error && (
              <View style={styles.catalogError}>
                <Text style={styles.catalogNote}>
                  {t('catalog.error', {message: catalog.error})}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => loadMovies()}
                  style={({pressed}) => [
                    styles.retry,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.retryText}>{t('catalog.retry')}</Text>
                </Pressable>
              </View>
            )}
          </>
        }
      />

      {/* Cabecera: al principio no está (solo la lupa sobre el destacado) y
          aparece al bajar, para no tapar la portada. */}
      <View pointerEvents="box-none" style={styles.header}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
                        styles.headerBack,
                        {opacity: headerOpacity},
          ]}
        />

        <Animated.Text style={[styles.headerTitle, {opacity: headerOpacity}]}>
          {t('tab.home')}
        </Animated.Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('screen.searchTitle')}
          onPress={() => setQuery('')}
          hitSlop={10}
          style={({pressed}) => [
            styles.searchButton,
            pressed && styles.pressed,
          ]}>
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.searchBack,
              {opacity: glassOpacity},
            ]}
          />
          <SearchIcon size={20} />
        </Pressable>
      </View>
    </View>
  );
}

/** Una fila de Inicio, como dato: la lista decide cuándo pintarla. */
type Section = {key: string; render: () => React.ReactElement};

/** Una página del carrusel de destacados. */
type Highlight = {
  key: string;
  title: string;
  meta: string;
  /** Carátula real, si el título viene del Internet Archive. */
  image?: string;
  onPlay: () => void;
  /** Solo donde hay algo más que enseñar (una serie tiene ficha; un vídeo no). */
  onDetails?: () => void;
};

function Hero({
  item,
  width,
  height,
}: {
  item: Highlight;
  width: number;
  height: number;
}) {
  // Un degradado por destacado: el id tiene que ser único dentro del SVG.
  const id = `hero-${item.key}`;
  const [from, mid] =
    HERO_COLORS[Math.abs(item.title.length) % HERO_COLORS.length];
  return (
    // El color de base va en la vista: con foto, el degradado quedaba debajo
    // de la imagen sin verse, y eran ocho destacados montados a la vez, cada
    // uno con dos SVG a pantalla completa. Ahora el degradado solo se dibuja
    // cuando es lo que se ve.
    <View style={[styles.hero, {width, height, backgroundColor: from}]}>
      {item.image ? (
        <>
          <Image
            source={{uri: item.image}}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
          {/* Sin velo, el título blanco se pierde sobre una foto clara. En
              degradado y hasta el negro del fondo, para que la portada no
              termine en un corte recto contra la primera fila. */}
          <Svg
            width={width}
            height={height}
            style={StyleSheet.absoluteFill}
            pointerEvents="none">
            <Defs>
              <LinearGradient id={`${id}-veil`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#0f0f0f" stopOpacity="0.55" />
                <Stop offset="0.35" stopColor="#0f0f0f" stopOpacity="0.15" />
                <Stop offset="0.75" stopColor="#0f0f0f" stopOpacity="0.85" />
                <Stop offset="1" stopColor="#0f0f0f" stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width={width} height={height} fill={`url(#${id}-veil)`} />
          </Svg>
        </>
      ) : (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
              <Stop offset="0" stopColor={from} />
              <Stop offset="0.55" stopColor={mid} />
              <Stop offset="1" stopColor="#0f0f0f" />
            </LinearGradient>
          </Defs>
          <Rect width={width} height={height} fill={`url(#${id})`} />
        </Svg>
      )}

      <View style={styles.heroBottom}>
        <Text style={styles.heroTitle}>{item.title}</Text>
        <Text style={styles.heroMeta}>{item.meta}</Text>

        <View style={styles.heroButtons}>
          <Pressable
            accessibilityRole="button"
            onPress={item.onPlay}
            style={({pressed}) => [styles.play, pressed && styles.pressed]}>
            {/* El botón principal lleva el degradado de la marca de fondo. */}
            <GradientFill />
            <PlayIcon size={16} color="#fff" />
            <Text style={styles.playText}>{t('screen.play')}</Text>
          </Pressable>
          {item.onDetails && (
            <Pressable
              accessibilityRole="button"
              onPress={item.onDetails}
              style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
              <Text style={styles.ghostText}>{t('screen.details')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/** La misma portada, en huecos: mismo alto y mismos tamaños de tarjeta. */
function HomeSkeleton({
  heroHeight,
  insetTop,
}: {
  heroHeight: number;
  insetTop: number;
}) {
  const {width} = useWindowDimensions();
  const poster = posterSize(width);
  const wide = wideSize(width);
  return (
    <View style={[styles.container, {paddingTop: insetTop}]}>
      <Skeleton width="100%" height={heroHeight - insetTop} radius={0} />
      <View style={styles.skeletonHero}>
        <Skeleton width={200} height={26} />
        <Skeleton width={110} height={12} />
      </View>

      {[0, 1].map(row => (
        <View key={row} style={styles.row}>
          <View style={styles.rowHead}>
            <Skeleton width={150} height={18} />
          </View>
          <SkeletonRow
            count={4}
            width={row === 0 ? wide.width : poster.width}
            height={row === 0 ? wide.height : poster.height}
            radius={12}
            style={styles.rowItems}
          />
        </View>
      ))}
    </View>
  );
}

/** Carrusel horizontal con su título y, si se pasa, el enlace «Ver todo». */
/**
 * Última tarjeta de una fila cortada: lleva a la rejilla con todo.
 *
 * Va **dentro** de la fila, no solo en la cabecera, porque es donde acaba el
 * dedo al deslizar: quien llega al final ya está pidiendo ver más.
 */
function SeeAllCard({
  width,
  height,
  onPress,
}: {
  width: number;
  height: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('screen.seeAll')}
      onPress={onPress}
      style={({pressed}) => [
        styles.seeAllCard,
        {width, height},
        pressed && styles.pressed,
      ]}>
      <View style={styles.seeAllCircle}>
        {/* No hay flecha a la derecha en el juego de iconos: es la de volver,
            del revés. */}
        <View style={styles.flipHorizontal}>
          <ArrowBackIcon size={20} />
        </View>
      </View>
      <Text style={styles.seeAllCardText}>{t('screen.seeAll')}</Text>
    </Pressable>
  );
}

function Row({
  title,
  onSeeAll,
  children,
}: {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <Text style={styles.rowTitle}>{title}</Text>
        {onSeeAll && (
          <Pressable
            accessibilityRole="link"
            onPress={onSeeAll}
            hitSlop={8}
            style={({pressed}) => pressed && styles.pressed}>
            <Text style={styles.seeAll}>{t('screen.seeAll')}</Text>
          </Pressable>
        )}
      </View>
      {/* Lista, no ScrollView: una fila puede tener sesenta títulos y solo se
          montan los que se ven. */}
      <FlatList<React.ReactNode>
        horizontal
        data={React.Children.toArray(children)}
        keyExtractor={(_item, index) => String(index)}
        renderItem={({item}: {item: React.ReactNode}) => <>{item}</>}
        showsHorizontalScrollIndicator={false}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={3}
        removeClippedSubviews
        contentContainerStyle={styles.rowItems}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  headerBack: {backgroundColor: '#0f0f0f'},
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  seeAllCard: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a1d',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  seeAllCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  seeAllCardText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  flipHorizontal: {transform: [{scaleX: -1}]},
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  searchButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBack: {backgroundColor: '#1f1f22'},
  headerTitle: {
    fontFamily: FONT,
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  input: {
    fontFamily: FONT,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    fontSize: 14,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  noResults: {color: '#8a8a8f', fontSize: 13, paddingHorizontal: 16},
  hero: {justifyContent: 'flex-end'},
  pressed: {opacity: 0.6},
  // Deja sitio bajo los botones: debajo van los puntos y, pegada, la primera fila.
  heroBottom: {alignItems: 'center', paddingBottom: 44, gap: 6},
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  heroMeta: {color: 'rgba(255,255,255,0.75)', fontSize: 12, letterSpacing: 2},
  heroButtons: {flexDirection: 'row', gap: 14, marginTop: 18},
  count: {
    position: 'absolute',
    bottom: 14,
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  countText: {color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700'},
  dots: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {backgroundColor: '#fff'},
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 26,
    paddingVertical: 11,
    borderRadius: 22,
    // El degradado va dentro: sin esto se sale de las esquinas.
    overflow: 'hidden',
  },
  playText: {color: '#fff', fontWeight: '700', fontSize: 13},
  ghost: {
    paddingHorizontal: 26,
    paddingVertical: 11,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#2a2a2e',
  },
  ghostText: {color: '#fff', fontWeight: '700', fontSize: 13},
  catalogNote: {
    color: '#8a8a8f',
    fontSize: 12,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  catalogError: {gap: 8, marginTop: 4},
  retry: {
    alignSelf: 'flex-start',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 4,
    backgroundColor: '#2b2b2e',
  },
  retryText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  row: {marginTop: 20, gap: 10},
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  rowTitle: {color: '#fff', fontSize: 17, fontWeight: '700'},
  seeAll: {color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600'},
  rowItems: {paddingHorizontal: 16, gap: 10},
  // El título del destacado, en huecos, va sobre el degradado como el de verdad.
  skeletonHero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '48%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
});
