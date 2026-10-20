import {useEffect, useState} from 'react';
import {Keyboard, Platform} from 'react-native';

/**
 * Cuánto de la pantalla **tapa** el teclado, en puntos (0 si no está).
 *
 * No devuelve el alto del teclado a secas, sino lo que solapa con la ventana:
 * en Android la ventana se encoge sola (`adjustResize` en el manifest), así que
 * ahí el solape ya es 0 y no hay que subir nada; en iOS el teclado se pone
 * encima y sí hay que apartarse. La misma cuenta vale para los dos.
 *
 * En iOS se escucha `Will` (empieza con la animación del teclado, no después) y
 * en Android `Did`, que es lo único que llega.
 */
export default function useKeyboard(windowHeight: number) {
  const [screenY, setScreenY] = useState(Infinity);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(
      ios ? 'keyboardWillShow' : 'keyboardDidShow',
      event => setScreenY(event.endCoordinates.screenY),
    );
    const hidden = Keyboard.addListener(
      ios ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setScreenY(Infinity),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return Math.min(windowHeight, Math.max(0, windowHeight - screenY));
}
