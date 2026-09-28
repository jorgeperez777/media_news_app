import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {TabKey} from '../components/TabBar';
import {t} from '../i18n';

// Perfil tiene su propia pantalla (el panel de QoE); aquí solo queda Buscar.
type PlaceholderTab = Extract<TabKey, 'buscar'>;

const COPY: Record<PlaceholderTab, {title: string; body: string}> = {
  buscar: {title: t('screen.searchTitle'), body: t('screen.searchBody')},
};

export default function PlaceholderScreen({tab}: {tab: PlaceholderTab}) {
  const {title, body} = COPY[tab];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, gap: 10},
  title: {color: '#fff', fontSize: 22, fontWeight: '700'},
  body: {color: '#aaa', fontSize: 13, lineHeight: 18},
});
