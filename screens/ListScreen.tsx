import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {SERIES, VOD_ITEMS} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {TAB_BAR_HEIGHT} from '../components/TabBar';
import {PlayIcon} from '../components/icons';
import {formatTime} from '../components/format';
import {loadPositions, type Positions} from '../player/storage';

/**
 * Lista de vídeos. Tocar uno abre el detalle con el reproductor empotrado; las
 * series llevan a su ficha, desde donde los episodios se abren a pantalla
 * completa (`onOpenSeries`).
 */
export default function ListScreen({
  onOpenSeries,
}: {
  onOpenSeries: (id: string) => void;
}) {
  const player = usePlayer();
  // «Seguir viendo»: se relee al volver de un vídeo (cambia player.index).
  const [positions, setPositions] = useState<Positions>({});
  useEffect(() => {
    loadPositions().then(setPositions);
  }, [player.index]);

  return (
    <ScrollView
      style={styles.container}
      // Deja sitio para el miniplayer cuando está abajo.
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            TAB_BAR_HEIGHT +
            16 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        },
      ]}>
      <Text style={styles.heading}>{t('screen.videosTitle')}</Text>
      <Text style={styles.hint}>{t('screen.videosIntro')}</Text>

      {SERIES.map(series => (
        <Pressable
          key={series.id}
          onPress={() => onOpenSeries(series.id)}
          style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
          <View style={styles.thumb}>
            <Text style={styles.seriesBadge}>
              {t('screen.seriesEpisodes', {count: series.episodes.length})}
            </Text>
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {series.title}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={3}>
              {series.description}
            </Text>
          </View>
        </Pressable>
      ))}

      {VOD_ITEMS.map(item => (
        <Pressable
          key={item.title}
          onPress={() => player.open(item.index)}
          style={({pressed}) => [styles.row, pressed && styles.rowPressed]}>
          <View style={styles.thumb}>
            <PlayIcon size={22} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.rowSubtitle} numberOfLines={2}>
              {item.label} · {item.description}
            </Text>
            {renderResume(positions, item.source.uri)}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Barra de lo ya visto y el tiempo, cuando hay posición guardada. */
function renderResume(positions: Positions, uri: string) {
  const saved = positions[uri];
  if (!saved || saved.duration <= 0) {
    return null;
  }
  const percent = Math.min(100, (saved.seconds / saved.duration) * 100);
  return (
    <View style={styles.resume}>
      <View style={styles.resumeTrack}>
        <View style={[styles.resumeFill, {width: `${percent}%`}]} />
      </View>
      <Text style={styles.resumeText}>
        {t('screen.continueWatching', {position: formatTime(saved.seconds)})}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  content: {padding: 16, gap: 14},
  heading: {color: '#fff', fontSize: 22, fontWeight: '700'},
  hint: {color: '#aaa', fontSize: 13, lineHeight: 18},
  row: {flexDirection: 'row', gap: 12, alignItems: 'center'},
  rowPressed: {opacity: 0.6},
  thumb: {
    width: 128,
    height: 72,
    borderRadius: 8,
    backgroundColor: '#272727',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {flex: 1, gap: 4},
  rowTitle: {color: '#fff', fontSize: 15, fontWeight: '600'},
  rowSubtitle: {color: '#aaa', fontSize: 12, lineHeight: 16},
  seriesBadge: {color: '#fff', fontSize: 12, fontWeight: '700'},
  resume: {gap: 4, marginTop: 2},
  resumeTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    overflow: 'hidden',
  },
  resumeFill: {height: '100%', backgroundColor: '#ff0000'},
  resumeText: {color: '#888', fontSize: 11},
});
