import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  BackHandler,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
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
import Poster from '../components/Poster';
import RoundButton from '../components/RoundButton';
import {ArrowBackIcon} from '../components/icons';
import {loadPositions, type Positions} from '../player/storage';

/**
 * Una fila de Inicio, entera: el «Ver todo» de Películas, Series o En directo
 * trae aquí, a una rejilla con todo el catálogo de esa categoría.
 */

/** Las categorías que tienen pantalla propia. */
export type Category = 'movies' | 'series' | 'live';

const TITLES: Record<Category, TextKey> = {
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
  const playing = player.index !== null && player.presentation === 'immersive';
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

  // Dos columnas con el mismo margen que las filas de Inicio.
  const cardWidth = Math.floor((width - 16 * 2 - 10) / 2);
  const cardHeight = Math.round(cardWidth * 1.5);

  const progressOf = (uri: string) => {
    const saved = positions[uri];
    return saved && saved.duration > 0 ? saved.seconds / saved.duration : 0;
  };

  // Una sola forma para las tres categorías: así la lista no tiene que saber
  // de qué está hecha cada tarjeta. Memorizada, porque si cambia la referencia
  // la lista repinta todas las tarjetas.
  const items = useMemo(
    () =>
      category === 'series'
        ? allSeries().map(series => ({
            key: series.id,
            title: series.title,
            subtitle: t('screen.seriesEpisodes', {
              count: series.episodes.length,
            }),
            image: undefined as string | undefined,
            badge: undefined as string | undefined,
            progress: 0,
            onPress: () => onOpenSeries(series.id),
          }))
        : (category === 'movies' ? movies() : liveChannels()).map(item => ({
            key: String(item.index),
            title: item.title,
            subtitle: item.label,
            image: item.poster,
            badge: category === 'live' ? t('live.badge') : undefined,
            progress: progressOf(item.source.uri),
            // Una película tiene ficha; un canal se ve directamente, en
            // horizontal.
            onPress: () =>
              category === 'movies'
                ? onOpenMovie(item.index)
                : player.open(item.index, {presentation: 'immersive'}),
          })),
    // `revision` entra para recalcular cuando crece el catálogo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [category, revision, positions, onOpenMovie, onOpenSeries, player],
  );

  const renderItem = useCallback(
    ({item}: {item: (typeof items)[number]}) => (
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
        <RoundButton
          accessibilityLabel={t('screen.seeAll')}
          onPress={onBack}
          size={36}>
          <ArrowBackIcon size={20} />
        </RoundButton>
        <Text style={styles.heading}>{t(TITLES[category])}</Text>
      </View>

      {/* Lista con ventana, no un ScrollView: con doscientas carátulas, montar
          todas las tarjetas de golpe es lo que hacía ir lenta la rejilla. */}
      <FlatList
        data={items}
        keyExtractor={item => item.key}
        numColumns={2}
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
        getItemLayout={(_, index) => ({
          length: cardHeight + 10,
          offset: (cardHeight + 10) * Math.floor(index / 2),
          index,
        })}
        initialNumToRender={6}
        maxToRenderPerBatch={4}
        updateCellsBatchingPeriod={60}
        windowSize={3}
        removeClippedSubviews
        renderItem={renderItem}
        ListFooterComponent={
          // Más películas del archivo, de página en página. Solo aquí: en
          // Inicio las filas son un aperitivo, la rejilla es donde se busca.
          category === 'movies' ? (
            <Pressable
              accessibilityRole="button"
              disabled={catalog.loading}
              onPress={() => loadMoreMovies()}
              style={({pressed}) => [styles.more, pressed && styles.pressed]}>
              <Text style={styles.moreText}>
                {t(catalog.loading ? 'catalog.loading' : 'catalog.more')}
              </Text>
            </Pressable>
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
  pressed: {opacity: 0.6},
  more: {
    alignSelf: 'center',
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 6,
    backgroundColor: '#2b2b2e',
  },
  moreText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  list: {paddingHorizontal: 16},
  row: {gap: 10, marginBottom: 10},
});
