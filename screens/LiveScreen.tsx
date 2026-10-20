import React, {useRef, useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {liveChannels, useCatalog} from '../sources';
import {ARTICLES, FEATURED, RECOMMENDED, type Article} from '../news';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {useTabBarSpace} from '../components/TabBar';
import {timeAgo} from '../components/format';
import {CheckIcon, CloseIcon, SearchIcon} from '../components/icons';

/**
 * Pestaña de noticias: «Última hora» en carrusel, las recomendadas en lista y,
 * al final, los canales en directo del catálogo.
 *
 * Las noticias son de prueba (ver `news.ts`); los canales son de verdad y se
 * abren en horizontal a pantalla completa.
 */

/** Colores de las «fotos»: no hay imágenes, se dibujan (ver `Poster`). */
const SHOTS: Array<[string, string]> = [
  ['#2f6fb0', '#0f2740'],
  ['#b05a2f', '#3a1c0f'],
  ['#2f8f6f', '#0f3027'],
  ['#6b4ea8', '#241a3a'],
];

const LINK = '#4c9aff';
/** Cabecera que aparece al bajar, igual que en Inicio. */
const HEADER_HEIGHT = 56;
const HEADER_FADE = 100;
/** Lo que ocupa el buscador cuando está abierto. */
const SEARCH_HEIGHT = 56;
/** Alto de la tarjeta destacada y hueco entre tarjetas. */
const CARD_HEIGHT = 200;
const CARD_GAP = 12;

export default function LiveScreen({
  onSeeAll,
  onOpenNews,
}: {
  /** «Ver todo» abre la rejilla con todos los canales. */
  onSeeAll: () => void;
  /** Abre una noticia. */
  onOpenNews: (id: string) => void;
}) {
  const player = usePlayer();
  useCatalog();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  const [query, setQuery] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  // Cuánto se ha bajado: de aquí salen el fondo de la cabecera y el cristal
  // del icono, igual que en Inicio.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const glassOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const term = (query ?? '').trim().toLowerCase();
  // Buscando se mira todo el montón, no solo las recomendadas.
  const listed = term
    ? ARTICLES.filter(article =>
        `${article.title} ${article.category} ${article.source}`
          .toLowerCase()
          .includes(term),
      )
    : RECOMMENDED;

  // La tarjeta no llega al borde: se asoma la siguiente, como en el diseño.
  const cardWidth = Math.round(width - 72);
  const cardStep = cardWidth + CARD_GAP;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        // Solo mueve opacidades: puede ir por el hilo nativo.
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        contentContainerStyle={{
          // El contenido pasa por debajo de la cabecera (y del buscador, si está).
          paddingTop: HEADER_HEIGHT + (query !== null ? SEARCH_HEIGHT : 0),
          paddingBottom:
            tabBarSpace +
            24 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        }}>
        {/* Destacadas: solo cuando no se está buscando. */}
        {!term && (
          <>
            <Section title={t('news.breaking')} />

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              // Encaja tarjeta a tarjeta aunque no ocupen la pantalla entera.
              snapToInterval={cardStep}
              snapToAlignment="start"
              decelerationRate="fast"
              contentContainerStyle={styles.cards}
              onMomentumScrollEnd={event =>
                setPage(
                  Math.round(
                    event.nativeEvent.contentOffset.x / Math.max(1, cardStep),
                  ),
                )
              }>
              {FEATURED.map((article, index) => (
                <Pressable
                  key={article.id}
                  accessibilityRole="button"
                  onPress={() => onOpenNews(article.id)}
                  style={({pressed}) => [
                    styles.card,
                    {width: cardWidth},
                    pressed && styles.pressed,
                  ]}>
                  <Shot seed={index} width={cardWidth} height={CARD_HEIGHT} />
                  {/* Degradado al pie: el texto se lee sin tapar la foto con
                      una banda. */}
                  <Scrim width={cardWidth} height={CARD_HEIGHT} />

                  <View style={styles.chip}>
                    <Text style={styles.chipText}>{article.category}</Text>
                  </View>

                  <View style={styles.cardBottom}>
                    <Byline article={article} />
                    <Text style={styles.headline} numberOfLines={2}>
                      {article.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.dots}>
              {FEATURED.map((article, index) => (
                <View
                  key={article.id}
                  style={[styles.dot, index === page && styles.dotOn]}
                />
              ))}
            </View>
          </>
        )}

        <Section title={t('news.recommended')} />

        {listed.length === 0 ? (
          <Text style={styles.empty}>{t('news.empty', {query: term})}</Text>
        ) : (
          listed.map((article, index) => (
            <Pressable
              key={article.id}
              accessibilityRole="button"
              onPress={() => onOpenNews(article.id)}
              style={({pressed}) => [styles.row, pressed && styles.pressed]}>
              <View style={styles.thumb}>
                <Shot seed={index + FEATURED.length} width={92} height={92} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.category}>{article.category}</Text>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <Byline article={article} />
              </View>
            </Pressable>
          ))
        )}

        {/* Los canales, que son lo único que se puede ver de verdad. */}
        {!term && (
          <>
            <Section title={t('news.all')} onSeeAll={onSeeAll} />
            {liveChannels().map(channel => (
              <Pressable
                key={channel.index}
                accessibilityRole="button"
                onPress={() =>
                  player.open(channel.index, {presentation: 'immersive'})
                }
                style={({pressed}) => [styles.row, pressed && styles.pressed]}>
                <View style={styles.thumb}>
                  <Shot seed={channel.index} width={92} height={92} />
                </View>
                <View style={styles.rowText}>
                  <Text style={styles.category}>{channel.label}</Text>
                  <Text style={styles.rowTitle} numberOfLines={2}>
                    {channel.title}
                  </Text>
                  <View style={styles.sourceRow}>
                    <View style={styles.dotLive} />
                    <Text style={styles.source}>{t('news.live')}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}
      </Animated.ScrollView>

      {/* Cabecera: el título siempre, y el fondo solo cuando se ha bajado. */}
      <View pointerEvents="box-none" style={styles.header}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.headerBack,
            {opacity: headerOpacity},
          ]}
        />

        <Text style={styles.appTitle}>{t('screen.liveTitle')}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('news.search')}
          onPress={() => setQuery(current => (current === null ? '' : null))}
          hitSlop={10}
          style={({pressed}) => [styles.circle, pressed && styles.pressed]}>
          {/* El fondo del icono se va con la cabecera puesta. */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.circleBack,
              {opacity: glassOpacity},
            ]}
          />
          {query === null ? (
            <SearchIcon size={20} color="#fff" />
          ) : (
            <CloseIcon size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      {/* El buscador se queda pegado bajo la cabecera, sobre fondo opaco: la
          lista pasa por debajo y si no se leería a través de él. */}
      {query !== null && (
        <View style={styles.searchBar}>
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder={t('news.search')}
            placeholderTextColor="#8a8a8f"
            style={styles.input}
          />
        </View>
      )}
    </View>
  );
}

/** Medio, verificado y cuándo se publicó. */
function Byline({article}: {article: Article}) {
  return (
    <View style={styles.sourceRow}>
      <View style={styles.logo}>
        <Text style={styles.logoText}>
          {article.source.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={styles.source} numberOfLines={1}>
        {article.source}
      </Text>
      <View style={styles.verified}>
        <CheckIcon size={9} color="#fff" />
      </View>
      <Text style={styles.sourceDot}>·</Text>
      <Text style={styles.source}>{timeAgo(article.publishedAt)}</Text>
    </View>
  );
}

/** Título de sección con su «Ver todo» a la derecha. */
function Section({title, onSeeAll}: {title: string; onSeeAll?: () => void}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
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
  );
}

/** Oscurecido de abajo para que el texto se lea sobre la foto. */
function Scrim({width, height}: {width: number; height: number}) {
  const id = `scrim-${width}`;
  return (
    <Svg
      width={width}
      height={height}
      style={StyleSheet.absoluteFill}
      pointerEvents="none">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0.35" stopColor="#000" stopOpacity="0" />
          <Stop offset="1" stopColor="#000" stopOpacity="0.85" />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
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
  const id = `shot-${seed}-${width}`;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <Stop offset="0" stopColor={from} />
          <Stop offset="1" stopColor={to} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={height} fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  pressed: {opacity: 0.6},
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
  headerBack: {backgroundColor: '#0f0f0f'},
  appTitle: {color: '#fff', fontSize: 24, fontWeight: '800'},
  circle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleBack: {backgroundColor: '#1f1f22'},
  searchBar: {
    position: 'absolute',
    top: HEADER_HEIGHT,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: '#0f0f0f',
  },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    fontSize: 14,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 10,
  },
  sectionTitle: {color: '#fff', fontSize: 20, fontWeight: '800'},
  seeAll: {color: LINK, fontSize: 13, fontWeight: '600'},
  cards: {paddingHorizontal: 16, gap: CARD_GAP},
  card: {
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chip: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: LINK,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  chipText: {color: '#fff', fontSize: 11, fontWeight: '700'},
  cardBottom: {padding: 14, gap: 8},
  sourceRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  dotLive: {width: 7, height: 7, borderRadius: 4, backgroundColor: '#e50914'},
  source: {color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '600'},
  sourceDot: {color: 'rgba(255,255,255,0.6)', fontSize: 11},
  logo: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
  },
  logoText: {color: '#fff', fontSize: 8, fontWeight: '800'},
  verified: {
    width: 13,
    height: 13,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: LINK,
  },
  headline: {color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 22},
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  dotOn: {width: 18, backgroundColor: LINK},
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  thumb: {width: 92, height: 92, borderRadius: 12, overflow: 'hidden'},
  rowText: {flex: 1, gap: 4},
  category: {color: '#8a8a8f', fontSize: 11, fontWeight: '600'},
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '800', lineHeight: 20},
  empty: {color: '#8a8a8f', fontSize: 13, paddingHorizontal: 16},
});
