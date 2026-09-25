import React, {useCallback, useEffect, useRef} from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LIVE_CHANNELS, isLive} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {TAB_BAR_HEIGHT} from '../components/TabBar';
import {LiveTvIcon, PlayIcon} from '../components/icons';

/**
 * Pestaña «TV en vivo»: reproductor fijo arriba y guía de canales debajo, como en
 * las apps de TV lineal. Igual que el detalle, no renderiza el reproductor: solo
 * reserva su hueco y le dice a `PlayerHost` dónde dibujarlo, así cambiar de canal
 * no desmonta el vídeo.
 */
export default function LiveScreen() {
  const player = usePlayer();
  const boxRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();

  // El hueco de arriba solo lo ocupa un canal en vivo expandido.
  const docked = player.mode === 'full' && isLive(player.index);

  const measure = useCallback(() => {
    const root = player.rootRef.current;
    const box = boxRef.current;
    if (!root || !box) {
      return;
    }
    box.measureLayout(
      root,
      (x, y, width, height) => {
        if (width && height) {
          player.setAnchor({x, y, width, height});
        }
      },
      () => {},
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Los insets llegan después del primer render y la rotación mueve el hueco sin
  // que cambie su propio layout: volver a medir en esos casos.
  useEffect(() => {
    const id = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(id);
  }, [measure, insets.top, insets.bottom, windowWidth, windowHeight, docked]);

  return (
    <View style={styles.container}>
      <View ref={boxRef} style={styles.playerBox} onLayout={measure}>
        {/* Solo se ve cuando no hay canal en el hueco (sin canal, o en miniplayer). */}
        {!docked && (
          <View style={styles.empty}>
            <LiveTvIcon size={26} color="rgba(255,255,255,0.6)" />
            <Text style={styles.emptyText}>
              {isLive(player.index)
                ? 'El canal está en el miniplayer'
                : 'Elige un canal para empezar'}
            </Text>
          </View>
        )}
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              TAB_BAR_HEIGHT +
              16 +
              (player.index !== null && player.mode === 'mini'
                ? MINI_HEIGHT
                : 0),
          },
        ]}>
        <Text style={styles.heading}>Guía de canales</Text>

        {LIVE_CHANNELS.map(channel => {
          const playing = player.index === channel.index;
          return (
            <Pressable
              key={channel.title}
              onPress={() =>
                playing ? player.expand() : player.open(channel.index)
              }
              style={({pressed}) => [
                styles.row,
                playing && styles.rowPlaying,
                pressed && styles.rowPressed,
              ]}>
              <View style={styles.thumb}>
                <PlayIcon size={20} />
                <View style={styles.liveBadge}>
                  <Text style={styles.liveBadgeText}>EN VIVO</Text>
                </View>
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {channel.title}
                </Text>
                <Text style={styles.rowSubtitle} numberOfLines={2}>
                  {channel.label} · {channel.description}
                </Text>
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.hint}>
          Toca un canal o usa ⏮ ⏭ para cambiar de canal · ⌄ lo deja en el
          miniplayer y sigue sonando en las demás pestañas
        </Text>

        {player.error ? (
          <Text style={styles.error}>Error: {player.error}</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  playerBox: {width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000'},
  empty: {...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 8},
  emptyText: {color: 'rgba(255,255,255,0.6)', fontSize: 13},
  list: {padding: 16, gap: 14},
  heading: {color: '#fff', fontSize: 20, fontWeight: '700'},
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    borderRadius: 10,
    padding: 6,
    margin: -6,
  },
  rowPlaying: {backgroundColor: '#1f1f1f'},
  rowPressed: {opacity: 0.6},
  thumb: {
    width: 112,
    height: 63,
    borderRadius: 8,
    backgroundColor: '#272727',
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: '#cc0000',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  liveBadgeText: {color: '#fff', fontSize: 8, fontWeight: '700'},
  rowText: {flex: 1, gap: 4},
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '600'},
  rowSubtitle: {color: '#aaa', fontSize: 12, lineHeight: 16},
  hint: {color: '#777', fontSize: 12, lineHeight: 17, marginTop: 4},
  error: {color: '#f66'},
});
