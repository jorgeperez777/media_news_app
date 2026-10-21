import React, {useEffect, useSyncExternalStore} from 'react';
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {ArrowBackIcon} from '../components/icons';
import {useTabBarSpace} from '../components/TabBar';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {formatTime, mbps} from 'react-native-video/controls';
import {
  getLanguagePreference,
  setLanguage,
  t,
  useLanguage,
  LANGUAGES,
  type LanguagePreference,
} from '../i18n';
import {usePlayer} from '../player/PlayerContext';
import {
  archiveCount,
  catalogState,
  clearCatalogCache,
  clearSeriesCache,
  loadTmdbCatalog,
  loadTmdbSeries,
  tmdbCount,
  tmdbSeriesCount,
  useCatalog,
} from '../sources';
import {saveLanguage} from '../player/storage';
import {
  clearSessions,
  getSessions,
  subscribe,
  summarize,
  type PlaybackSession,
} from '../player/telemetry';

/**
 * Diagnóstico: el panel de QoE. En una app real estas métricas se mandarían a un
 * servidor; aquí se enseñan tal cual para poder mirarlas mientras se desarrolla.
 *
 * Se abre desde Perfil, así que llega con su propio «atrás» (el de la barra del
 * móvil también vale).
 */
export default function DiagnosticsScreen({onBack}: {onBack: () => void}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  const sessions = useSyncExternalStore(subscribe, getSessions);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {
          paddingBottom:
            tabBarSpace +
            16 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        },
      ]}>
      <View style={styles.head}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('screen.close')}
          onPress={onBack}
          hitSlop={12}
          style={({pressed}) => [styles.back, pressed && styles.pressed]}>
          <ArrowBackIcon size={22} />
        </Pressable>
        <Text style={styles.screenTitle}>{t('profile.diagnostics')}</Text>
      </View>

      <LanguagePicker />

      <TmdbCatalog />

      <TmdbSeries />

      <ArchiveCache />

      {/* Atribución: TMDb la exige en sus términos cuando usas su API. */}
      <Text style={styles.heading}>{t('credits.title')}</Text>
      <Text style={styles.hint}>{t('credits.tmdb')}</Text>
      <Text style={styles.hint}>{t('credits.archive')}</Text>

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

/** Idioma de la app: automático (el del dispositivo) o uno fijo. */
function LanguagePicker() {
  // Repinta al cambiar: el elegido se lee del módulo, no de un estado local.
  useLanguage();
  const current = getLanguagePreference();
  const options: LanguagePreference[] = ['auto', ...LANGUAGES];

  const choose = (next: LanguagePreference) => {
    setLanguage(next);
    saveLanguage(next);
  };

  return (
    <View style={styles.language}>
      <Text style={styles.heading}>{t('settings.language')}</Text>
      <View style={styles.languageRow}>
        {options.map(option => {
          const selected = option === current;
          return (
            <Pressable
              key={option}
              accessibilityRole="button"
              accessibilityState={{selected}}
              onPress={() => choose(option)}
              style={({pressed}) => [
                styles.chip,
                selected && styles.chipOn,
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                {t(`language.${option}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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

/**
 * Series de TMDb, también a mano.
 *
 * Son dos peticiones por serie (la popular y su primera temporada) y los
 * episodios no tienen película detrás: se abren con un vídeo de muestra (ver
 * `loadTmdbSeries`). Lo traído se queda guardado y vuelve en el siguiente
 * arranque.
 */
function TmdbSeries() {
  useCatalog();
  const {loading} = catalogState();
  const count = tmdbSeriesCount();

  return (
    <>
      <Text style={styles.heading}>{t('tv.title')}</Text>
      <Text style={styles.hint}>{t('tv.intro')}</Text>
      <View style={styles.actions}>
        <Text style={styles.count}>{t('tv.loaded', {count})}</Text>
        <View style={styles.buttons}>
          {count > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => clearSeriesCache()}
              style={({pressed}) => [styles.button, pressed && styles.pressed]}>
              <Text style={styles.buttonText}>{t('catalog.clearCache')}</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{disabled: loading}}
            disabled={loading}
            onPress={() => loadTmdbSeries()}
            style={({pressed}) => [
              styles.button,
              (pressed || loading) && styles.pressed,
            ]}>
            <Text style={styles.buttonText}>
              {t(loading ? 'tv.loading' : 'tv.load')}
            </Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

/**
 * Lo que hay guardado del archivo y el botón de tirarlo.
 *
 * Está aquí porque es lo que hace falta para comprobarlo: vaciar, reiniciar la
 * app y ver si el listado aparece al instante o si hay que esperar a la red.
 */
function ArchiveCache() {
  useCatalog();
  const count = archiveCount();

  return (
    <View style={styles.actions}>
      <Text style={styles.count}>{t('catalog.cached', {count})}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => clearCatalogCache()}
        style={({pressed}) => [styles.button, pressed && styles.pressed]}>
        <Text style={styles.buttonText}>{t('catalog.clearCache')}</Text>
      </Pressable>
    </View>
  );
}

/**
 * Catálogo de pruebas de TMDb, a mano.
 *
 * A mano y aquí dentro a propósito: son miles de peticiones de fichas que no
 * tienen película detrás (ver `loadTmdbCatalog`), así que esto no se carga solo
 * al arrancar ni se ofrece en la navegación normal.
 */
function TmdbCatalog() {
  useCatalog();
  const {loading} = catalogState();
  const count = tmdbCount();

  return (
    <>
      <Text style={styles.heading}>{t('tmdb.title')}</Text>
      <Text style={styles.hint}>{t('tmdb.intro')}</Text>
      <View style={styles.actions}>
        <Text style={styles.count}>{t('tmdb.loaded', {count})}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{disabled: loading}}
          disabled={loading}
          onPress={() => loadTmdbCatalog()}
          style={({pressed}) => [
            styles.button,
            (pressed || loading) && styles.pressed,
          ]}>
          <Text style={styles.buttonText}>
            {t(loading ? 'tmdb.loading' : 'tmdb.load')}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {padding: 16, gap: 10},
  head: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6},
  back: {width: 36, height: 36, alignItems: 'center', justifyContent: 'center'},
  screenTitle: {color: '#fff', fontSize: 22, fontWeight: '800'},
  language: {gap: 10, marginBottom: 6},
  languageRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  chipOn: {backgroundColor: '#fff'},
  chipText: {color: 'rgba(255,255,255,0.75)', fontSize: 13, fontWeight: '600'},
  chipTextOn: {color: '#0f0f0f'},
  heading: {color: '#fff', fontSize: 22, fontWeight: '700'},
  hint: {color: '#aaa', fontSize: 13, lineHeight: 18},
  empty: {color: '#777', fontSize: 13, marginTop: 8},
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  count: {color: '#aaa', fontSize: 12, flex: 1},
  buttons: {flexDirection: 'row', gap: 8},
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
