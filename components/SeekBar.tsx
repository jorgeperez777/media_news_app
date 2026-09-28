import React, {useRef} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';
import {t} from '../i18n';
import {formatTime} from './format';

type Props = {
  currentTime: number;
  duration: number;
  buffered: number;
  scrubbing: boolean;
  onScrubStart: (time: number) => void;
  onScrub: (time: number) => void;
  onScrubEnd: (time: number) => void;
  /** Color de la parte reproducida y del tirador. */
  accent?: string;
  /** Salto de los gestos de accesibilidad (incrementar/decrementar), en segundos. */
  step?: number;
};

const TRACK_HEIGHT = 3;
const TRACK_HEIGHT_ACTIVE = 5;
const THUMB = 12;
const THUMB_ACTIVE = 18;

export default function SeekBar(props: Props) {
  const {
    currentTime,
    duration,
    buffered,
    scrubbing,
    accent = '#ff0000',
    step = 10,
  } = props;
  const widthRef = useRef(1);
  const startXRef = useRef(0);
  // Los handlers se leen a través de un ref para que el PanResponder (creado
  // una sola vez) siempre use los callbacks/duración más recientes.
  const propsRef = useRef(props);
  propsRef.current = props;

  const toTime = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    return ratio * (propsRef.current.duration || 0);
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: e => {
        startXRef.current = e.nativeEvent.locationX;
        propsRef.current.onScrubStart(toTime(startXRef.current));
      },
      onPanResponderMove: (_e, g) => {
        propsRef.current.onScrub(toTime(startXRef.current + g.dx));
      },
      onPanResponderRelease: (_e, g) => {
        propsRef.current.onScrubEnd(toTime(startXRef.current + g.dx));
      },
      onPanResponderTerminate: (_e, g) => {
        propsRef.current.onScrubEnd(toTime(startXRef.current + g.dx));
      },
    }),
  ).current;

  const pct = (v: number): `${number}%` =>
    duration > 0 ? `${(Math.min(v, duration) / duration) * 100}%` : '0%';
  const trackHeight = scrubbing ? TRACK_HEIGHT_ACTIVE : TRACK_HEIGHT;
  const thumb = scrubbing ? THUMB_ACTIVE : THUMB;

  return (
    <View
      style={styles.touchArea}
      onLayout={e => {
        widthRef.current = e.nativeEvent.layout.width || 1;
      }}
      // Con lector de pantalla no hay arrastre: el control se vuelve «ajustable» y
      // se mueve con los gestos de incrementar/decrementar del sistema.
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={t('a11y.seekBar')}
      accessibilityHint={t('a11y.seekBarHint')}
      accessibilityValue={{
        min: 0,
        max: Math.max(1, Math.round(duration)),
        now: Math.round(currentTime),
        text: t('a11y.position', {
          position: formatTime(currentTime),
          duration: formatTime(duration),
        }),
      }}
      accessibilityActions={[{name: 'increment'}, {name: 'decrement'}]}
      onAccessibilityAction={event => {
        const delta = event.nativeEvent.actionName === 'increment' ? step : -step;
        const next = Math.max(0, Math.min(duration || 0, currentTime + delta));
        propsRef.current.onScrubEnd(next);
      }}
      {...pan.panHandlers}>
      <View style={[styles.track, {height: trackHeight}]}>
        <View style={[styles.buffered, {width: pct(buffered)}]} />
        <View
          style={[styles.progress, {backgroundColor: accent, width: pct(currentTime)}]}
        />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: accent,
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
            marginLeft: -thumb / 2,
            left: pct(currentTime),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    height: 32,
    justifyContent: 'center',
  },
  track: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  buffered: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  progress: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  thumb: {
    position: 'absolute',
  },
});
