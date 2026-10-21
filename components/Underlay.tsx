import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, type ViewStyle} from 'react-native';
import {ENTER_MS, EXIT_MS, useReduceMotion} from './motion';

/**
 * La pantalla de **abajo** mientras se le pone algo encima: se aleja un poco y
 * se apaga.
 *
 * `Sheet` trae la de arriba deslizándola desde la derecha, pero hasta ahora la
 * de abajo se quedaba quieta y plana, y eso hace que la nueva parezca pegada
 * sobre un fondo muerto en vez de delante de algo. Con un paso atrás —un poco
 * más pequeña y más oscura— las dos quedan en planos distintos: se ve que lo
 * anterior sigue ahí, esperando, que es justo lo que pasa (no se desmonta, ver
 * `App`).
 *
 * El viaje es corto a propósito: el reproductor se dibuja **fuera** de esta
 * pila (ver `PlayerHost`), así que no encoge con ella. Con un 5% no se nota el
 * desajuste en los milisegundos que tarda la de arriba en taparlo.
 */

/** Lo que se queda al alejarse. 1 = no se mueve. */
const SCALE = 0.95;
/** Lo que se apaga: 1 = tal cual, 0 = negro. */
const DIM = 0.5;

export default function Underlay({
  covered,
  children,
  style,
}: {
  /** Si hay algo abierto encima. */
  covered: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(covered ? 1 : 0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: covered ? 1 : 0,
      // Los mismos tiempos y la misma curva que `Sheet`: las dos pantallas se
      // mueven a la vez o se nota que son dos animaciones distintas.
      duration: reduceMotion ? 0 : covered ? ENTER_MS : EXIT_MS,
      easing: covered ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [covered, progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        styles.fill,
        style,
        {
          opacity: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [1, DIM],
          }),
          transform: [
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, SCALE],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {flex: 1},
});
