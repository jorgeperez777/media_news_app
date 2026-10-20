import {useEffect, useState} from 'react';
import {AccessibilityInfo} from 'react-native';

/**
 * Duraciones y la única regla que comparten todas las animaciones de la app.
 *
 * Están en el mismo rango que las del sistema —una pantalla entra en unos
 * 350 ms en iOS y algo menos en Android— porque por debajo de 250 ms la
 * transición pasa desapercibida: no se ve el movimiento, solo que la pantalla
 * ya ha cambiado, que es el salto seco que se quería quitar. Entrar tarda más
 * que salir: al volver atrás ya sabes lo que hay debajo y estorba esperarlo.
 */

/** Lo que tarda una pantalla en entrar. */
export const ENTER_MS = 350;

/** Lo que tarda en irse: más rápido que entrar. */
export const EXIT_MS = 280;

/** La entrada del contenido al cambiar de pestaña. */
export const TAB_MS = 300;

/** Lo que tarda una carátula en aparecer una vez cargada. */
export const IMAGE_MS = 350;

/**
 * Si el sistema tiene puesto «reducir movimiento».
 *
 * Quien lo activa no lo hace por gusto: a mucha gente el deslizamiento de media
 * pantalla le marea de verdad. Con esto puesto, las animaciones duran cero y el
 * cambio es seco, que es justo lo que ha pedido.
 */
export function useReduceMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (alive) {
        setReduce(value);
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
