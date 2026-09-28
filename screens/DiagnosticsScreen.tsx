import React, {useSyncExternalStore} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {TAB_BAR_HEIGHT} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {formatTime} from '../components/VideoPlayer';
import {mbps} from '../components/useNetworkCap';
import {t} from '../i18n';
import {usePlayer} from '../player/PlayerContext';
import {
  clearSessions,
  getSessions,
  subscribe,
  summarize,
  type PlaybackSession,
} from '../player/telemetry';

/**
 * Pestaña Perfil: el panel de QoE. En una app real estas métricas se mandarían a un
 * servidor; aquí se enseñan tal cual para poder mirarlas mientras se desarrolla.
 */
export default function DiagnosticsScreen() {
  const player = usePlayer();
  const sessions = useSyncExternalStore(subscribe, getSessions);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom:
            TAB_BAR_HEIGHT +
            16 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        },
      ]}>
      <Text style={styles.heading}>{t('qoe.title')}</Text>
      <Text style={styles.hint}>{t('qoe.intro')}</Text>

      {sessions.length === 0 ? (
        <Text style={styles.empty}>{t('qoe.empty')}</Text>
      ) : (
        <>
          <View style={styles.actions}>
            <Text style={styles.count}>
              {t('qoe.sessions')}: {sessions.length}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={clearSessions}
              style={({pressed}) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{t('qoe.clear')}</Text>
            </Pressable>
          </View>
          {sessions.map(session => (
            <SessionCard key={session.id} session={session} />
          ))}
        </>
      )}
    </ScrollView>
  );
}

function SessionCard({session}: {session: PlaybackSession}) {
  const stats = summarize(session);
  const ratio = `${(stats.rebufferRatio * 100).toFixed(1)} %`;
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {session.title}
      </Text>
      <View style={styles.grid}>
        <Metric
          label={t('qoe.startup')}
          value={
            stats.startupMs === null ? t('qoe.live') : `${stats.startupMs} ms`
          }
          warn={stats.startupMs !== null && stats.startupMs > 3000}
        />
        <Metric
          label={t('qoe.rebuffer')}
          value={`${stats.rebufferCount} · ${Math.round(stats.rebufferMs)} ms`}
          warn={stats.rebufferCount > 0}
        />
        <Metric
          label={t('qoe.rebufferRatio')}
          value={ratio}
          warn={stats.rebufferRatio > 0.02}
        />
        <Metric
          label={t('qoe.watched')}
          value={formatTime(stats.watchedMs / 1000)}
        />
        <Metric label={t('qoe.seeks')} value={String(stats.seeks)} />
        <Metric
          label={t('qoe.errors')}
          value={String(stats.errors)}
          warn={stats.errors > 0}
        />
        {stats.avgBitrate > 0 && (
          <Metric label={t('qoe.bitrate')} value={mbps(stats.avgBitrate)} />
        )}
      </View>
      {stats.lastError ? (
        <Text style={styles.error} numberOfLines={2}>
          {stats.lastError}
        </Text>
      ) : null}
    </View>
  );
}

function Metric({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, warn && styles.metricWarn]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 10},
  heading: {color: '#fff', fontSize: 22, fontWeight: '700'},
  hint: {color: '#aaa', fontSize: 13, lineHeight: 18},
  empty: {color: '#777', fontSize: 13, marginTop: 8},
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  count: {color: '#aaa', fontSize: 12},
  button: {
    backgroundColor: '#272727',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  pressed: {opacity: 0.6},
  buttonText: {color: '#fff', fontSize: 12, fontWeight: '600'},
  card: {
    backgroundColor: '#181818',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  cardTitle: {color: '#fff', fontSize: 14, fontWeight: '600'},
  grid: {flexDirection: 'row', flexWrap: 'wrap', gap: 10},
  metric: {minWidth: '30%', gap: 2},
  metricLabel: {color: '#888', fontSize: 11},
  metricValue: {color: '#fff', fontSize: 14, fontWeight: '600'},
  metricWarn: {color: '#ffb300'},
  error: {color: '#f66', fontSize: 12},
});
