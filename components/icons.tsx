import React from 'react';
import {StyleSheet, Text, View} from 'react-native';

// Iconos dibujados con Views/texto para no depender de fuentes de iconos
// (evita añadir módulos nativos y recompilar).

const WHITE = '#fff';

export function PlayIcon({size = 36}: {size?: number}) {
  return (
    <View
      style={{
        width: 0,
        height: 0,
        marginLeft: size * 0.15,
        borderTopWidth: size / 2,
        borderBottomWidth: size / 2,
        borderLeftWidth: size * 0.85,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        borderLeftColor: WHITE,
      }}
    />
  );
}

export function PauseIcon({size = 36}: {size?: number}) {
  const bar = {width: size * 0.28, height: size, backgroundColor: WHITE};
  return (
    <View style={{flexDirection: 'row', gap: size * 0.22}}>
      <View style={bar} />
      <View style={bar} />
    </View>
  );
}

export function ReplayIcon({size = 36}: {size?: number}) {
  return <Text style={{color: WHITE, fontSize: size, lineHeight: size * 1.15}}>↻</Text>;
}

export function SkipIcon({
  direction,
  seconds = 10,
  size = 40,
}: {
  direction: 'back' | 'forward';
  seconds?: number;
  size?: number;
}) {
  // Anillo abierto con el número dentro, como el de YouTube.
  return (
    <View style={[styles.ring, {width: size, height: size, borderRadius: size / 2}]}>
      <View
        style={[
          styles.ringGap,
          {
            width: size * 0.3,
            height: size * 0.3,
            top: -size * 0.12,
            [direction === 'back' ? 'left' : 'right']: size * 0.12,
          },
        ]}
      />
      <Text
        style={[
          styles.ringArrow,
          {
            fontSize: size * 0.32,
            top: -size * 0.1,
            [direction === 'back' ? 'left' : 'right']: size * 0.14,
          },
        ]}>
        {direction === 'back' ? '◀' : '▶'}
      </Text>
      <Text style={{color: WHITE, fontSize: size * 0.34, fontWeight: '700'}}>
        {seconds}
      </Text>
    </View>
  );
}

export function FullscreenIcon({size = 22, exit = false}: {size?: number; exit?: boolean}) {
  const c = size * 0.38;
  const t = 2.5;
  const corner = (pos: object) => (
    <View
      style={[
        {position: 'absolute', width: c, height: c, borderColor: WHITE},
        pos,
      ]}
    />
  );
  // Al salir, las esquinas apuntan hacia dentro.
  const inset = exit ? size * 0.22 : 0;
  return (
    <View style={{width: size, height: size}}>
      {corner({top: inset, left: inset, borderTopWidth: t, borderLeftWidth: t})}
      {corner({top: inset, right: inset, borderTopWidth: t, borderRightWidth: t})}
      {corner({bottom: inset, left: inset, borderBottomWidth: t, borderLeftWidth: t})}
      {corner({bottom: inset, right: inset, borderBottomWidth: t, borderRightWidth: t})}
    </View>
  );
}

export function TrackIcon({direction, size = 28}: {direction: 'previous' | 'next'; size?: number}) {
  // ⏮ / ⏭ : barra + triángulo, como los botones de pista de YouTube.
  const bar = <View style={{width: size * 0.12, height: size * 0.7, backgroundColor: WHITE, borderRadius: 1}} />;
  const triangle = (
    <View
      style={{
        width: 0,
        height: 0,
        borderTopWidth: size * 0.35,
        borderBottomWidth: size * 0.35,
        borderTopColor: 'transparent',
        borderBottomColor: 'transparent',
        ...(direction === 'next'
          ? {borderLeftWidth: size * 0.6, borderLeftColor: WHITE}
          : {borderRightWidth: size * 0.6, borderRightColor: WHITE}),
      }}
    />
  );
  return (
    <View style={{flexDirection: 'row', alignItems: 'center', gap: size * 0.08}}>
      {direction === 'previous' ? bar : null}
      {triangle}
      {direction === 'next' ? bar : null}
    </View>
  );
}

export function PipIcon({size = 22}: {size?: number}) {
  // Rectángulo grande con uno pequeño en la esquina inferior derecha (icono PiP clásico).
  return (
    <View style={{width: size, height: size * 0.8, borderWidth: 2, borderColor: WHITE, borderRadius: 3}}>
      <View
        style={{
          position: 'absolute',
          right: 2,
          bottom: 2,
          width: size * 0.42,
          height: size * 0.3,
          backgroundColor: WHITE,
          borderRadius: 1,
        }}
      />
    </View>
  );
}

export function CastIcon({size = 48, color = WHITE}: {size?: number; color?: string}) {
  // Pantalla con las tres ondas en la esquina inferior izquierda (icono de cast).
  const wave = (index: number) => ({
    position: 'absolute' as const,
    left: size * 0.08,
    bottom: size * 0.16,
    width: size * (0.18 + index * 0.16),
    height: size * (0.18 + index * 0.16),
    borderColor: color,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderRightWidth: size * 0.045,
    borderBottomWidth: size * 0.045,
    borderBottomRightRadius: 2,
    transform: [{rotate: '225deg'}],
  });
  return (
    <View style={{width: size, height: size * 0.78}}>
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: size * 0.86,
          height: size * 0.68,
          borderWidth: size * 0.05,
          borderColor: color,
          borderRadius: size * 0.08,
        }}
      />
      <View style={{position: 'absolute', left: size * 0.06, bottom: size * 0.04, width: size * 0.1, height: size * 0.1, borderRadius: size * 0.05, backgroundColor: color}} />
      <View style={wave(0)} />
      <View style={wave(1)} />
    </View>
  );
}

export function SettingsIcon({size = 22}: {size?: number}) {
  return <Text style={{color: WHITE, fontSize: size, lineHeight: size * 1.2}}>⚙</Text>;
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2.5,
    borderColor: WHITE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringGap: {position: 'absolute', backgroundColor: 'transparent'},
  ringArrow: {position: 'absolute', color: WHITE},
});
