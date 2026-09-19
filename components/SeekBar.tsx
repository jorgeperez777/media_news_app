import React, {useRef} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';

type Props = {
  currentTime: number;
  duration: number;
  buffered: number;
  scrubbing: boolean;
  onScrubStart: (time: number) => void;
  onScrub: (time: number) => void;
  onScrubEnd: (time: number) => void;
};

const TRACK_HEIGHT = 3;
const TRACK_HEIGHT_ACTIVE = 5;
const THUMB = 12;
const THUMB_ACTIVE = 18;

export default function SeekBar(props: Props) {
  const {currentTime, duration, buffered, scrubbing} = props;
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
      {...pan.panHandlers}>
      <View style={[styles.track, {height: trackHeight}]}>
        <View style={[styles.buffered, {width: pct(buffered)}]} />
        <View style={[styles.progress, {width: pct(currentTime)}]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
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
    backgroundColor: '#ff0000',
  },
  thumb: {
    position: 'absolute',
    backgroundColor: '#ff0000',
  },
});
