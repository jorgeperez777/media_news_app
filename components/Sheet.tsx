import React, {useEffect, useRef, useState} from 'react';
import {Animated, Easing, StyleSheet} from 'react-native';
import {ENTER_MS, EXIT_MS, useReduceMotion} from './motion';

/**
 * La pantalla que se abre **encima** de la de la pestaña: la ficha de una
 * película, la de una serie, la rejilla de «Ver todo», una noticia.
 *
 * Entra desde la derecha y se va por donde vino. Dos cosas que no son evidentes:
 *
 * - La de abajo **no se mueve ni se desmonta**: sigue viva detrás con su scroll
 *   intacto (ver `App`). Por eso el deslizamiento es corto y va con un fundido:
 *   sin el movimiento de la de abajo, un barrido de pantalla completa parece que
 *   la tapa de golpe en vez de ponerse delante.
 * - Al cerrar hay que **seguir pintando lo que ya no está abierto** hasta que
 *   acabe de irse; si no, desaparecería de un fotograma al siguiente y no habría
 *   animación de salida que ver.
 */

/** Cuánto se desplaza al entrar. Fijo, no un porcentaje: en una tableta un
 * porcentaje de pantalla es un viaje larguísimo. Lo bastante largo como para
 * ver de dónde viene; con 50 px se notaba el fundido pero no el movimiento. */
const SLIDE = 110;

export default function Sheet({children}: {children: React.ReactNode}) {
  const open = children !== null && children !== undefined;
  // Lo último que hubo abierto, que sobrevive a que se cierre para poder irse.
  const [shown, setShown] = useState<React.ReactNode>(children);
  const progress = useRef(new Animated.Value(open ? 1 : 0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (open) {
      setShown(children);
    }
  }, [open, children]);

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: reduceMotion ? 0 : open ? ENTER_MS : EXIT_MS,
      // Frena al llegar y arranca suave al irse: así parece que la empuja algo
      // con peso, no un temporizador.
      easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({finished}) => {
      if (finished && !open) {
        setShown(null);
      }
    });
    return () => anim.stop();
  }, [open, progress, reduceMotion]);

  if (!shown) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.sheet,
        {
          opacity: progress,
          transform: [
            {
              translateX: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [SLIDE, 0],
              }),
            },
          ],
        },
      ]}
      // Mientras se va ya no es tuya: los toques pasan a la de abajo, que es
      // donde está mirando quien acaba de dar a volver.
      pointerEvents={open ? 'auto' : 'none'}>
      {shown}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Tapa entera a la de abajo, con fondo opaco: la de abajo sigue montada, pero
  // no se ve ni se toca.
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0f0f0f',
  },
});
