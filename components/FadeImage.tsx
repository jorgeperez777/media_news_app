import React, {useRef} from 'react';
import {Animated, Easing, type ImageProps} from 'react-native';
import {IMAGE_MS, useReduceMotion} from './motion';

/**
 * Carátula que aparece con un fundido en cuanto carga, en vez de plantarse de
 * golpe encima del degradado que hacía de hueco.
 *
 * Android ya lo hace solo (`fadeDuration`, 300 ms por defecto) y iOS no hace
 * nada: aquí se apaga el de Android y se pone el mismo para los dos, que si no
 * la misma pantalla se siente distinta en cada móvil.
 *
 * Es para las **grandes**: la portada de una ficha, la de una serie. Las
 * tarjetas de una rejilla siguen sin fundido a propósito (ver `Poster`): con
 * sesenta en pantalla, sesenta animaciones se notan.
 */
export default function FadeImage({onLoad, style, ...props}: ImageProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  return (
    <Animated.Image
      {...props}
      // El fundido nativo de Android, fuera: el de abajo es el que manda.
      fadeDuration={0}
      style={[style, {opacity}]}
      onLoad={event => {
        Animated.timing(opacity, {
          toValue: 1,
          duration: reduceMotion ? 0 : IMAGE_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }).start();
        onLoad?.(event);
      }}
    />
  );
}
