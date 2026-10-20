import React, {useState} from 'react';
import {
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import {t} from '../i18n';
import {ENTER_MS, useReduceMotion} from './motion';

/**
 * Texto recortado a unas líneas con «Ver completo» debajo, y solo cuando hace
 * falta: si cabe entero, no aparece nada.
 *
 * Para saber si se queda corto se mide una copia invisible sin recorte. Con
 * `numberOfLines` puesto, `onTextLayout` ya devuelve las líneas recortadas, así
 * que preguntarle al propio texto no vale.
 *
 * Al abrirlo y cerrarlo, lo de debajo se acomoda con `LayoutAnimation`: no hay
 * una altura que animar —el texto crece porque le quitas el recorte— pero sí se
 * puede pedir que el cambio de disposición entero se haga con una transición.
 */

/** Cómo se acomoda todo al abrir o cerrar. */
const RELAYOUT = {
  duration: ENTER_MS,
  update: {type: 'easeInEaseOut' as const},
  // Lo que entra y sale (el propio enlace, los créditos de debajo) se funde en
  // vez de aparecer: moverlo Y encenderlo a la vez marea.
  create: {type: 'easeInEaseOut' as const, property: 'opacity' as const},
  delete: {type: 'easeInEaseOut' as const, property: 'opacity' as const},
};
export default function ExpandableText({
  text,
  lines = 3,
  style,
  linkStyle,
}: {
  text: string;
  /** Líneas que se ven plegado. */
  lines?: number;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [total, setTotal] = useState(0);
  const long = total > lines;
  const reduceMotion = useReduceMotion();

  return (
    <View>
      <Text
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[style, styles.probe]}
        onTextLayout={event => setTotal(event.nativeEvent.lines.length)}>
        {text}
      </Text>

      <Text style={style} numberOfLines={expanded || !long ? undefined : lines}>
        {text}
      </Text>

      {long && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{expanded}}
          onPress={() => {
            if (!reduceMotion) {
              LayoutAnimation.configureNext(RELAYOUT);
            }
            setExpanded(open => !open);
          }}
          hitSlop={8}
          style={({pressed}) => [styles.link, pressed && styles.pressed]}>
          <Text style={[styles.linkText, linkStyle]}>
            {t(expanded ? 'detail.readLess' : 'detail.readMore')}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  // La copia que se mide: ocupa el mismo ancho y no se ve ni se toca.
  probe: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
  },
  link: {marginTop: 6},
  linkText: {color: '#fff', fontSize: 13, fontWeight: '700'},
  pressed: {opacity: 0.6},
});
