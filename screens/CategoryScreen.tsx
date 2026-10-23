import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {BackHandler, FlatList, Image, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import Text from '../components/Text';
import {
  allSeries,
  catalogState,
  liveChannels,
  loadMoreMovies,
  movies,
  useCatalog,
} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {t, type TextKey} from '../i18n';
import {useTabBarSpace} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import Poster, {GRID_COLUMNS, GRID_GAP, posterSize} from '../components/Poster';
import Skeleton from '../components/Skeleton';
import {ArrowBackIcon} from '../components/icons';
import {loadPositions, type Positions} from '../player/storage';

/**
 * Una fila de Inicio, entera: el «Ver todo» de Películas, Series, En directo o
 * de un género trae aquí, a una rejilla con todo lo de esa fila.
 */

/**
 * Lo que puede abrirse aquí: las tres secciones fijas o **un género**, que no
 * es una lista aparte sino las películas que lo llevan (ver `genres` en
 * `sources`). Por eso el género viaja como objeto: así no se confunde con las
 * tres de siempre ni hace falta una clave de traducción por género.
 */
export type Category = 'movies' | 'series' | 'live' | {genre: string};

/** Cuántas carátulas se adelantan de cada página nueva. */
const PREFETCH = 12;

const TITLES: Record<'movies' | 'series' | 'live', TextKey> = {
  movies: 'screen.moviesRow',
  series: 'screen.seriesTitle',
  live: 'screen.liveRow',
};

export default function CategoryScreen({
  category,
  onBack,
  onOpenMovie,
  onOpenSeries,
}: {
  category: Category;
  onBack: () => void;
  onOpenMovie: (index: number) => void;
  onOpenSeries: (id: string) => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  // El catálogo crece cuando llegan las películas del archivo (ver `sources`).
  const revision = useCatalog();
  const catalog = catalogState();
  const [positions, setPositions] = useState<Positions>({});
  useEffect(() => {
    loadPositions().then(setPositions);
  }, [player.index]);

  // Atrás vuelve a Inicio, salvo con un vídeo abierto encima: entonces manda el
  // reproductor y le dejamos el gesto devolviendo false.
  // En el miniplayer no manda el reproductor: atrás es de esta pantalla.
  const playing =
    player.index !== null &&
    player.presentation === 'immersive' &&
    player.mode !== 'mini';
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (playing) {
        return false;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, playing]);

  // La medida es la de `posterSize`, la misma que usan las filas de Inicio.
  const {width: cardWidth, height: cardHeight} = posterSize(width);

  const progressOf = (uri: string) => {
    const saved = positions[uri];
    return saved && saved.duration > 0 ? saved.seconds / saved.duration : 0;
  };

  // Una sola forma para las tres categorías: así la lista no tiene que saber
  // de qué está hecha cada tarjeta. Memorizada, porque si cambia la referencia
  // la lista repinta todas las tarjetas.
  // Un género es una rejilla de películas filtrada; el resto, la sección tal
  // cual.
  const genre = typeof category === 'object' ? category.genre : undefined;
  // Las rejillas que crecen con el archivo: Películas y los géneros.
  const more = category === 'movies' || !!genre;
  const items = useMemo(
    () =>
      category === 'series'
        ? allSeries().map(series => ({
            key: series.id,
            title: series.title,
            subtitle: t('screen.seriesEpisodes', {
              count: series.episodes.length,
            }),
            image: series.poster,
            badge: undefined as string | undefined,
            progress: 0,
            onPress: () => onOpenSeries(series.id),
          }))
        : (category === 'live'
            ? liveChannels()
            : genre
            ? movies().filter(movie => movie.genres?.includes(genre))
            : movies()
          ).map(item => ({
            key: String(item.index),
            title: item.title,
            subtitle: item.label,
            image: item.poster,
            badge: category === 'live' ? t('live.badge') : undefined,
            progress: progressOf(item.source.uri),
            // Una película tiene ficha; un canal se ve directamente, en
            // horizontal.
            onPress: () =>
              category === 'live'
                ? player.open(item.index, {presentation: 'immersive'})
                : onOpenMovie(item.index),
          })),
    // `revision` entra para recalcular cuando crece el catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, genre, revision, positions, onOpenMovie, onOpenSeries, player],
  );

  /**
   * Las tarjetas más, si se está trayendo página, unos huecos **dentro** de la
   * rejilla. Metidos en los datos y no en el pie, los huecos completan la
   * última fila cuando se ha quedado a medias: si no, queda un vacío al lado
   * de la última tarjeta y los huecos debajo, como si fueran otra cosa.
   */
  const cells = useMemo(() => {
    if (!more || !catalog.loading) {
      return items;
    }
    const missing =
      (GRID_COLUMNS - (items.length % GRID_COLUMNS)) % GRID_COLUMNS;
    const holes = Array.from(
      {length: missing + GRID_COLUMNS},
      (_, at) => ({key: `hole-${at}`, hole: true} as const),
    );
    return [...items, ...holes];
  }, [items, more, catalog.loading]);

  /**
   * La carga automática se para sola cuando deja de servir.
   *
   * En una rejilla de género, una página del archivo puede no traer **ningún**
   * título de ese género: la lista no crece, el dedo sigue al final y se pide
   * otra, y otra. Medido: páginas 2 a 5 en cinco segundos. Si una página no
   * añade nada aquí, se deja de pedir solo y aparece «Cargar más».
   */
  const [auto, setAuto] = useState(true);
  const countNow = useRef(0);
  countNow.current = items.length;
  const countBefore = useRef<number | null>(null);
  useEffect(() => {
    if (catalog.loading) {
      countBefore.current = countNow.current;
      return;
    }
    if (countBefore.current !== null) {
      if (countNow.current === countBefore.current) {
        setAuto(false);
      }
      countBefore.current = null;
    }
  }, [catalog.loading]);

  // Las carátulas de lo que acaba de entrar se piden antes de que el dedo
  // llegue: así la fila nueva aparece con foto y no con el hueco.
  const seen = useRef(0);
  useEffect(() => {
    // Al cambiar de categoría la lista es otra: se vuelve a empezar.
    if (items.length < seen.current) {
      seen.current = 0;
    }
    const fresh = items.slice(seen.current, seen.current + PREFETCH);
    seen.current = items.length;
    fresh.forEach(item => {
      if (item.image) {
        Image.prefetch(item.image).catch(() => {
          // Que una carátula no se adelante no es un problema: se pedirá al
          // pintarla.
        });
      }
    });
  }, [items]);

  const renderItem = useCallback(
    ({item}: {item: (typeof cells)[number]}) =>
      'hole' in item ? (
        <Skeleton width={cardWidth} height={cardHeight} radius={12} />
      ) : (
        <Poster
          title={item.title}
          subtitle={item.subtitle}
          image={item.image}
          badge={item.badge}
          width={cardWidth}
          height={cardHeight}
          progress={item.progress}
          onPress={item.onPress}
        />
      ),
    [cardWidth, cardHeight],
  );

  return (
    <View style={styles.container}>
      <View style={styles.head}>
        {/* Aquí la flecha va sobre el fondo de la pantalla, no encima de una
            portada: el círculo de `RoundButton` solo hace falta cuando hay una
            imagen debajo de la que despegarse. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('screen.close')}
          onPress={onBack}
          hitSlop={12}
          style={({pressed}) => [styles.back, pressed && styles.pressed]}>
          <ArrowBackIcon size={22} />
        </Pressable>
        <Text style={styles.heading}>
          {genre ?? t(TITLES[category as 'movies' | 'series' | 'live'])}
        </Text>
      </View>

      {/* Lista con ventana, no un ScrollView: con doscientas carátulas, montar
          todas las tarjetas de golpe es lo que hacía ir lenta la rejilla. */}
      <FlatList
        data={cells}
        keyExtractor={item => item.key}
        numColumns={GRID_COLUMNS}
        showsVerticalScrollIndicator={false}
        columnWrapperStyle={styles.row}
        style={styles.list}
        contentContainerStyle={{
          paddingBottom:
            tabBarSpace +
            24 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        }}
        // Alto fijo y conocido: la lista no tiene que medir para saber dónde
        // está cada fila.
        //
        // Ojo con `numColumns`: lo que se pasa aquí es el índice de **fila**,
        // no el de tarjeta (`FlatList` agrupa la fila entera en un solo item
        // para la virtualización). Dividirlo aquí declaraba menos alto del
        // real, y la lista dejaba huecos negros al desplazarse.
        getItemLayout={(_, index) => ({
          length: cardHeight + GRID_GAP,
          offset: (cardHeight + GRID_GAP) * index,
          index,
        })}
        // La ventana era de tres pantallas y al desplazarse rápido dejaba un
        // vacío negro; con seis iba lleno pero montaba demasiadas tarjetas a
        // la vez. Cuatro es el punto medio que aguanta el arrastre sin que se
        // note el trabajo.
        initialNumToRender={9}
        maxToRenderPerBatch={6}
        updateCellsBatchingPeriod={50}
        windowSize={4}
        removeClippedSubviews
        renderItem={renderItem}
        // Más películas del archivo, de página en página, sin que haya que
        // pedirlas: al acercarse al final se trae la siguiente. Solo aquí: en
        // Inicio las filas son un aperitivo, la rejilla es donde se busca.
        onEndReachedThreshold={0.6}
        onEndReached={() => {
          if (
            more &&
            auto &&
            !catalog.loading &&
            !catalog.error &&
            !catalog.done
          ) {
            loadMoreMovies();
          }
        }}
        ListFooterComponent={
          more && (catalog.error || catalog.done || !auto) ? (
            <View style={styles.foot}>
              {catalog.done ? (
                // Se acabó el archivo: ni botón ni más peticiones.
                <Text style={styles.footNote}>{t('catalog.end')}</Text>
              ) : !catalog.error && !auto ? (
                // La automática se paró: a partir de aquí lo pide la persona.
                <Pressable
                  accessibilityRole="button"
                  disabled={catalog.loading}
                  onPress={() => {
                    setAuto(true);
                    loadMoreMovies();
                  }}
                  style={({pressed}) => [
                    styles.more,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.moreText}>{t('catalog.more')}</Text>
                </Pressable>
              ) : catalog.error ? (
                // Si falló, la carga automática se para sola (el `error` corta
                // el `onEndReached`) y se reintenta a mano.
                <>
                  <Text style={styles.footNote}>
                    {t('catalog.error', {message: catalog.error})}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => loadMoreMovies()}
                    style={({pressed}) => [
                      styles.more,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.moreText}>{t('catalog.retry')}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  heading: {color: '#fff', fontSize: 22, fontWeight: '800'},
  back: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  pressed: {opacity: 0.6},
  footNote: {
    color: '#8a8a8f',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
  foot: {marginTop: 18, justifyContent: 'center', alignItems: 'center'},
  more: {
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 6,
    backgroundColor: '#2b2b2e',
  },
  moreText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  list: {paddingHorizontal: 16},
  row: {gap: GRID_GAP, marginBottom: GRID_GAP},
});
