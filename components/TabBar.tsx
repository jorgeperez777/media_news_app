import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  LiveTvIcon,
  PersonIcon,
  SearchIcon,
  VideoLibraryIcon,
} from './icons';
import {t} from '../i18n';

export const TAB_BAR_HEIGHT = 56;

export type TabKey = 'envivo' | 'videos' | 'buscar' | 'perfil';

const TABS: Array<{
  key: TabKey;
  label: string;
  Icon: (props: {size?: number; color?: string}) => React.JSX.Element;
}> = [
  {key: 'envivo', label: t('tab.live'), Icon: LiveTvIcon},
  {key: 'videos', label: t('tab.videos'), Icon: VideoLibraryIcon},
  {key: 'buscar', label: t('tab.search'), Icon: SearchIcon},
  {key: 'perfil', label: t('tab.profile'), Icon: PersonIcon},
];

const ACTIVE = '#fff';
const INACTIVE = 'rgba(255,255,255,0.55)';

export default function TabBar({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (tab: TabKey) => void;
}) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, {height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom}]}>
      {TABS.map(({key, label, Icon}) => {
        const selected = key === active;
        return (
          <Pressable
            key={key}
            style={({pressed}) => [styles.tab, pressed && styles.pressed]}
            onPress={() => onChange(key)}>
            <Icon size={22} color={selected ? ACTIVE : INACTIVE} />
            <Text style={[styles.label, {color: selected ? ACTIVE : INACTIVE}]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#0f0f0f',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#272727',
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3},
  pressed: {opacity: 0.6},
  label: {fontSize: 10, fontWeight: '600'},
});
