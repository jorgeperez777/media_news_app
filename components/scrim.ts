/**
 * El velo que oscurece el pie de una carátula para que se lea el título.
 *
 * Es un PNG de 1×128 píxeles (250 bytes) con la rampa de opacidad dentro, en
 * base64 y sin fichero aparte. Estirado al tamaño de la tarjeta lo interpola la
 * GPU, así que el degradado sale limpio.
 *
 * Por qué no las dos alternativas evidentes: con `react-native-svg` son dos
 * vistas más por tarjeta y en una rejilla de sesenta se nota; con tres `View`
 * de opacidad creciente se ven los escalones.
 */
export const SCRIM = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAACACAYAAADK+QP0AAAAwUlEQVR42t3EwUYDAAAA0LVay0qZJtnMTCYyGUnMRCJmjBljJGJERIyIER1ixOgwokN0GB2iQ+wwOkSHHUaHDh2iT5l36SP2Di8QmBxT/wU1rRmFNKuw5hTRvBa0qCVFtayYVrSquBJKKqW01pTRujaU1aZy2tK2dpRXQbva074OVFRJZVVUVU11HepIx2roRKc607mautClWrrStW7U1q06ulNX93rQo57U07Ne9Ko39TXQuz70qaFG+tK3fvSrvzGXmx+cklXYeAAAAABJRU5ErkJggg==';
