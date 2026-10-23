import React, {useEffect, useRef, useState} from 'react';
import {Animated, BackHandler, Linking, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View} from 'react-native';
import Text from '../components/Text';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';
import SOURCES, {movies, useCatalog} from '../sources';
import {t} from '../i18n';
import FadeIn from '../components/FadeIn';
import FadeImage from '../components/FadeImage';
import {usePlayer} from '../player/PlayerContext';
import {useTabBarSpace} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import Poster from '../components/Poster';
import GradientFill from '../components/GradientFill';
import ScreenHeader, {HEADER_HEIGHT} from '../components/ScreenHeader';
import ExpandableText from '../components/ExpandableText';
import {AddIcon, CheckIcon, PlayIcon, ShareIcon} from '../components/icons';
import {formatTime} from '../components/format';
import {fetchFacts, type MovieFacts} from '../api/tmdb';
import {
  loadFavourites,
  loadPositions,
  toggleFavourite,
  type Positions,
} from '../player/storage';

/**
 * Ficha de una película, con la forma que tiene en Netflix: portada arriba,
 * título con sus accesos, datos, botón grande, sinopsis, capítulos y más
 * películas.
 *
 * Aquí **no** hay reproductor: para eso está el botón. Al darle, la película se
 * abre en horizontal a pantalla completa (el mismo modo inmersivo que usan los
 * episodios, ver `PlayerHost`), y al cerrarla se vuelve a esta ficha.
 */

/** Degradados de la portada; se elige uno por el título. */
const ART: Array<[string, string]> = [
  ['#7b2d26', '#140b0d'],
  ['#1f3a5f', '#0b1118'],
  ['#4a2b6b', '#120c1c'],
  ['#1d4d43', '#0a1513'],
];

