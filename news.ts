/**
 * Noticias de prueba para la pestaña Noticias.
 *
 * Son **inventadas**: ni los medios ni los firmantes existen, y el contenido
 * habla de la propia app a propósito, para que nadie confunda esto con una
 * noticia real. El catálogo de vídeo vive aparte, en `sources.ts`; lo único que
 * comparten es `channel`, que enlaza una noticia con un canal en directo.
 */

export type Article = {
  id: string;
  /** Sección: la etiqueta de color de la tarjeta. */
  category: string;
  /** Titular. */
  title: string;
  /** Entradilla: lo que se lee bajo el titular en la ficha. */
  summary: string;
  /** Cuerpo, un párrafo por elemento. */
  body: string[];
  /** Medio (inventado) y quien firma. */
  source: string;
  author: string;
  /** Cuándo se publicó, en ISO. De aquí sale el «hace 6 h» de la tarjeta. */
  publishedAt: string;
  /**
   * Fotos de la noticia. Como no hay imágenes de verdad se dibujan (ver el
   * `Shot` de la ficha): de cada una solo se guarda el pie. Con más de una, la
   * ficha las pasa en carrusel; sin `images`, se dibuja una sola.
   */
  images?: Array<{caption: string}>;
  /** Las destacadas salen en el carrusel de «Última hora». */
  featured?: boolean;
  /**
   * Canal del catálogo relacionado (índice global). Si lo tiene, la ficha saca
   * el botón de verlo en directo.
   */
  channel?: number;
};

/** Hoy, para que las fechas de ejemplo no envejezcan solas. */
const now = Date.now();
const hoursAgo = (hours: number) =>
  new Date(now - hours * 3600 * 1000).toISOString();

export const ARTICLES: Article[] = [
  {
    id: 'hls-multicalidad',
    category: 'Tecnología',
    title: 'El reproductor cambia de calidad sin cortar la imagen',
    summary:
      'La nueva versión escoge el bitrate por su cuenta y deja elegirlo a mano desde el menú ⚙.',
    body: [
      'La reproducción adaptativa decide la calidad según el ancho de banda que mide en cada momento. Cuando la red se estrecha, el reproductor baja de escalón antes de quedarse sin búfer, y vuelve a subir en cuanto puede.',
      'En el menú de ajustes se puede fijar un tope manual: útil con datos móviles o para comprobar cómo se ve una calidad concreta. El modo «ahorro de datos» hace lo mismo automáticamente cuando no hay Wi-Fi.',
      'La barra fina de abajo sigue moviéndose aunque se oculten los controles, así que se nota el avance sin tocar la pantalla.',
    ],
    source: 'Redacción Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(6),
    featured: true,
    channel: 0,
  },
  {
    id: 'directo-dvr',
    category: 'Directos',
    title: 'Los canales con DVR permiten rebobinar diez minutos',
    summary:
      'La barra deja de ir pegada al borde y aparece el botón para volver al directo.',
    body: [
      'En un directo con ventana DVR la barra representa los últimos minutos emitidos, no el programa entero. Al arrastrar hacia atrás, el badge EN VIVO se apaga y aparece el botón para volver al borde.',
      'Si el canal no tiene ventana, la barra desaparece: no hay nada que rebobinar y enseñarla sería mentir.',
    ],
    source: 'Redacción Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(11),
    featured: true,
    channel: 1,
  },
  {
    id: 'subtitulos-idiomas',
    category: 'Accesibilidad',
    title: 'Los subtítulos recuerdan el idioma entre vídeos',
    summary:
      'La elección se guarda por idioma, no por número de pista, que cambia de un stream a otro.',
    body: [
      'Al elegir subtítulos en español, el reproductor guarda el idioma. En el vídeo siguiente busca esa pista y la activa en cuanto el stream anuncia las suyas, aunque esté en otra posición de la lista.',
      'Lo mismo vale para el audio: si un título trae varios idiomas, se respeta el último que se eligiera.',
    ],
    source: 'Boletín Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(20),
    featured: true,
  },
  {
    id: 'rodaje-inmersivo',
    category: 'Reportaje',
    title: 'Un día de rodaje para probar el reproductor en horizontal',
    summary:
      'Tres planos, tres pruebas: giro de pantalla, bloqueo de controles y salto de capítulo.',
    body: [
      'La jornada empezó con el plano general: se abre un episodio, la pantalla gira sola y el vídeo ocupa todo. Sin botón de pantalla completa, porque ya se nace en ella.',
      'El segundo plano sirvió para el candado. Con los controles bloqueados, los toques no hacen nada y solo queda la píldora para desbloquear, que es justo lo que se quiere con el móvil en la mano.',
      'El último fue para los capítulos y el botón de saltar intro, que aparece solo en los tramos marcados como saltables y desaparece en cuanto pasan.',
    ],
    source: 'Boletín Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(14),
    featured: true,
    images: [
      {caption: 'Plano general: la pantalla gira al abrir el episodio.'},
      {caption: 'Detalle del candado con los controles bloqueados.'},
      {caption: 'La tarjeta de siguiente episodio, en los últimos segundos.'},
    ],
  },
  {
    id: 'modo-inmersivo',
    category: 'Series',
    title: 'Los episodios se abren en horizontal, como en las grandes apps',
    summary:
      'Nada de reproductor empotrado: el capítulo nace a pantalla completa y atrás devuelve a la ficha.',
    body: [
      'La ficha de una serie enseña la portada, el botón que sabe por dónde ibas y la lista de episodios. Al reproducir, la pantalla gira y el vídeo ocupa todo; el botón atrás cierra el episodio y vuelve a la ficha.',
      'Dentro hay candado para bloquear los controles, lista de episodios para saltar a otro sin salir y tarjeta de «siguiente episodio» en los últimos segundos.',
    ],
    source: 'Boletín Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(28),
  },
  {
    id: 'noticias-24h',
    category: 'Directos',
    title: 'Un canal de noticias 24/7 para probar el cambio de calidad',
    summary:
      'Emite sin parar, así que sirve para ver cómo se comporta la app con la red cambiando.',
    body: [
      'Un canal lineal que no para nunca es la mejor prueba de resistencia: se deja sonando y se observa cómo reacciona a los cambios de red, a la pantalla apagada y al cambio de aplicación.',
      'Desde la guía se salta de canal con ⏮ y ⏭ sin recrear el reproductor: solo cambia la fuente.',
    ],
    source: 'Redacción Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(36),
    channel: 2,
  },
  {
    id: 'mi-lista',
    category: 'Producto',
    title: 'Mi lista guarda lo que marcas, aunque cierres la app',
    summary:
      'El + de una ficha escribe en el almacenamiento del dispositivo y la pestaña Favoritos lo lee.',
    body: [
      'Lo guardado se identifica por la URL del vídeo y no por su posición en el catálogo, que cambia en cuanto se añade o se quita un título.',
      'La misma lista recoge las noticias marcadas con el corazón, así que todo lo que interesa acaba en el mismo sitio.',
    ],
    source: 'Boletín Demo',
    author: 'Equipo de pruebas',
    publishedAt: hoursAgo(50),
  },
];

/** Las del carrusel. */
export const FEATURED = ARTICLES.filter(article => article.featured);
/** El resto, para la lista de recomendadas. */
export const RECOMMENDED = ARTICLES.filter(article => !article.featured);

export const articleById = (id: string) =>
  ARTICLES.find(article => article.id === id);
