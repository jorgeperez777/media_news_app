import React, {useEffect, useState} from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {Series} from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {t} from '../i18n';
import {TAB_BAR_HEIGHT} from '../components/TabBar';
import {ArrowBackIcon, PlayIcon} from '../components/icons';
import {formatTime} from '../components/format';
import {loadPositions, type Positions} from '../player/storage';

/**
 * Ficha de una serie, al estilo de Netflix: aquí no hay hueco para el
 * reproductor. Tocar un episodio lo abre en modo inmersivo (horizontal y a
 * pantalla completa, ver `PlayerHost`), y al cerrarlo se vuelve a esta pantalla.
 */
export default function SeriesScreen({
  series,
  onBack,
}: {
  series: Series;
  onBack: () => void;
}) {
  const player = usePlayer();
  // «Seguir viendo» de cada episodio: se relee al cerrar el reproductor.
  const [positions, setPositions] = useState<Positions>({});
  useEffect(() => {
    loadPositions().then(setPositions);
  }, [player.index]);

  // Atrás vuelve a la lista, salvo con un episodio abierto: entonces manda el
  // reproductor y devolvemos false para que le llegue a él (no basta con confiar
  // en el orden de registro: este efecto se vuelve a suscribir en cada render que
  // cambie `onBack`, y acabaría adelantándose al del reproductor).
  const immersive = player.index !== null && player.presentation === 'immersive';
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (immersive) {
        return false;
      }
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack, immersive]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {paddingBottom: TAB_BAR_HEIGHT + 16},
      ]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('screen.seriesTitle')}
        onPress={onBack}
        hitSlop={8}
        style={({pressed}) => [styles.back, pressed && styles.pressed]}>
        <ArrowBackIcon size={20} />
        <Text style={styles.backText}>{t('screen.seriesTitle')}</Text>
      </Pressable>

      <Text style={styles.heading}>{series.title}</Text>
      <Text style={styles.count}>
        {t('screen.seriesEpisodes', {count: series.episodes.length})}
      </Text>
      <Text style={styles.description}>{series.description}</Text>
      <Text style={styles.hint}>{t('screen.seriesHint')}</Text>

      {series.episodes.map((episode, position) => {
        const saved = positions[episode.source.uri];
        const percent =
          saved && saved.duration > 0
            ? Math.min(100, (saved.seconds / saved.duration) * 100)
            : 0;
        return (
          <Pressable
            key={episode.index}
            // Aquí está la diferencia con la lista de vídeos: se pide inmersivo.
            onPress={() =>
              player.open(episode.index, {presentation: 'immersive'})
            }
            style={({pressed}) => [styles.row, pressed && styles.pressed]}>
            <View style={styles.thumb}>
              <PlayIcon size={22} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle} numberOfLines={2}>
                {episode.episode
                  ? `${t('screen.seriesBadge', {
                      season: episode.episode.season,
                      number: episode.episode.number,
                    })} · ${episode.title}`
                  : episode.title}
              </Text>
              <Text style={styles.rowSubtitle} numberOfLines={3}>
                {episode.description}
              </Text>
              {percent > 0 ? (
                <View style={styles.resume}>
                  <View style={styles.resumeTrack}>
                    <View style={[styles.resumeFill, {width: `${percent}%`}]} />
                  </View>
                  <Text style={styles.resumeText}>
                    {t('screen.continueWatching', {
                      position: formatTime(saved.seconds),
                    })}
                  </Text>
                </View>
              ) : (
                <Text style={styles.resumeText}>
                  {t('screen.play')} ·{' '}
                  {t('screen.episodeOf', {
                    position: position + 1,
                    total: series.episodes.length,
                  })}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  content: {padding: 16, gap: 12},
  back: {flexDirection: 'row', alignItems: 'center', gap: 6},
  backText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  pressed: {opacity: 0.6},
  heading: {color: '#fff', fontSize: 22, fontWeight: '700'},
  count: {color: '#888', fontSize: 12, marginTop: -6},
  description: {color: '#ccc', fontSize: 13, lineHeight: 18},
  hint: {color: '#aaa', fontSize: 12, lineHeight: 17},
  row: {flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 2},
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
