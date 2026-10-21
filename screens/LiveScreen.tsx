import React, {useEffect, useState} from 'react';
import {
  Animated,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {isLive, liveChannels, useCatalog} from '../sources';
import {loadFavourites, toggleFavourite} from '../player/storage';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {useTabBarSpace} from '../components/TabBar';
import {ArrowBackIcon, FavoriteIcon, PipIcon} from '../components/icons';
import Skeleton from '../components/Skeleton';
import {ACCENT, PROGRESS_GRADIENT} from '../theme';
import {
  guide,
  GuideHeader,
  HEADER_HEIGHT,
  SEARCH_HEIGHT,
  Shot,
  useGuideScroll,
} from '../components/guide';

/**
 * Pestaña de TV en vivo: la guía de una tele, no un catálogo.
 *
 * Arriba el canal sonando, debajo qué es, y luego la parrilla entera: cada
 * canal en una fila con su disco, su barra y su número a la derecha, como en
 * las apps de televisión. Cambiar de canal es tocar una fila; no hay fichas ni
 * pantallas intermedias.
 *
 * El reproductor no vive aquí —es el de siempre, `PlayerHost`— y esta pantalla
 * solo le dice **en qué hueco** dibujarse (`setAnchor`), justo debajo de la
 * cabecera.
 *
 * Las noticias se fueron a su propia pantalla (`NewsHomeScreen`); las dos
 * comparten la cabecera y el buscador a través de `guide`.
 */
export default function LiveScreen({
  onSeeAll,
}: {
  /** «Ver todo» abre la rejilla con todos los canales. */
  onSeeAll: () => void;
}) {
  const player = usePlayer();
  useCatalog();
  const tabBarSpace = useTabBarSpace();
  const insets = useSafeAreaInsets();
  const {width} = useWindowDimensions();
  const [query, setQuery] = useState<string | null>(null);
  /** Qué lista se enseña: todos los canales o solo los guardados. */
  const [list, setList] = useState<'all' | 'saved'>('all');
  /** Categoría elegida; `null` es «todas». */
  const [chip, setChip] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  /** Lo guardado se lee del almacén: hasta que llega, huecos. */
  const [ready, setReady] = useState(false);
  // El último canal que se puso. Sirve para que, al cerrar el reproductor, el
  // hueco de arriba siga ofreciendo algo en vez de quedarse en negro.
  const [last, setLast] = useState<number | null>(null);
  const {scrollY, headerOpacity, glassOpacity} = useGuideScroll();

  useEffect(() => {
    loadFavourites().then(next => {
      setSaved(next);
      setReady(true);
    });
  }, [player.index, list]);

  const term = (query ?? '').trim().toLowerCase();
  const all = liveChannels();
  /** Las categorías que haya en el catálogo, en el orden en que aparecen. */
  const chips = all
    .flatMap(channel => channel.genres ?? [])
    .filter((genre, at, list_) => list_.indexOf(genre) === at);
  const channels = all
    .filter(channel =>
      list === 'saved' ? saved.includes(channel.source.uri) : true,
    )
    .filter(channel => (chip ? channel.genres?.includes(chip) : true))
    .filter(channel =>
      term
        ? `${channel.title} ${channel.label}`.toLowerCase().includes(term)
        : true,
    );

  const videoHeight = Math.round((width * 9) / 16);
  const searchOpen = query !== null;

  /** El canal está puesto y se ve aquí dentro, no en miniatura ni encima. */
  const docked =
    isLive(player.index) &&
    player.mode === 'full' &&
    player.presentation === 'inline';
  /** El canal sigue sonando, pero fuera de su hueco: en la miniatura o en PiP. */
  const minified =
    isLive(player.index) && (player.mode === 'mini' || player.pip);
  const current = all.find(channel => channel.index === player.index);

  /** El hueco donde va el vídeo, en coordenadas de ventana. */
  const box = {
    x: 0,
    y: insets.top + HEADER_HEIGHT + (searchOpen ? SEARCH_HEIGHT : 0),
    width,
    height: videoHeight,
  };

  // Dónde se dibuja el reproductor: debajo de la cabecera (y del buscador, si
  // está abierto). Al salir de la pestaña se suelta el hueco, o el reproductor
  // se quedaría clavado ahí en las demás pantallas.
  useEffect(() => {
    player.setAnchor(box);
    return () => player.setAnchor(null);
    // `player` entero cambia en cada render; lo que importa es el hueco.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, videoHeight, insets.top, searchOpen]);

  /**
   * Siempre hay algo puesto mientras se esté en esta pestaña.
   *
   * Al entrar se enciende el primer canal, como una tele; y si cierras la
   * miniatura con la ✕ **estando aquí**, el canal no se apaga: vuelve a su
   * hueco de arriba, que es de donde salió. Para apagarlo del todo basta con
   * irse a otra pestaña y cerrarlo allí.
   */
  useEffect(() => {
    if (player.index !== null || all.length === 0) {
      return;
    }
    tune(last ?? all[0].index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.index, all.length]);

  const tune = (index: number) => {
    setLast(index);
    // Cerrar el reproductor suelta el hueco (ver `close` en `PlayerContext`),
    // así que al volver a encender hay que volver a decirle dónde va; si no,
    // se dibujaría arriba del todo, tapando la cabecera.
    player.setAnchor(box);
    player.open(index, {presentation: 'inline'});
  };

  return (
    <View style={guide.container}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        // La lista empieza **debajo** del vídeo, no detrás: así las pestañas y
        // las categorías pueden quedarse pegadas justo bajo la imagen al
        // desplazar (`stickyHeaderIndices`), que si no se esconderían tras él.
        style={{
          marginTop:
            HEADER_HEIGHT + (searchOpen ? SEARCH_HEIGHT : 0) + videoHeight,
        }}
        // El índice 1 es el bloque de pestañas y categorías (el 0 es la tira
        // de «ahora», que sí se va con el desplazamiento).
        stickyHeaderIndices={[1]}
        // Solo mueve opacidades: puede ir por el hilo nativo.
        onScroll={Animated.event(
          [{nativeEvent: {contentOffset: {y: scrollY}}}],
          {useNativeDriver: true},
        )}
        contentContainerStyle={{
          paddingBottom:
            tabBarSpace +
            24 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        }}>
        {/* Qué se está viendo, justo debajo de la imagen: el disco del
            canal, el título y el corazón para guardarlo. */}
        {current && (
          <View style={styles.now}>
            <Logo channel={current} size={44} />
            <View style={styles.nowText}>
              <Text style={styles.nowTitle} numberOfLines={1}>
                {current.title}
              </Text>
              <Text style={styles.nowChannel} numberOfLines={1}>
                {current.label} · {t('news.live')}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('screen.favouritesTitle')}
              hitSlop={10}
              onPress={() =>
                toggleFavourite(current.source.uri).then(() =>
                  loadFavourites().then(setSaved),
                )
              }
              style={({pressed}) => pressed && guide.pressed}>
              <FavoriteIcon
                size={22}
                color={
                  saved.includes(current.source.uri)
                    ? ACCENT
                    : 'rgba(255,255,255,0.5)'
                }
              />
            </Pressable>
          </View>
        )}

        {/* Pestañas y categorías juntas: es el bloque que se queda pegado. */}
        <View style={styles.sticky}>
          <View style={styles.tabs}>
            {(['all', 'saved'] as const).map(which => (
              <Pressable
                key={which}
                accessibilityRole="tab"
                accessibilityState={{selected: list === which}}
                onPress={() => setList(which)}
                style={({pressed}) => [styles.tab, pressed && guide.pressed]}>
                <Text style={[styles.tabText, list === which && styles.tabOn]}>
                  {t(which === 'all' ? 'live.tabAll' : 'tab.favourites')}
                </Text>
                {/* La marca de la pestaña elegida va con el degradado de la
                  marca, como las barras de progreso (ver `theme`). */}
                {list === which && (
                  <Image
                    source={{uri: PROGRESS_GRADIENT}}
                    resizeMode="stretch"
                    style={styles.tabMark}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {/* Las categorías del catálogo, en fila: «Todos» siempre primero. */}
          {chips.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}>
              {[null, ...chips].map(genre => (
                <Pressable
                  key={genre ?? 'all'}
                  accessibilityRole="button"
                  accessibilityState={{selected: chip === genre}}
                  onPress={() => setChip(genre)}
                  style={({pressed}) => [
                    styles.chip,
                    chip === genre && styles.chipOn,
                    pressed && guide.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      chip === genre && styles.chipTextOn,
                    ]}>
                    {genre ?? t('live.chipAll')}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {list === 'saved' && !ready ? (
          <View style={styles.rows}>
            {[0, 1, 2].map(row => (
              <View key={row} style={styles.row}>
                <Skeleton width={44} height={44} radius={22} />
                <View style={styles.skeletonText}>
                  <Skeleton width="60%" height={14} />
                  <Skeleton width="30%" height={11} />
                </View>
              </View>
            ))}
          </View>
        ) : channels.length === 0 ? (
          <Text style={guide.empty}>
            {list === 'saved'
              ? t('favourites.empty')
              : t('news.empty', {query: term})}
          </Text>
        ) : (
          channels.map(channel => {
            const playing = channel.index === player.index;
            return (
              <Pressable
                key={channel.index}
                accessibilityRole="button"
                accessibilityState={{selected: playing}}
                onPress={() => tune(channel.index)}
                style={({pressed}) => [
                  styles.row,
                  playing && styles.rowOn,
                  pressed && guide.pressed,
                ]}>
                <Logo channel={channel} size={44} />

                <View style={styles.rowText}>
                  <View style={styles.rowTitleLine}>
                    <Text
                      style={[styles.rowNumber, playing && styles.rowOnText]}>
                      {number(channel.label)}
                    </Text>
                    <Text
                      style={[styles.rowTitle, playing && styles.rowOnText]}
                      numberOfLines={1}>
                      {channel.title}
                    </Text>
                  </View>
                  <Text
                    style={[styles.rowNow, playing && styles.rowOnText]}
                    numberOfLines={1}>
                    {t('news.live')}
                  </Text>
                </View>

                {/* La flecha lo abre a pantalla completa; tocar la fila solo
                    lo pone arriba. */}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('live.openFull')}
                  hitSlop={8}
                  onPress={() =>
                    player.open(channel.index, {presentation: 'immersive'})
                  }
                  style={({pressed}) => [styles.go, pressed && guide.pressed]}>
                  <View style={styles.flip}>
                    <ArrowBackIcon size={18} color="rgba(255,255,255,0.8)" />
                  </View>
                </Pressable>
              </Pressable>
            );
          })
        )}

        {/* La rejilla con todos, para quien prefiera carátulas. */}
        <Pressable
          accessibilityRole="link"
          onPress={onSeeAll}
          hitSlop={8}
          style={({pressed}) => [styles.seeAll, pressed && guide.pressed]}>
          <Text style={guide.seeAll}>{t('screen.seeAll')}</Text>
        </Pressable>
      </Animated.ScrollView>

      {/* El hueco de arriba no se queda nunca en negro: si el vídeo no está
          aquí, una tarjeta dice dónde está (en la miniatura) o invita a
          encender, y con un toque lo trae. */}
      {!docked && minified && (
        <StageCard
          width={width}
          height={videoHeight}
          top={HEADER_HEIGHT + (searchOpen ? SEARCH_HEIGHT : 0)}
          title={player.pip ? t('live.inPip') : t('live.inMini')}
          hint={t('live.backHere')}
          onPress={() => player.expand()}
        />
      )}

      <GuideHeader
        title={t('screen.liveTitle')}
        searchLabel={t('news.search')}
        query={query}
        onQuery={setQuery}
        headerOpacity={headerOpacity}
        glassOpacity={glassOpacity}
      />
    </View>
  );
}

/**
 * La tarjeta que ocupa el hueco del vídeo mientras el vídeo está en otro sitio
 * (la miniatura o PiP). En negro y con el icono, como hace YouTube: con la
 * imagen del canal de fondo parecería que el vídeo sigue aquí.
 */
function StageCard({
  width,
  height,
  top,
  title,
  hint,
  onPress,
}: {
  width: number;
  height: number;
  top: number;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={hint}
      onPress={onPress}
      style={({pressed}) => [
        styles.stage,
        {top, height, width},
        pressed && guide.pressed,
      ]}>
      {/* Sin el canal escrito aquí: va justo debajo, en la tira de «ahora». */}
      <View style={styles.stageMiddle}>
        <PipIcon size={64} color="rgba(255,255,255,0.65)" />
        <Text style={styles.stageTitle}>{title}</Text>
        <Text style={styles.stageHint}>{hint}</Text>
      </View>
    </Pressable>
  );
}

/** El número del canal, que es lo que la guía enseña a la derecha. */
function number(label: string) {
  const found = label.match(/\d+/);
  // A tres cifras, como en las guías de televisión: así la columna de números
  // queda alineada aunque los canales pasen de nueve.
  return found ? found[0].padStart(3, '0') : label.slice(0, 3);
}

/** El disco del canal: no hay logos, así que es su color con el número. */
function Logo({
  channel,
  size,
}: {
  channel: {index: number; label: string};
  size: number;
}) {
  return (
    <View
      style={[
        styles.logo,
        {width: size, height: size, borderRadius: size / 2},
      ]}>
      <Shot seed={channel.index} width={size} height={size} />
      {/* En el disco va el número corto: los ceros de la guía sobran aquí. */}
      <Text style={styles.logoText}>
        {number(channel.label).replace(/^0+(?=\d)/, '')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  now: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nowText: {flex: 1, gap: 2},
  nowTitle: {color: '#fff', fontSize: 16, fontWeight: '800'},
  nowChannel: {color: '#8a8a8f', fontSize: 12, fontWeight: '600'},
  sticky: {backgroundColor: '#0f0f0f'},
  tabs: {flexDirection: 'row', paddingHorizontal: 16, marginTop: 4},
  tab: {flex: 1, alignItems: 'center', paddingVertical: 12},
  tabText: {color: 'rgba(255,255,255,0.55)', fontSize: 16, fontWeight: '700'},
  tabOn: {color: '#fff'},
  tabMark: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 0,
    height: 3,
    borderRadius: 2,
  },
  chips: {paddingHorizontal: 16, gap: 8, paddingVertical: 10},
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#1f1f22',
  },
  chipOn: {backgroundColor: ACCENT},
  chipText: {color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700'},
  chipTextOn: {color: '#fff'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  rowOn: {backgroundColor: 'rgba(87,76,216,0.12)'},
  rows: {paddingTop: 4},
  skeletonText: {flex: 1, gap: 6},
  rowText: {flex: 1, gap: 2},
  rowTitleLine: {flexDirection: 'row', alignItems: 'center', gap: 10},
  rowNumber: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  rowTitle: {flex: 1, color: '#fff', fontSize: 16, fontWeight: '700'},
  rowNow: {color: '#8a8a8f', fontSize: 12, fontWeight: '600'},
  rowOnText: {color: ACCENT},
  go: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  flip: {transform: [{scaleX: -1}]},
  logo: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  logoText: {color: '#fff', fontSize: 13, fontWeight: '800'},
  seeAll: {alignSelf: 'center', marginTop: 16, padding: 8},
  stage: {
    position: 'absolute',
    left: 0,
    right: 0,
    overflow: 'hidden',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  stageMiddle: {alignItems: 'center', gap: 6, paddingHorizontal: 24},
  stageTitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 6,
  },
  stageHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
