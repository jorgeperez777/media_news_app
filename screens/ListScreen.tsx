import React from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import SOURCES from '../sources';
import {usePlayer} from '../player/PlayerContext';
import {MINI_HEIGHT} from '../components/PlayerHost';
import {TAB_BAR_HEIGHT} from '../components/TabBar';
import {PlayIcon} from '../components/icons';

/** Lista de vídeos. Tocar uno abre el detalle con el reproductor. */
export default function ListScreen() {
  const player = usePlayer();

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
      <Text style={styles.heading}>Vídeos</Text>
      <Text style={styles.hint}>
        Abre uno y pulsa ⌄ para dejarlo en el miniplayer; sigue reproduciéndose
        mientras navegas por las pestañas.
      </Text>

      {SOURCES.map((item, index) => (
        <Pressable
          key={item.title}
          onPress={() => player.open(index)}
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
          </View>
        </Pressable>
      ))}
    </ScrollView>
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
});
