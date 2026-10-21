import React, {useEffect, useRef} from 'react';
import {Animated, StyleSheet, View, type ViewStyle} from 'react-native';

/**
 * Hueco gris que late mientras llega el contenido.
 *
 * Es un latido de opacidad (no un brillo que recorre la caja): se hace con el
 * driver nativo, así que sigue animando aunque el hilo de JS esté ocupado
 * cargando, que es justo cuando se ve.
 */

const MIN_OPACITY = 0.5;
const MAX_OPACITY = 1;
const PULSE_MS = 900;

export default function Skeleton({
  width,
  height,
  radius = 8,
  style,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const pulse = useRef(new Animated.Value(MIN_OPACITY)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: MAX_OPACITY,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: MIN_OPACITY,
          duration: PULSE_MS,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      // Para un lector de pantalla esto no es contenido: es un hueco.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        {width, height, borderRadius: radius, opacity: pulse},
        style,
      ]}
    />
  );
}

/** Fila de huecos, para los carruseles. */
export function SkeletonRow({
  count,
  width,
  height,
  radius,
  gap = 10,
  style,
}: {
  count: number;
  width: number;
  height: number;
  radius?: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.row, {gap}, style]}>
      {Array.from({length: count}, (_, i) => (
        <Skeleton key={i} width={width} height={height} radius={radius} />
      ))}
    </View>
  );
}

/** Rejilla de huecos, para las pantallas de «Ver todo» y Favoritos. */
export function SkeletonGrid({
  rows,
  columns,
  width,
  height,
  gap = 10,
  style,
}: {
  rows: number;
  columns: number;
  width: number;
  height: number;
  gap?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={[{gap}, style]}>
      {Array.from({length: rows}, (_, row) => (
        <SkeletonRow
          key={row}
          count={columns}
          width={width}
          height={height}
          radius={12}
          gap={gap}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {backgroundColor: '#2e2e33'},
  row: {flexDirection: 'row', overflow: 'hidden'},
});
