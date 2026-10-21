import React, {useState} from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {ARTICLES, FEATURED, RECOMMENDED, type Article} from '../news';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {useTabBarSpace} from '../components/TabBar';
import {timeAgo} from '../components/format';
import {CheckIcon} from '../components/icons';
import {
  CARD_GAP,
  CARD_HEIGHT,
  guide,
  GuideHeader,
  HEADER_HEIGHT,
  Scrim,
  SEARCH_HEIGHT,
  Section,
  Shot,
  useGuideScroll,
} from '../components/guide';

/**
 * Portada de Noticias: «Última hora» en carrusel y las recomendadas en lista.
 *
 * Era la mitad de `LiveScreen`, que llevaba noticias y canales en la misma
 * pantalla. Ahora cada cosa tiene la suya y comparten la forma (ver `guide`).
 *
 * Las noticias son de prueba (ver `news.ts`), así que esta pestaña no se ofrece
 * en la barra: se llega desde una noticia guardada en Favoritos.
 */
export default function NewsHomeScreen({
  onOpenNews,
}: {
  /** Abre una noticia. */
  onOpenNews: (id: string) => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  const [query, setQuery] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const {scrollY, headerOpacity, glassOpacity} = useGuideScroll();

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
    <View style={guide.container}>
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
              contentContainerStyle={guide.cards}
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
                    guide.card,
                    {width: cardWidth},
                    pressed && guide.pressed,
                  ]}>
                  <Shot seed={index} width={cardWidth} height={CARD_HEIGHT} />
                  {/* Degradado al pie: el texto se lee sin tapar la foto con
                      una banda. */}
                  <Scrim width={cardWidth} height={CARD_HEIGHT} />

                  <View style={guide.chip}>
                    <Text style={guide.chipText}>{article.category}</Text>
                  </View>

                  <View style={guide.cardBottom}>
                    <Byline article={article} />
                    <Text style={guide.headline} numberOfLines={2}>
                      {article.title}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>

            <View style={guide.dots}>
              {FEATURED.map((article, index) => (
                <View
                  key={article.id}
                  style={[guide.dot, index === page && guide.dotOn]}
                />
              ))}
            </View>
          </>
        )}

        <Section title={t('news.recommended')} />

        {listed.length === 0 ? (
          <Text style={guide.empty}>{t('news.emptyNews', {query: term})}</Text>
        ) : (
          listed.map((article, index) => (
            <Pressable
              key={article.id}
              accessibilityRole="button"
              onPress={() => onOpenNews(article.id)}
              style={({pressed}) => [guide.row, pressed && guide.pressed]}>
              <View style={guide.thumb}>
                <Shot seed={index + FEATURED.length} width={92} height={92} />
              </View>
              <View style={guide.rowText}>
                <Text style={guide.category}>{article.category}</Text>
                <Text style={guide.rowTitle} numberOfLines={2}>
                  {article.title}
                </Text>
                <Byline article={article} />
              </View>
            </Pressable>
          ))
        )}
      </Animated.ScrollView>

      <GuideHeader
        title={t('screen.newsTitle')}
        searchLabel={t('news.searchNews')}
        query={query}
        onQuery={setQuery}
        headerOpacity={headerOpacity}
        glassOpacity={glassOpacity}
      />
    </View>
  );
}

/** Medio, verificado y cuándo se publicó. */
function Byline({article}: {article: Article}) {
  return (
    <View style={guide.sourceRow}>
      <View style={guide.logo}>
        <Text style={guide.logoText}>
          {article.source.slice(0, 2).toUpperCase()}
        </Text>
      </View>
      <Text style={guide.source} numberOfLines={1}>
        {article.source}
      </Text>
      <View style={guide.verified}>
        <CheckIcon size={9} color="#fff" />
      </View>
      <Text style={guide.sourceDot}>·</Text>
      <Text style={guide.source}>{timeAgo(article.publishedAt)}</Text>
    </View>
  );
}
