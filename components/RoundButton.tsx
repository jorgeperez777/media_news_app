import React from 'react';
import {Pressable, StyleSheet, type ViewStyle} from 'react-native';

/**
 * Botón redondo que va suelto encima de una portada (la flecha de volver de la
 * ficha de serie, por ejemplo).
 *
 * Fondo sólido, sin desenfoque: es más barato, se ve igual en las dos
 * plataformas y en Android el desenfoque ni siquiera capturaba el vídeo.
 */
export default function RoundButton({
  children,
  onPress,
  accessibilityLabel,
  size = 40,
  style,
}: {
  children: React.ReactNode;
  onPress: () => void;
  accessibilityLabel?: string;
  size?: number;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={10}
      style={({pressed}) => [
        styles.button,
        {width: size, height: size, borderRadius: size / 2},
        style,
        pressed && styles.pressed,
      ]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: '#1f1f22',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  pressed: {opacity: 0.6},
});
