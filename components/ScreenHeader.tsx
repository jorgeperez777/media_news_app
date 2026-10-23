import React from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import {ArrowBackIcon} from './icons';
import {FONT} from '../theme';

/**
 * Cabecera de una ficha: al principio solo la flecha suelta sobre la portada
 * y, al bajar, un fondo opaco con el título.
 *
 * Son tres fundidos atados al scroll, no tres estados: el fondo entra, el
 * cristal de la flecha se va (ya no hace falta: detrás hay fondo) y el título
 * aparece **cuando el grande de la portada ya se ha ido**, para que no estén
 * los dos a la vez.
 *
 * Todo va con el driver nativo: la cabecera no se queda atrás del dedo aunque
 * JS esté ocupado pintando filas.
 */

/** Alto de la cabecera. Lo usan las pantallas para pegar cosas debajo. */
export const HEADER_HEIGHT = 52;

/** Cuánto hay que bajar para que el fondo esté del todo. */
export const HEADER_FADE = 140;

/** Lo que tarda en entrar el título una vez tapado el grande. */
const TITLE_FADE = 40;

export default function ScreenHeader({
  scrollY,
  title,
  titleAt,
  onBack,
  backLabel,
  style,
}: {
  scrollY: Animated.Value;
  title: string;
  /** Desplazamiento en el que el título grande de la pantalla queda tapado. */
  titleAt: number;
  onBack: () => void;
  backLabel?: string;
  style?: ViewStyle;
}) {
  const headerOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const glassOpacity = scrollY.interpolate({
    inputRange: [0, HEADER_FADE],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Empieza a entrar justo **cuando el grande ya está tapado**, no antes: si se
  // adelanta, se ve el mismo título dos veces.
  const titleOpacity = scrollY.interpolate({
    inputRange: [Math.max(0, titleAt), Math.max(1, titleAt + TITLE_FADE)],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View pointerEvents="box-none" style={[styles.header, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
                    styles.headerBack,
                    {opacity: headerOpacity},
        ]}
      />

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        hitSlop={10}
        style={({pressed}) => [styles.back, pressed && styles.pressed]}>
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.backBack,
            {opacity: glassOpacity},
          ]}
        />
        <ArrowBackIcon size={22} />
      </Pressable>

      <Animated.Text
        numberOfLines={1}
        style={[styles.headerTitle, {opacity: titleOpacity}]}>
        {title}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerBack: {backgroundColor: '#0f0f0f'},
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
  },
  headerTitle: {fontFamily: FONT,flex: 1, color: '#fff', fontSize: 18, fontWeight: '800'},
  back: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBack: {backgroundColor: '#1f1f22'},
  pressed: {opacity: 0.6},
});