export default function DetailScreen({
  index,
  onBack,
  onOpenMovie,
}: {
  /** Índice en el catálogo de la película que se está mirando. */
  index: number;
  onBack: () => void;
  /** «Más películas» cambia de ficha sin salir de la pantalla. */
  onOpenMovie: (index: number) => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const {width} = useWindowDimensions();
  // El catálogo crece con las películas del archivo (ver `sources`).
  useCatalog();
  const current = SOURCES[index];
  const uri = current.source.uri;

  const [positions, setPositions] = useState<Positions>({});
  const [favourites, setFavourites] = useState<string[]>([]);
  // Ficha de TMDb: cartel, fondo, sinopsis en el idioma de la app, géneros,
  // reparto y nota. Se pide al abrir la película y queda guardada, así que la
  // segunda vez no hay petición.
  const [facts, setFacts] = useState<MovieFacts | null>(null);
  // Si el cartel de TMDb no carga, se vuelve a la miniatura del archivo.
  const [posterBroken, setPosterBroken] = useState(false);
  // Se relee al cerrar el reproductor: puede haber cambiado lo visto.
  useEffect(() => {
    loadPositions().then(setPositions);
    loadFavourites().then(setFavourites);
  }, [index, player.index]);

  useEffect(() => {
    let alive = true;
    setFacts(null);
    setPosterBroken(false);
    fetchFacts(current.title, current.year).then(found => {
      if (alive) {
        setFacts(found);
      }
    });
    return () => {
      alive = false;
    };
  }, [current.title, current.year]);

  // Atrás vuelve a la lista, salvo con la película abierta: entonces manda el
  // reproductor y devolvemos false para que le llegue a él (este efecto se vuelve
  // a suscribir en cada render que cambie `onBack`, así que no vale confiar en el
  // orden de registro).
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

  const saved = positions[uri];
  // Lo visto, que es lo único «medido» que tenemos del vídeo; va en verde donde
  // Netflix pone el porcentaje de coincidencia.
  const percent =
    saved && saved.duration > 0
      ? Math.round((saved.seconds / saved.duration) * 100)
      : 0;
  // La duración solo se conoce una vez reproducido; si no, la de los capítulos.
  const duration = saved?.duration || current.chapters?.at(-1)?.end || 0;
  const favourite = favourites.includes(uri);
  const others = movies().filter(item => item.index !== index);

  const artWidth = width - 32;
  const artHeight = Math.round((artWidth * 9) / 16);
  const scrollY = useRef(new Animated.Value(0)).current;
  /**
   * Dónde está el título grande dentro del scroll, medido al colocarse: el de
   * la cabecera solo entra **cuando éste ya está tapado**, no antes, o se ven
   * los dos a la vez.
   *
   * Hacen falta las dos medidas porque `onLayout` da la posición dentro del
   * padre: la del bloque de texto dentro del contenido, y la de la fila del
   * título dentro del bloque.
   */
  const [bodyY, setBodyY] = useState(0);
  const [titleBottom, setTitleBottom] = useState(0);
  // Hasta que hay medida, un número al que no se llega: antes de saberlo, el
  // título de la cabecera no sale.
  const titleAt =
    bodyY > 0 && titleBottom > 0 ? bodyY + titleBottom - HEADER_HEIGHT : 1e6;

  return (
    <View style={styles.container}>
      <Animated.ScrollView
        contentContainerStyle={{
          paddingBottom:
            tabBarSpace +
            24 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {
            useNativeDriver: true,
          },
        )}>
        {/* Portada: una tarjeta, no el vídeo. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('screen.play')}
          onPress={() => play(player, index)}
          style={({pressed}) => [
            styles.art,
            {height: artHeight},
            pressed && styles.pressed,
          ]}>
          <Art
            title={current.title}
            image={
              // La tarjeta es 16:9: manda el fondo apaisado, no el cartel.
              (!posterBroken ? facts?.backdrop ?? facts?.poster : undefined) ??
              current.backdrop ??
              current.poster
            }
            onImageError={() => setPosterBroken(true)}
            width={artWidth}
            height={artHeight}
          />
          <View style={styles.artPlay}>
            <PlayIcon size={26} color="#fff" />
          </View>
        </Pressable>

        <View
          style={styles.body}
          onLayout={event => setBodyY(event.nativeEvent.layout.y)}>
          {/* Título a la izquierda y, a su altura, los accesos: es la fila que
              en Netflix lleva el logo de la película y los iconos. */}
          <View
            style={styles.titleRow}
            onLayout={event => {
              const {y, height} = event.nativeEvent.layout;
              setTitleBottom(y + height);
            }}>
            <Text style={styles.title} numberOfLines={2}>
              {current.title}
            </Text>
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
                onPress={() => toggleFavourite(uri).then(setFavourites)}
              />
              <Action
                label={t('detail.share')}
                icon={<ShareIcon size={22} color="#fff" />}
                onPress={() =>
                  Share.share({message: `${current.title} — ${uri}`})
                }
              />
            </View>
          </View>

          <View style={styles.metaRow}>
            {percent > 0 && (
              <Text style={styles.match}>{t('detail.watched', {percent})}</Text>
            )}
            {facts?.rating ? (
              <Text style={styles.score}>
                {t('detail.score', {rating: facts.rating.toFixed(1)})}
              </Text>
            ) : null}
            <Text style={styles.meta}>{current.label}</Text>
            {/* La duración buena es la de la ficha; la del vídeo solo se sabe
                tras reproducirlo. */}
            <Text style={styles.meta}>
              {facts?.runtime
                ? t('detail.minutes', {count: facts.runtime})
                : duration > 0
                ? formatTime(duration)
                : ''}
            </Text>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{t('detail.quality')}</Text>
            </View>
          </View>

          {/* Los géneros llegan de TMDb, unos segundos después que el resto de
              la ficha: aparecen con un fundido en vez de plantarse. */}
          {facts && facts.genres.length > 0 ? (
            <FadeIn>
              <Text style={styles.genre}>{facts.genres.join(' · ')}</Text>
            </FadeIn>
          ) : null}

          {/* Donde Netflix pone «Most Liked» va lo único que sabemos del
              usuario: por dónde iba. */}
          {saved && saved.seconds > 0 && (
            <View style={styles.chip}>
              <View style={styles.chipDot}>
                <PlayIcon size={12} color="#fff" />
              </View>
              <Text style={styles.chipText}>
                {t('screen.continueWatching', {
                  position: formatTime(saved.seconds),
                })}
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={() => play(player, index)}
            style={({pressed}) => [styles.play, pressed && styles.pressed]}>
            {/* El botón principal lleva el degradado de la marca de fondo. */}
            <GradientFill />
            <PlayIcon size={18} color="#fff" />
            <Text style={styles.playText}>
              {t(saved && saved.seconds > 0 ? 'screen.resume' : 'screen.play')}
            </Text>
          </Pressable>

          {/* El tráiler es de YouTube (lo da TMDb), así que no pasa por
              nuestro reproductor: se abre en YouTube. Incrustarlo en un WebView
              se probó y el reproductor de YouTube contesta «error 152» donde no
              hay servicios de Google, así que no es de fiar. */}
          {facts?.trailer ? (
            <FadeIn>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Linking.openURL(
                    `https://www.youtube.com/watch?v=${facts.trailer}`,
                  )
                }
                style={({pressed}) => [
                  styles.ghost,
                  pressed && styles.pressed,
                ]}>
                <PlayIcon size={16} color="#fff" />
                <Text style={styles.ghostText}>{t('detail.trailer')}</Text>
              </Pressable>
            </FadeIn>
          ) : null}

          <Text style={styles.section}>{t('detail.synopsis')}</Text>
          {/* La de TMDb cuando la hay; si no, la del archivo. La `key` cambia
              al llegar la de TMDb: se monta otra y entra con fundido, en vez de
              cambiarte el texto delante de los ojos. */}
          <FadeIn key={facts?.overview ? 'tmdb' : 'local'}>
            <ExpandableText
              text={facts?.overview ?? current.description}
              style={styles.description}
            />
          </FadeIn>

          {/* Dirección y reparto, cuando OMDb los conoce. */}
          {facts?.director ? (
            <FadeIn>
              <Text style={styles.credit}>
                {t('detail.director', {name: facts.director})}
              </Text>
            </FadeIn>
          ) : null}
          {facts && facts.cast.length > 0 ? (
            <FadeIn>
              <Text style={styles.credit}>
                {t('detail.cast', {names: facts.cast.join(', ')})}
              </Text>
            </FadeIn>
          ) : null}

          {player.error ? (
            <Text style={styles.error}>
              {t('screen.error', {message: player.error})}
            </Text>
          ) : null}
        </View>

        {/* Capítulos: solo los tiene parte del catálogo. */}
        {current.chapters && current.chapters.length > 0 && (
          <Row title={t('detail.chapters')}>
            {current.chapters.map(chapter => (
              <View key={chapter.start} style={styles.chapter}>
                <View style={styles.chapterDisc}>
                  <Text style={styles.chapterStart}>
                    {formatTime(chapter.start)}
                  </Text>
                </View>
                <Text style={styles.chapterTitle} numberOfLines={1}>
                  {chapter.title}
                </Text>
                <Text style={styles.chapterTime} numberOfLines={1}>
                  {chapter.skippable
                    ? t('detail.skippable')
                    : formatTime(chapter.end)}
                </Text>
              </View>
            ))}
          </Row>
        )}

        <Row title={t('detail.more')}>
          {others.map(item => (
            <Poster
              key={item.index}
              title={item.title}
              subtitle={item.label}
              image={item.poster}
              width={124}
              height={186}
              onPress={() => onOpenMovie(item.index)}
            />
          ))}
        </Row>
      </Animated.ScrollView>

      {/* Al principio solo la flecha sobre la portada; al bajar, fondo y el
          título de la película (ver `ScreenHeader`, la misma que la serie). */}
      <ScreenHeader
        scrollY={scrollY}
        title={current.title}
        titleAt={titleAt}
        onBack={onBack}
        backLabel={t('detail.close')}
      />
    </View>
  );
}

/** Reproducir: en horizontal y a pantalla completa, como un episodio. */
function play(player: ReturnType<typeof usePlayer>, index: number) {
  player.open(index, {presentation: 'immersive'});
}

/** Icono suelto de la fila del título. */
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
    </Pressable>
  );
}

