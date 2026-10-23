import React from 'react';
import {StyleSheet, View} from 'react-native';
import Text from '../components/Text';
import type {TabKey} from '../components/TabBar';
import {t, type TextKey} from '../i18n';

// El resto de pestañas tiene pantalla propia; Buscar sigue siendo de ejemplo.
type PlaceholderTab = Extract<TabKey, 'buscar'>;

// Las claves, no el texto: se traduce al pintar, que el idioma puede cambiar.
const COPY: Record<PlaceholderTab, {title: TextKey; body: TextKey}> = {
  buscar: {title: 'screen.searchTitle', body: 'screen.searchBody'},
};

export default function PlaceholderScreen({tab}: {tab: PlaceholderTab}) {
  const {title, body} = COPY[tab];
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t(title)}</Text>
      <Text style={styles.body}>{t(body)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16, gap: 10},
  title: {color: '#fff', fontSize: 22, fontWeight: '700'},
  body: {color: '#aaa', fontSize: 13, lineHeight: 18},
});
