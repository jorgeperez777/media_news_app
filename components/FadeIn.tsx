import React, {useEffect, useRef} from 'react';
import {Animated, Easing, type ViewStyle} from 'react-native';
import {TAB_MS, useReduceMotion} from './motion';

/**
 * Entrada corta para el contenido de una pestaña: aparece subiendo un poco.
 *
 * Se anima **al montarse**, así que en `App` lleva `key={tab}`: cambiar de
 * pestaña monta otro y la entrada se repite. No hay cruce entre la que se va y
 * la que llega —tendrían que estar las dos vivas a la vez— y no hace falta: lo
 * que chirriaba era que la pantalla nueva apareciera sin más.
 */

/** Lo que sube al entrar. Un acento, pero visible. */
const RISE = 22;

export default function FadeIn({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: reduceMotion ? 0 : TAB_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [progress, reduceMotion]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [RISE, 0],
              }),
            },
          ],
        },
      ]}>
      {children}
    </Animated.View>
  );
}