/** Carrusel horizontal con su título. */
function Row({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.section, styles.rowTitle]}>{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rowItems}>
        {children}
      </ScrollView>
    </View>
  );
}

/** Portada dibujada: no hay imágenes en el catálogo (ver `Poster`). */
function Art({
  title,
  image,
  onImageError,
  width,
  height,
}: {
  title: string;
  /** Carátula real; sin ella se queda el degradado dibujado. */
  image?: string;
  /** La imagen no se pudo cargar (pasa con algunos carteles de IMDb). */
  onImageError?: () => void;
  width: number;
  height: number;
}) {
  const [from, to] = ART[title.length % ART.length];
  // El id tiene que ser único dentro del documento SVG.
  const id = `movie-${title.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect width={width} height={height} fill={`url(#${id})`} />
      </Svg>
      {image ? (
        <FadeImage
          source={{uri: image}}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={onImageError}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  art: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  artPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  body: {paddingHorizontal: 16, paddingTop: 16, gap: 10},
  pressed: {opacity: 0.6},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {flex: 1, color: '#fff', fontSize: 20, fontWeight: '800'},
  metaRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  // El verde es el de «lo tuyo»: aquí, lo que ya llevas visto.
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2a2a2e',
    borderRadius: 6,
    paddingVertical: 11,
  },
  ghostText: {color: '#fff', fontWeight: '700', fontSize: 15},
  score: {color: '#21d07a', fontSize: 13, fontWeight: '800'},
  genre: {color: '#9a9aa0', fontSize: 13},
  credit: {color: '#9a9aa0', fontSize: 13, lineHeight: 19},
  match: {color: '#46d369', fontSize: 13, fontWeight: '700'},
  meta: {color: '#aaa', fontSize: 13},
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tagText: {color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700'},
  chip: {flexDirection: 'row', alignItems: 'center', gap: 8},
  chipDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e50914',
  },
  chipText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  play: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    // Pastilla, como el botón de la imagen.
    borderRadius: 26,
    // El degradado va dentro: sin esto se sale de las esquinas.
    overflow: 'hidden',
    paddingVertical: 14,
    marginTop: 6,
  },
  playText: {color: '#fff', fontWeight: '700', fontSize: 15},
  actions: {flexDirection: 'row', alignItems: 'center', gap: 18},
  action: {alignItems: 'center'},
  section: {color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 10},
  description: {color: '#9a9a9a', fontSize: 13, lineHeight: 20},
  error: {color: '#f66'},
  row: {marginTop: 18, gap: 10},
  rowTitle: {paddingHorizontal: 16},
  rowItems: {paddingHorizontal: 16, gap: 10},
  // Como el reparto de la imagen: disco, nombre y, debajo, el detalle.
  chapter: {width: 84, alignItems: 'center', gap: 6},
  chapterDisc: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  chapterStart: {color: '#fff', fontSize: 13, fontWeight: '700'},
  chapterTitle: {color: '#fff', fontSize: 12, fontWeight: '600'},
  chapterTime: {color: '#888', fontSize: 11},
});
