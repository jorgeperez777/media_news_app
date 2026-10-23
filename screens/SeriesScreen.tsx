import React, {useEffect, useMemo, useRef, useState} from 'react';
import {Animated, BackHandler, Image, Modal, Pressable, Share, StyleSheet, useWindowDimensions, View} from 'react-native';
import Text from '../components/Text';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import {
  allSeries,
  movies,
  useCatalog,
  type IndexedSource,
  type Series,
} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {useTabBarSpace} from '../components/TabBar';
import FadeIn from '../components/FadeIn';
import ScreenHeader, {
  HEADER_FADE,
  HEADER_HEIGHT,
} from '../components/ScreenHeader';
import {useReduceMotion} from '../components/motion';
import {PROGRESS_GRADIENT} from '../theme';
import {
  AddIcon,
  CheckIcon,
  ChevronIcon,
  PlayIcon,
  ReplayIcon,
  ShareIcon,
} from '../components/icons';
import ExpandableText from '../components/ExpandableText';
import Poster, {GRID_GAP, posterSize} from '../components/Poster';
import GradientFill from '../components/GradientFill';
import {formatLength} from '../components/format';
import {
  loadFavourites,
  loadPositions,
  resumeFrom,
  toggleFavourite,
  type Positions,
} from '../player/storage';

/**
 * Ficha de una serie, con la forma que tiene en Netflix: portada a sangre con
 * el título encima, botón grande que sabe por dónde ibas, sinopsis y la lista de
 * episodios por temporada.
 *
 * Aquí no hay hueco para el reproductor: tocar un episodio lo abre en modo
 * inmersivo (horizontal y a pantalla completa, ver `PlayerHost`) y al cerrarlo
 * se vuelve a esta pantalla.
 */

/** Degradados de la portada; se elige uno por el título. */
const ART: Array<[string, string]> = [
  ['#7b2d26', '#140b0d'],
  ['#1f3a5f', '#0b1118'],
  ['#4a2b6b', '#120c1c'],
  ['#1d4d43', '#0a1513'],
];
/** Un episodio se da por visto cuando queda menos de este trozo por delante. */
const WATCHED_RATIO = 0.95;

/** De qué ancho arranca la rayita de la pestaña al encenderse. */
const MARK_FROM = 0.15;

