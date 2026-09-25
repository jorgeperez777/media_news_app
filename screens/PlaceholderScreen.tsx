import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import type {TabKey} from '../components/TabBar';

const COPY: Record<Exclude<TabKey, 'videos'>, {title: string; body: string}> = {
  buscar: {
    title: 'Buscar',
    body: 'Pestaña de ejemplo. Sirve para comprobar que el miniplayer sigue reproduciendo al cambiar de pestaña.',
  },
  perfil: {
    title: 'Perfil',
    body: 'Otra pestaña de ejemplo, igual que la anterior.',
  },
};

export default function PlaceholderScreen({tab}: {tab: Exclude<TabKey, 'videos'>}) {
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
