import React from 'react';
import {Text as NativeText, type TextProps} from 'react-native';
import {FONT} from '../theme';

/**
 * `<Text>` de React Native con la letra de la app delante (ver `FONT`): así no
 * hay que repetir `fontFamily` en cada estilo. Uno que traiga la suya manda.
 */
export default function Text({style, ...props}: TextProps) {
  return <NativeText {...props} style={FONT ? [{fontFamily: FONT}, style] : style} />;
}