export default function SeriesScreen({
  series,
  onBack,
  onOpenSeries,
  onOpenMovie,
}: {
  series: Series;
  onBack: () => void;
  /** «Títulos similares» cambia de ficha sin salir de la pantalla. */
  onOpenSeries: (id: string) => void;
  onOpenMovie: (index: number) => void;
}) {
  const player = usePlayer();
  const {width} = useWindowDimensions();
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  useCatalog();
  // «Seguir viendo» de cada episodio: se relee al cerrar el reproductor.
  const [positions, setPositions] = useState<Positions>({});
  const [favourites, setFavourites] = useState<string[]>([]);
  useEffect(() => {
    loadPositions().then(setPositions);
    loadFavourites().then(setFavourites);
  }, [player.index]);
  // Pestaña abierta y hoja del selector de temporada, como en Netflix.
  const [tab, setTab] = useState<'episodes' | 'similar'>('episodes');
  const [picker, setPicker] = useState(false);

  // Atrás vuelve a la lista, salvo con un episodio abierto: entonces manda el
  // reproductor y devolvemos false para que le llegue a él (no basta con confiar
  // en el orden de registro: este efecto se vuelve a suscribir en cada render que
  // cambie `onBack`, y acabaría adelantándose al del reproductor).
  // En el miniplayer no manda el reproductor: atrás es de esta pantalla.
  const immersive =
    player.index !== null &&
    player.presentation === 'immersive' &&
    player.mode !== 'mini';
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (immersive) {
        return false;
      }
      // Con la hoja de temporadas abierta, atrás solo la cierra.
      if (picker) {
        setPicker(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, immersive, picker]);

  /** Temporadas en orden, con sus episodios. */
  const seasons = useMemo(() => groupBySeason(series), [series]);
  const [season, setSeason] = useState(seasons[0].number);
  const episodes =
    seasons.find(item => item.number === season)?.episodes ??
    seasons[0].episodes;

  // Por dónde ibas: el primer episodio a medias y, si no hay ninguno, el
  // primero sin ver. Es lo que decide qué hace el botón grande.
  const next =
    series.episodes.find(
      episode => resumeFrom(positions, episode.source.uri) > 0,
    ) ??
    series.episodes.find(episode => !isWatched(positions, episode)) ??
    series.episodes[0];
  const nextResume = resumeFrom(positions, next.source.uri);

  const open = (episode: IndexedSource, fromStart = false) =>
    player.open(episode.index, {presentation: 'immersive', fromStart});

  // La serie entra en «Mi lista» por el uri de su primer episodio: así la lista
  // la reconoce y la abre en esta ficha, sin inventar un formato de clave.
  const firstUri = series.episodes[0].source.uri;
  const favourite = favourites.includes(firstUri);

  // «Títulos similares»: el resto del catálogo con ficha propia (otras series y
  // las películas). No hay recomendador, así que es todo lo demás.
  const similar = [
    ...allSeries()
      .filter(item => item.id !== series.id)
      .map(item => ({
        key: `series-${item.id}`,
        title: item.title,
        subtitle: t('screen.seriesEpisodes', {count: item.episodes.length}),
        image: item.poster,
        onPress: () => onOpenSeries(item.id),
      })),
    ...movies().map(item => ({
      key: `movie-${item.index}`,
      title: item.title,
      subtitle: item.label,
      image: item.poster,
      onPress: () => onOpenMovie(item.index),
    })),
  ];

  const artHeight = Math.round(width * 1.25);
  // La medida compartida: una carátula mide lo mismo aquí que en Inicio o en
  // «Ver todo» (ver `posterSize`). Antes esta rejilla iba a dos columnas y sus
  // tarjetas eran casi el doble de anchas que las de al lado.
  const {width: cardWidth, height: cardHeight} = posterSize(width);

  // Cabecera al bajar, como en Inicio: solo mueve opacidades, así que el scroll
  // puede ir por el hilo nativo.
  const scrollY = useRef(new Animated.Value(0)).current;
  // El título de la cabecera solo entra cuando el grande de la portada ya se
  // ha ido (ver `ScreenHeader`).
  const titleAt = Math.max(HEADER_FADE, artHeight - HEADER_HEIGHT - 40);

  // Dónde empieza la barra de temporada dentro del contenido: a partir de ahí
  // se queda pegada bajo la cabecera (lo mide ella misma al colocarse).
  const [seasonY, setSeasonY] = useState(0);
  const stickAt = Math.max(1, seasonY - HEADER_HEIGHT);
  const stuckOpacity = scrollY.interpolate({
    inputRange: [stickAt - 12, stickAt],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const unstuckOpacity = scrollY.interpolate({
    inputRange: [stickAt - 12, stickAt],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  /** El botón de temporada: va en el contenido y, al pegarse, en la cabecera. */
  const seasonPicker =
    seasons.length > 1 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('series.season', {number: season})}
        onPress={() => setPicker(true)}
        style={({pressed}) => [styles.seasonButton, pressed && styles.pressed]}>
        <Text style={styles.seasonButtonText}>
          {t('series.season', {number: season})}
        </Text>
        <ChevronIcon size={18} color="#fff" />
      </Pressable>
    ) : (
      <Text style={styles.seasonTitle}>
        {t('series.season', {number: seasons[0].number})}
      </Text>
    );

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={{paddingBottom: tabBarSpace + 24}}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}>
        {/* Portada a sangre con el título encima */}
        <View style={{height: artHeight}}>
          <Art
            title={series.title}
            // Vertical: la portada es más alta que ancha, así que manda el
            // cartel y el fondo apaisado es el recambio.
            image={series.poster ?? series.backdrop}
            width={width}
            height={artHeight}
          />
          <View style={styles.artBottom}>
            <Text style={styles.title}>{series.title}</Text>
            <Text style={styles.meta}>
              {t('series.meta', {count: series.episodes.length})}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            onPress={() => open(next)}
            style={({pressed}) => [styles.play, pressed && styles.pressed]}>
            {/* El botón principal lleva el degradado de la marca de fondo. */}
            <GradientFill />
            <PlayIcon size={18} color="#fff" />
            <Text style={styles.playText}>
              {nextResume > 0 && next.episode
                ? t('series.resume', {
                    season: next.episode.season,
                    number: next.episode.number,
                  })
                : t('screen.play')}
            </Text>
          </Pressable>

          {/* Solo tiene sentido cuando hay algo que reiniciar. */}
          {nextResume > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => open(next, true)}
              style={({pressed}) => [styles.ghost, pressed && styles.pressed]}>
              <ReplayIcon size={18} color="#fff" />
              <Text style={styles.ghostText}>{t('series.restart')}</Text>
            </Pressable>
          )}

          <ExpandableText
            text={series.description}
            style={styles.description}
          />

          {/* Fila de accesos, como la de Netflix: icono arriba, etiqueta
              debajo. La serie se guarda por el uri de su primer episodio, que
              es lo que «Mi lista» sabe resolver (ver `FavouritesScreen`). */}
          <View style={styles.actions}>
            <Action
              label={t(favourite ? 'detail.added' : 'detail.myList')}
              icon={
                favourite ? (
                  <CheckIcon size={24} color="#fff" />
                ) : (
                  <AddIcon size={24} color="#fff" />
                )
              }
              onPress={() => toggleFavourite(firstUri).then(setFavourites)}
            />
            <Action
              label={t('detail.share')}
              icon={<ShareIcon size={22} color="#fff" />}
              onPress={() =>
                Share.share({message: `${series.title} — ${firstUri}`})
              }
            />
          </View>

          {/* Pestañas: la abierta lleva la barra roja encima. */}
          <View style={styles.tabs}>
            {(['episodes', 'similar'] as const).map(name => {
              const on = tab === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="tab"
                  accessibilityState={{selected: on}}
                  onPress={() => setTab(name)}
                  style={styles.tab}>
                  <TabMark on={on} />
                  <Text style={[styles.tabText, !on && styles.tabTextOff]}>
                    {t(
                      name === 'episodes'
                        ? 'series.episodesTab'
                        : 'series.similarTab',
                    )}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {tab === 'similar' && (
            <FadeIn style={styles.grid}>
              {similar.map(item => (
                <Poster
                  key={item.key}
                  title={item.title}
                  subtitle={item.subtitle}
                  image={item.image}
                  width={cardWidth}
                  height={cardHeight}
                  onPress={item.onPress}
                />
              ))}
            </FadeIn>
          )}
        </View>

        {/* Selector de temporada: un solo botón que abre la hoja, como en
            Netflix. Al llegar a la cabecera se queda pegado a ella: el de aquí
            se apaga y el de allí se enciende, así que no hay salto. */}
        {tab === 'episodes' && (
          <Animated.View
            onLayout={event => setSeasonY(event.nativeEvent.layout.y)}
            style={[styles.seasonBar, {opacity: unstuckOpacity}]}>
            {seasonPicker}
          </Animated.View>
        )}

        {tab === 'episodes' && (
          // `key={season}`: al cambiar de temporada se monta otra lista y la
          // entrada se repite, que es justo lo que confirma el cambio.
          <FadeIn key={season} style={styles.episodes}>
            {episodes.map(episode => (
              <EpisodeRow
                key={episode.index}
                episode={episode}
                saved={positions[episode.source.uri]}
                onPress={() => open(episode)}
              />
            ))}
          </FadeIn>
        )}
      </Animated.ScrollView>

      {/* Hoja de temporadas: se elige una y se cierra. */}
      <Modal
        visible={picker}
        transparent
        animationType="fade"
        // Igual que el menú del reproductor: sin esto, abrirlo en horizontal
        // mata la app en iOS (ver `VideoPlayer`).
        supportedOrientations={['portrait', 'landscape']}
        onRequestClose={() => setPicker(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('detail.close')}
          style={styles.backdrop}
          onPress={() => setPicker(false)}
        />
        <View style={[styles.sheet, {paddingBottom: 24 + insets.bottom}]}>
          {seasons.map(item => {
            const selected = item.number === season;
            return (
              <Pressable
                key={item.number}
                accessibilityRole="button"
                accessibilityState={{selected}}
                onPress={() => {
                  setSeason(item.number);
                  setPicker(false);
                }}
                style={({pressed}) => [
                  styles.sheetRow,
                  pressed && styles.pressed,
                ]}>
                <Text
                  style={[styles.sheetText, selected && styles.sheetTextOn]}>
                  {t('series.season', {number: item.number})}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Modal>

      {/* Debajo de la cabecera se queda pegado el botón de temporada. */}
      <ScreenHeader
        scrollY={scrollY}
        title={series.title}
        titleAt={titleAt}
        onBack={onBack}
        backLabel={t('screen.seriesTitle')}
      />

      {/* El botón de temporada, pegado bajo la cabecera. */}
      {tab === 'episodes' && (
        <Animated.View
          pointerEvents="box-none"
          style={[styles.stuck, {opacity: stuckOpacity}]}>
          {seasonPicker}
        </Animated.View>
      )}
    </View>
  );
}

/** Un acceso de la fila de abajo: icono arriba, etiqueta debajo. */
/**
 * La rayita de la pestaña abierta. Crece a lo ancho al encenderse en vez de
 * aparecer de golpe: es lo único que dice qué pestaña estás mirando, así que
 * conviene que el ojo la siga.
 *
 * El degradado está siempre puesto y lo que se anima es la opacidad: son dos
 * pestañas, no una lista.
 */
function TabMark({on}: {on: boolean}) {
  const lit = useRef(new Animated.Value(on ? 1 : 0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (reduceMotion) {
      lit.setValue(on ? 1 : 0);
      return;
    }
    const anim = Animated.spring(lit, {
      toValue: on ? 1 : 0,
      friction: 6,
      tension: 80,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [on, lit, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.tabMark,
        {
          opacity: lit,
          transform: [
            {
              scaleX: lit.interpolate({
                inputRange: [0, 1],
                outputRange: [MARK_FROM, 1],
              }),
            },
          ],
        },
      ]}>
      {/* La marca va con el degradado de la marca, nunca con un color plano. */}
      <GradientFill />
    </Animated.View>
  );
}

function Action({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={({pressed}) => [styles.action, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

/** Una fila de episodio: miniatura, título, duración y sinopsis. */
function EpisodeRow({
  episode,
  saved,
  onPress,
}: {
  episode: IndexedSource;
  saved?: Positions[string];
  onPress: () => void;
}) {
  const percent =
    saved && saved.duration > 0
      ? Math.min(100, (saved.seconds / saved.duration) * 100)
      : 0;
  const length = saved?.duration || episode.chapters?.at(-1)?.end || 0;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}>
      <View style={styles.rowHead}>
        <View style={styles.thumb}>
          {/* El fotograma del episodio cuando lo hay (las series de TMDb lo
              traen); si no, el degradado de siempre. */}
          <Art
            title={episode.title}
            image={episode.poster}
            width={128}
            height={72}
          />
          <View style={styles.thumbPlay}>
            <PlayIcon size={18} />
          </View>
          {percent > 0 && (
            <View style={styles.track}>
              <Image
                source={{uri: PROGRESS_GRADIENT}}
                style={[styles.fill, {width: `${percent}%`}]}
                resizeMode="stretch"
                fadeDuration={0}
              />
            </View>
          )}
        </View>

        <View style={styles.rowText}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {episode.episode
              ? t('series.episodeTitle', {
                  number: episode.episode.number,
                  title: episode.title,
                })
              : episode.title}
          </Text>
          {/* Netflix pone aquí la duración; la sabemos tras reproducir, y si
              no, por el final del último capítulo. */}
          <Text style={styles.rowMeta}>
            {length > 0 ? formatLength(length) : episode.label}
          </Text>
        </View>
      </View>

      {/* La sinopsis va a todo lo ancho, debajo de la miniatura. */}
      <ExpandableText
        text={episode.description}
        lines={2}
        style={styles.rowDescription}
        linkStyle={styles.rowMore}
      />
    </Pressable>
  );
}

/** Portada dibujada: no hay imágenes en el catálogo (ver `Poster`). */
function Art({
  title,
  image,
  width,
  height,
}: {
  title: string;
  /** Cartel de la serie, cuando lo hay (las de TMDb lo traen). */
  image?: string;
  width: number;
  height: number;
}) {
  const [from, to] = ART[title.length % ART.length];
  // El id tiene que ser único dentro del documento SVG.
  const id = `art-${title.replace(/[^a-z0-9]/gi, '')}-${width}`;

  // Con cartel, el degradado pasa de ser la portada a ser lo que oscurece el
  // pie: el título va encima y sobre una imagen clara no se leería.
  return (
    <>
      {!!image && (
        <Image
          source={{uri: image}}
          resizeMode="cover"
          style={StyleSheet.absoluteFill}
        />
      )}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2={image ? '0' : '0.3'} y2="1">
            <Stop
              offset="0"
              stopColor={image ? '#000' : from}
              stopOpacity={image ? 0 : 1}
            />
            <Stop
              offset="0.6"
              stopColor={image ? '#000' : to}
              stopOpacity={image ? 0.35 : 1}
            />
            <Stop offset="1" stopColor={image ? '#000' : '#0f0f0f'} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
    </>
  );
}

/** Episodios agrupados por temporada, en orden. */
function groupBySeason(series: Series) {
  const seasons: Array<{number: number; episodes: IndexedSource[]}> = [];
  for (const episode of series.episodes) {
    const number = episode.episode?.season ?? 1;
    const found = seasons.find(item => item.number === number);
    if (found) {
      found.episodes.push(episode);
    } else {
      seasons.push({number, episodes: [episode]});
    }
  }
  return seasons.sort((a, b) => a.number - b.number);
}

/** Terminado (o casi): ya no cuenta como «lo que viene ahora». */
function isWatched(positions: Positions, episode: IndexedSource) {
  const saved = positions[episode.source.uri];
  return (
    !!saved &&
    saved.duration > 0 &&
    saved.seconds / saved.duration > WATCHED_RATIO
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  pressed: {opacity: 0.6},
  // La copia pegada va justo debajo de la cabecera, con fondo opaco para que
  // los episodios no se vean pasar por detrás.
  stuck: {
    position: 'absolute',
    top: HEADER_HEIGHT,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#0f0f0f',
  },
  artBottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 12,
    gap: 6,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 1,
    textAlign: 'center',
  },
  meta: {color: 'rgba(255,255,255,0.75)', fontSize: 12, letterSpacing: 1},
  body: {paddingHorizontal: 16, gap: 12},
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 6,
    paddingVertical: 11,
    // El degradado va dentro: sin esto se sale de las esquinas.
    overflow: 'hidden',
  },
  playText: {color: '#fff', fontWeight: '700', fontSize: 15},
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 6,
    paddingVertical: 11,
  },
  ghostText: {color: '#fff', fontWeight: '700', fontSize: 15},
  description: {color: '#ccc', fontSize: 13, lineHeight: 19},
  actions: {flexDirection: 'row', gap: 36, paddingVertical: 8},
  action: {alignItems: 'center', gap: 6, minWidth: 64},
  actionText: {color: '#b3b3b3', fontSize: 11, fontWeight: '600'},
  tabs: {flexDirection: 'row', gap: 20, marginTop: 4},
  tab: {gap: 8},
  tabMark: {height: 3, borderRadius: 2, overflow: 'hidden'},
  tabText: {color: '#fff', fontSize: 15, fontWeight: '700'},
  tabTextOff: {color: '#8c8c8c'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP},
  // El selector es un botón, no una fila de chips: con ocho temporadas los
  // chips se desbordarían.
  seasonButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 4,
    backgroundColor: '#2b2b2b',
  },
  seasonButtonText: {color: '#fff', fontSize: 14, fontWeight: '700'},
  seasonTitle: {color: '#fff', fontSize: 14, fontWeight: '700'},
  seasonBar: {paddingHorizontal: 16, paddingVertical: 10},
  episodes: {paddingHorizontal: 16, gap: 12},
  backdrop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#141414',
    paddingVertical: 24,
    gap: 4,
  },
  sheetRow: {paddingVertical: 14, alignItems: 'center'},
  sheetText: {color: '#8c8c8c', fontSize: 17, fontWeight: '600'},
  sheetTextOn: {color: '#fff', fontWeight: '800'},
  row: {gap: 8, paddingVertical: 8},
  rowHead: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  thumb: {
    width: 128,
    height: 72,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#272727',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbPlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fill: {height: '100%'},
  rowText: {flex: 1, gap: 4},
  rowTitle: {color: '#fff', fontSize: 14, fontWeight: '700'},
  rowMeta: {color: '#888', fontSize: 12},
  rowDescription: {color: '#aaa', fontSize: 12, lineHeight: 17},
  rowMore: {fontSize: 12},
});
