import React, {useEffect, useState} from 'react';
import {
  AccessibilityInfo,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import LottieView, {type AnimationObject} from 'lottie-react-native';
import loader from '../assets/lottie/loader.json';

/**
 * Animaciones Lottie (los .json que exporta After Effects con Bodymovin, y los
 * .lottie empaquetados).
 *
 * Es una capa fina sobre `lottie-react-native`; está aquí para tres cosas que
 * conviene que sean iguales en toda la app: el tamaño se pide en un solo número
 * (los Lottie son cuadrados casi siempre), para el lector de pantalla esto es
 * decoración, y si el usuario ha pedido menos movimiento la animación se queda
 * quieta en un fotograma en vez de dar vueltas sin parar.
 */

/** Tres formas de dar la animación: el .json importado, una URL o una ruta. */
export type LottieSource = AnimationObject | {uri: string} | string;

/** La animación de carga que trae la app (`assets/lottie/loader.json`). */
export const LOADER: LottieSource = loader as AnimationObject;

/** Fotograma en el que se queda parada con «reducir movimiento». */
const STILL_PROGRESS = 0.35;

export default function Lottie({
  source,
  size,
  loop = true,
  autoPlay = true,
  speed = 1,
  style,
  onFinish,
}: {
  source: LottieSource;
  /** Lado del cuadrado en el que se dibuja. */
  size: number;
  loop?: boolean;
  autoPlay?: boolean;
  speed?: number;
  style?: ViewStyle;
  /** Solo se llama si `loop` es false. */
  onFinish?: () => void;
}) {
  const still = useReduceMotion();

  return (
    // La vista de Lottie no admite props de accesibilidad: el envoltorio es el
    // que la esconde del lector de pantalla. Para él esto es adorno; lo que
    // significa (que está cargando, que ha terminado…) lo dice quien la coloca.
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{width: size, height: size}, style]}>
      <LottieView
        source={source}
        style={styles.fill}
        // Con «reducir movimiento» no se anima: se deja un fotograma con forma.
        autoPlay={autoPlay && !still}
        loop={loop && !still}
        progress={still ? STILL_PROGRESS : undefined}
        speed={speed}
        onAnimationFinish={onFinish}
      />
    </View>
  );
}

const styles = StyleSheet.create({fill: {width: '100%', height: '100%'}});

/** Si el sistema tiene activado «reducir movimiento». */
function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (alive) {
        setReduce(enabled);
      }
    });
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduce,
    );
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  return reduce;
}
