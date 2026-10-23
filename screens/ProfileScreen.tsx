import React, {useEffect, useState} from 'react';
import {Pressable, ScrollView, Share, StyleSheet, View} from 'react-native';
import Text from '../components/Text';
import {
  getLanguagePreference,
  LANGUAGES,
  setLanguage,
  t,
  useLanguage,
  type LanguagePreference,
} from '../i18n';
import {usePlayer} from '../player/PlayerContext';
import {
  clearFavourites,
  clearPositions,
  loadFavourites,
  loadPositions,
  saveLanguage,
} from '../player/storage';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {useTabBarSpace, type TabKey} from '../components/TabBar';
import {
  ChevronIcon,
  DeleteIcon,
  FavoriteIcon,
  LanguageIcon,
  PersonIcon,
  ReplayIcon,
  SettingsIcon,
  ShareIcon,
  SignalIcon,
} from '../components/icons';
import {ACCENT} from '../theme';
import {version} from '../package.json';

/**
 * Perfil: quién eres (de momento, nadie), y todo lo que se puede tocar.
 *
 * La forma es la de cualquier perfil de móvil —título, retrato en medio y una
 * lista de fichas— porque así no hay nada que aprender. Lo que cambia es el
 * fondo: no hay cuentas ni servidor, de modo que bajo el nombre se dice que
 * todo —Mi lista, lo visto, el idioma— vive en este teléfono y no viaja.
 *
 * Sin cuenta tampoco hay foto que cambiar ni perfil que editar, así que donde
 * otras apps ponen el lápiz va lo único que sí lleva a alguna parte:
 * Diagnóstico.
 */
export default function ProfileScreen({
  onGo,
  onDiagnostics,
}: {
  /** Saltar a otra pestaña desde las fichas. */
  onGo: (tab: TabKey) => void;
  /** Abrir la pantalla técnica. */
  onDiagnostics: () => void;
}) {
  const player = usePlayer();
  const tabBarSpace = useTabBarSpace();
  // El idioma se lee del módulo; esto solo fuerza el repintado al cambiarlo.
  useLanguage();
  const [saved, setSaved] = useState(0);
  const [watched, setWatched] = useState(0);

  useEffect(() => {
    loadFavourites().then(list => setSaved(list.length));
    loadPositions().then(map => setWatched(Object.keys(map).length));
  }, []);

  /** Idioma: automático o uno fijo, girando en la misma fila. */
  const languages: LanguagePreference[] = ['auto', ...LANGUAGES];
  const language = getLanguagePreference();
  const nextLanguage = () => {
    const next =
      languages[(languages.indexOf(language) + 1) % languages.length];
    setLanguage(next);
    saveLanguage(next);
  };

  /** Ahorro de datos: lo mismo, girando entre los tres valores. */
  const savers = ['auto', 'on', 'off'] as const;
  const nextSaver = () =>
    player.setDataSaver(
      savers[(savers.indexOf(player.dataSaver) + 1) % savers.length],
    );

  const muted = 'rgba(255,255,255,0.75)';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        {
          paddingBottom:
            tabBarSpace +
            24 +
            (player.index !== null && player.mode === 'mini' ? MINI_HEIGHT : 0),
        },
      ]}>
      <View style={styles.head}>
        <Text style={styles.screenTitle}>{t('profile.title')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.diagnostics')}
          onPress={onDiagnostics}
          hitSlop={8}
          style={({pressed}) => [styles.circle, pressed && styles.pressed]}>
          <SettingsIcon size={20} color="#fff" />
        </Pressable>
      </View>

      {/* El retrato: sin cuenta no hay foto, así que la silueta sobre un disco
          gris, del mismo gris que las carátulas que aún no tienen imagen. */}
      <View style={styles.who}>
        <View style={styles.avatar}>
          <PersonIcon size={46} color="rgba(255,255,255,0.65)" />
        </View>
        <Text style={styles.name}>{t('profile.guest')}</Text>
        <Text style={styles.sub}>{t('profile.local')}</Text>
      </View>

      <View style={styles.rows}>
        <Row
          icon={<FavoriteIcon size={22} color={muted} />}
          label={t('screen.favouritesTitle')}
          value={String(saved)}
          onPress={() => onGo('favoritos')}
        />
        <Row
          icon={<ReplayIcon size={22} color={muted} />}
          label={t('screen.continueRow')}
          value={String(watched)}
          onPress={() => onGo('inicio')}
        />
        <Row
          icon={<ShareIcon size={22} color={muted} />}
          label={t('profile.share')}
          onPress={() => {
            Share.share({message: t('profile.shareText')}).catch(() => {
              // Cancelar el menú de compartir no es un error.
            });
          }}
        />
        <Row
          icon={<LanguageIcon size={22} color={muted} />}
          label={t('settings.language')}
          value={t(`language.${language}`)}
          onPress={nextLanguage}
        />
        <Row
          icon={<SignalIcon size={22} color={muted} />}
          label={t('profile.dataSaver')}
          value={t(`profile.data.${player.dataSaver}`)}
          onPress={nextSaver}
        />
        <Row
          icon={<DeleteIcon size={22} color={muted} />}
          label={t('profile.clearList')}
          value={String(saved)}
          onPress={() => clearFavourites().then(() => setSaved(0))}
        />
        <Row
          icon={<DeleteIcon size={22} color={muted} />}
          label={t('profile.clearWatched')}
          value={String(watched)}
          onPress={() => clearPositions().then(() => setWatched(0))}
        />
      </View>

      <Text style={styles.version}>{t('profile.version', {version})}</Text>
    </ScrollView>
  );
}

/** Una ficha de la lista: icono, etiqueta, su valor si lo tiene, y la flecha. */
function Row({
  icon,
  label,
  value,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}. ${value}` : label}
      onPress={onPress}
      style={({pressed}) => [styles.row, pressed && styles.pressed]}>
      {icon}
      <Text style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {/* El galón hacia la derecha: el mismo icono de los desplegables, de
          lado, para no meter otra flecha distinta en la app. */}
      <View style={styles.chevron}>
        <ChevronIcon size={20} color={ACCENT} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0f0f0f'},
  content: {paddingHorizontal: 16},
  pressed: {opacity: 0.6},
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  screenTitle: {color: '#fff', fontSize: 24, fontWeight: '800'},
  circle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  who: {alignItems: 'center', gap: 6, paddingTop: 18, paddingBottom: 26},
  avatar: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a2a2e',
    marginBottom: 8,
  },
  name: {color: '#fff', fontSize: 20, fontWeight: '800'},
  sub: {
    color: '#8a8a8f',
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  rows: {gap: 12},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderRadius: 16,
    backgroundColor: '#1b1b1f',
  },
  rowLabel: {flex: 1, color: '#fff', fontSize: 15, fontWeight: '600'},
  rowValue: {color: '#8a8a8f', fontSize: 13, fontWeight: '600'},
  chevron: {transform: [{rotate: '-90deg'}]},
  version: {
    color: '#5a5a60',
    fontSize: 12,
    textAlign: 'center',
    paddingTop: 24,
  },
});
