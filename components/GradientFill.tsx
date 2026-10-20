import React from 'react';
import {Image, StyleSheet} from 'react-native';
import {PROGRESS_GRADIENT} from '../theme';

/**
 * El degradado de la marca como fondo de lo que sea.
 *
 * Es el mismo PNG diminuto que rellena las barras de progreso (ver `theme`),
 * estirado al tamaño del padre: un degradado de verdad sin SVG ni librerías.
 * Va dentro de una vista con `overflow: 'hidden'` y el contenido detrás —en el
 * árbol, delante— para que quede por encima.
 */
export default function GradientFill() {
  return (
    <Image
      pointerEvents="none"
      source={{uri: PROGRESS_GRADIENT}}
      style={StyleSheet.absoluteFill}
      resizeMode="stretch"
      fadeDuration={0}
    />
  );
}
