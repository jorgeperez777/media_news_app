
/**
 * Los colores de la marca.
 *
 * Sustituyen al rojo heredado del reproductor (que era el de YouTube/Netflix).
 * El degradado va de `ACCENT` a `ACCENT_END`, igual que los botones del diseño.
 */

/** Azul violeta: el color principal, el que mejor se ve sobre negro. */
export const ACCENT = '#574CD8';
/** Morado intermedio de la paleta. */
export const ACCENT_MID = '#721C9B';
/** Magenta: el final del degradado. */
export const ACCENT_END = '#972B99';

/**
 * El relleno de las barras de progreso, como imagen.
 *
 * Es un PNG de 64×1 px (298 bytes) con el degradado dentro, en base64. Se
 * estira al ancho de la barra y lo interpola la GPU: un degradado de verdad por
 * el precio de una vista, sin SVG ni librerías (mismo truco que `SCRIM`).
 */
export const PROGRESS_GRADIENT = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAAABCAYAAABubagXAAAA8UlEQVR42gXB41YDAACA0d6nrbl5qxn9z7bdybbdybZt28bbfN3r4e/3R4D7l0D3D0Gub4JdX4Q4Pwl1fhDmeCfc8UaE/ZVI+wtRtmeibU/EWB+JtT4QZ7kn3nJHgvmWRPMNSaZrkk1XpPhekupzQZrPOenGMzKMp2QaTsgyHJOtPyJHf0iu7oA83T752j0KtLsUanYo0mxTrN6iRL1JqWqDMtU65co1KpSrVHqvUKVYplqxRI18kVr5AnWyeeplczRIZ2mUztAkmaZZMkWLeJJW8QRtonHaRWN0eI3S6TVCl3CYbuEQPYJBegUD9Hn28w/6CJqBH8XYXAAAAABJRU5ErkJggg==';

/**
 * La letra de la app en las dos plataformas: Figtree (SIL OFL), geométrica y
 * amable como la de Pluto TV, que es propietaria. En Android va como familia
 * (ver `res/font/figtree.xml` y `MainApplication`); en iOS, en el bundle
 * (`UIAppFonts`). `fontWeight` elige el archivo en las dos.
 */
export const FONT = 'Figtree';
