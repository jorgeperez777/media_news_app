/**
 * Claves de las APIs que usa la app.
 *
 * Aquí solo va lo que es **público por naturaleza**: una clave que viaja dentro
 * de la app se puede sacar del binario, así que esto vale para una clave
 * gratuita y de uso personal como la de TMDb. Para algo de verdad, la clave se
 * queda en un servidor propio y la app le pregunta a él.
 *
 * El catálogo (archive.org) **no** necesita clave; esto es solo para la ficha.
 */

/** TMDb (themoviedb.org), clave v3. Vacía = la app va igual, sin fichas. */
export const TMDB_KEY = 'c4adbb2cf3e87df0d48cf7217656497c';
