import React, {useEffect, useState} from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import SOURCES, {seriesOf} from '../sources';
import {articleById} from '../news';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {useTabBarSpace} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import Poster, {GRID_COLUMNS, GRID_GAP, posterSize} from '../components/Poster';
import {SkeletonGrid} from '../components/Skeleton';
import {loadFavourites, loadPositions, type Positions} from '../player/storage';

/**
 * «Mi lista»: lo que se ha marcado con el + de la ficha de una película. Se
 * guardan los `uri` (ver `loadFavourites`), así que aquí se vuelven a buscar en
 * el catálogo; lo que ya no exista, simplemente no sale.
 */
export default function FavouritesScreen({
  onOpenSeries,
  onOpenMovie,
  onOpenNews,
}: {
  onOpenSeries: (id: string) => void;
  onOpenMovie: (index: number) => void;
  /** Las noticias guardadas se abren en su pestaña. */
  onOpenNews: (id: string) => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  const [uris, setUris] = useState<string[]>([]);
  const [positions, setPositions] = useState<Positions>({});
  // Se relee al volver de un vídeo: puede haberse añadido o quitado desde la ficha.
  // Leer el almacén es rápido, pero no instantáneo: hasta que llega se enseñan
  // huecos, que es mejor que el «no hay nada» de un segundo.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([loadFavourites(), loadPositions()]).then(([list, saved]) => {
      setUris(list);
      setPositions(saved);
      setReady(true);
    });
  }, [player.index]);

  // Lo guardado desde una noticia se apunta como `news:<id>` (ver `NewsScreen`).
  const articles = uris
    .filter(uri => uri.startsWith('news:'))
    .map(uri => articleById(uri.slice('news:'.length)))
    .filter(article => article !== undefined);

  const items = uris
    .map(uri => {
      const index = SOURCES.findIndex(item => item.source.uri === uri);
      return index < 0 ? null : {...SOURCES[index], index};
    })
    .filter(item => item !== null);

  // La misma carátula que en Inicio y en las rejillas de «Ver todo».
  const {width: cardWidth, height: cardHeight} = posterSize(width);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingBottom:
          tabBarSpace +
          24 +
          (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
      }}>
      <Text style={styles.heading}>{t('screen.favouritesTitle')}</Text>

      {!ready ? (
        <SkeletonGrid
          rows={2}
          columns={GRID_COLUMNS}
          width={cardWidth}
          height={cardHeight}
          gap={GRID_GAP}
          style={styles.skeleton}
        />
      ) : items.length === 0 && articles.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('favourites.empty')}</Text>
          <Text style={styles.hint}>{t('favourites.hint')}</Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {articles.map(article => (
            <Poster
              key={article.id}
              title={article.title}
              subtitle={article.category}
              width={cardWidth}
              height={cardHeight}
              onPress={() => onOpenNews(article.id)}
            />
          ))}
          {items.map(item => {
            const saved = positions[item.source.uri];
            const series = seriesOf(item.index);
            return (
              <Poster
                key={item.index}
                title={item.title}
                subtitle={item.label}
                image={item.poster}
                badge={item.kind === 'live' ? t('live.badge') : undefined}
                width={cardWidth}
                height={cardHeight}
                progress={
                  saved && saved.duration > 0
                    ? saved.seconds / saved.duration
                    : 0
                }
                onPress={() => {
                  // Cada cosa a su ficha; un canal en vivo no tiene, así que se
                  // abre directamente.
                  if (series) {
                    onOpenSeries(series.id);
                  } else if (item.kind === 'movie') {
                    onOpenMovie(item.index);
                  } else {
                    player.open(item.index, {presentation: 'immersive'});
                  }
                }}
              />
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  heading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  skeleton: {paddingHorizontal: 16},
  empty: {paddingHorizontal: 16, gap: 8},
  emptyText: {color: '#ccc', fontSize: 14},
  hint: {color: '#888', fontSize: 12, lineHeight: 17},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: GRID_GAP,
  },
});
