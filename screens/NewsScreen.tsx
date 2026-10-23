import React, {useEffect, useState} from 'react';
import {BackHandler, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View} from 'react-native';
import Text from '../components/Text';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {articleById} from '../news';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {useTabBarSpace} from '../components/TabBar';
import RoundButton from '../components/RoundButton';
import {
  ArrowBackIcon,
  CheckIcon,
  FavoriteIcon,
  PlayIcon,
  ShareIcon,
} from '../components/icons';
import {timeAgo} from '../components/format';
import {loadFavourites, toggleFavourite} from '../player/storage';

/**
 * La noticia abierta: foto a toda pantalla con los botones flotando encima,
 * titular y, debajo, la hoja con el medio y el texto.
 *
 * Las noticias son de prueba (ver `news.ts`). Si la noticia señala un canal del
 * catálogo, abajo sale el botón para verlo en directo, que abre el reproductor
 * en horizontal.
 */

/** Colores de las «fotos»: no hay imágenes, se dibujan (ver `Poster`). */
const SHOTS: Array<[string, string]> = [
  ['#2f6fb0', '#0f2740'],
  ['#b05a2f', '#3a1c0f'],
  ['#2f8f6f', '#0f3027'],
  ['#6b4ea8', '#241a3a'],
];

export default function NewsScreen({
  id,
  onBack,
}: {
  /** Noticia abierta (ver `news.ts`). */
  id: string;
  onBack: () => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const {width, height} = useWindowDimensions();
  const article = articleById(id);

  const [favourites, setFavourites] = useState<string[]>([]);
  // Foto que se está viendo, cuando la noticia trae varias.
  const [shot, setShot] = useState(0);
  useEffect(() => {
    loadFavourites().then(setFavourites);
  }, [id]);
  // Se guarda por id, igual que un vídeo se guarda por su uri.
  const key = `news:${id}`;
  const saved = favourites.includes(key);

  // Atrás vuelve a la lista, salvo con el canal abierto: entonces manda el
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

  // La foto ocupa la mitad larga de la pantalla; la hoja sube por encima.
  const shotHeight = Math.round(height * 0.52);

  if (!article) {
    return <View style={styles.container} />;
  }
  const seed = article.title.length;
  // Sin galería, una sola foto; con galería, una por cada pie.
  const shots = article.images ?? [];
  const pages = Math.max(1, shots.length);

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{paddingBottom: tabBarSpace + 24}}>
        <View style={{height: shotHeight}}>
          {pages === 1 ? (
            <Shot seed={seed} width={width} height={shotHeight} />
          ) : (
            // Varias fotos: se pasan a mano, una pantalla cada una.
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={event =>
                setShot(
                  Math.round(
                    event.nativeEvent.contentOffset.x / Math.max(1, width),
                  ),
                )
              }>
              {shots.map((image, index) => (
                <View key={image.caption} style={{width, height: shotHeight}}>
                  <Shot
                    seed={seed + index}
                    width={width}
                    height={shotHeight}
                  />
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.shotBottom}>
            {pages > 1 && (
              <View style={styles.gallery}>
                <View style={styles.dots}>
                  {shots.map((image, index) => (
                    <View
                      key={image.caption}
                      style={[styles.dot, index === shot && styles.dotOn]}
                    />
                  ))}
                </View>
                <Text style={styles.caption} numberOfLines={2}>
                  {shots[Math.min(shot, pages - 1)].caption}
                </Text>
              </View>
            )}
            <View style={styles.chip}>
              <Text style={styles.chipText}>{article.category}</Text>
            </View>
            <Text style={styles.headline}>{article.title}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.meta}>{t('news.trending')}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.meta}>{timeAgo(article.publishedAt)}</Text>
            </View>
          </View>
        </View>

        {/* La hoja del cuerpo, subida sobre la foto y con las esquinas redondas. */}
        <View style={styles.sheet}>
          <View style={styles.sourceRow}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>
                {article.source.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.sourceName} numberOfLines={1}>
              {article.source}
            </Text>
            <View style={styles.verified}>
              <CheckIcon size={12} color="#fff" />
            </View>
          </View>

          <Text style={styles.lead}>{article.summary}</Text>
          {article.body.map(paragraph => (
            <Text key={paragraph.slice(0, 24)} style={styles.body}>
              {paragraph}
            </Text>
          ))}
          <Text style={styles.author}>{article.author}</Text>

          {/* Solo si la noticia va de un canal que se puede ver. */}
          {article.channel !== undefined && (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                player.open(article.channel as number, {
                  presentation: 'immersive',
                })
              }
              style={({pressed}) => [styles.play, pressed && styles.pressed]}>
              <PlayIcon size={18} color="#0f0f0f" />
              <Text style={styles.playText}>{t('news.watchLive')}</Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* Los tres botones flotan sobre la foto, en cristal. */}
      <RoundButton
        accessibilityLabel={t('screen.liveTitle')}
        onPress={onBack}
        style={styles.back}>
        <ArrowBackIcon size={20} />
      </RoundButton>

      <View style={styles.topRight}>
        <RoundButton
          accessibilityLabel={t(saved ? 'news.saved' : 'news.save')}
          onPress={() => toggleFavourite(key).then(setFavourites)}>
          <FavoriteIcon size={18} color={saved ? '#e50914' : '#fff'} />
        </RoundButton>
        <RoundButton
          accessibilityLabel={t('detail.share')}
          onPress={() => Share.share({message: article.title})}>
          <ShareIcon size={18} />
        </RoundButton>
      </View>
    </View>
  );
}

/** La «foto» de la noticia, dibujada. */
function Shot({
  seed,
  width,
  height,
}: {
  seed: number;
  width: number;
  height: number;
}) {
  const [from, to] = SHOTS[seed % SHOTS.length];
  const id = `news-${seed}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="0.7" stopColor={to} />
          <Stop offset="1" stopColor="#0b0b0c" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  pressed: {opacity: 0.6},
  back: {position: 'absolute', top: 8, left: 16},
  topRight: {position: 'absolute', top: 8, right: 16, flexDirection: 'row', gap: 10},
  gallery: {gap: 6},
  dots: {flexDirection: 'row', gap: 6},
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotOn: {width: 18, backgroundColor: '#fff'},
  caption: {color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 15},
  shotBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    paddingHorizontal: 20,
    gap: 10,
  },
  chip: {
    alignSelf: 'flex-start',
    backgroundColor: '#4c9aff',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  headline: {color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 30},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  meta: {color: 'rgba(255,255,255,0.75)', fontSize: 12},
  metaDot: {color: 'rgba(255,255,255,0.5)', fontSize: 12},
  liveDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#e50914'},
  // La hoja sube sobre la foto: es lo que da la sensación de capa de encima.
  sheet: {
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#1a1a1c',
    padding: 20,
    gap: 16,
    minHeight: 320,
  },
  sourceRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  logo: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
  },
  logoText: {color: '#fff', fontSize: 11, fontWeight: '800'},
  sourceName: {flex: 1, color: '#fff', fontSize: 17, fontWeight: '800'},
  verified: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4c9aff',
  },
  lead: {color: '#fff', fontSize: 16, fontWeight: '600', lineHeight: 24},
  body: {color: '#c9c9ce', fontSize: 15, lineHeight: 24},
  author: {color: '#8a8a8f', fontSize: 12},
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 26,
    paddingVertical: 14,
  },
  playText: {color: '#0f0f0f', fontWeight: '700', fontSize: 15},
});
