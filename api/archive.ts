/**
 * Catálogo real desde el Internet Archive (archive.org).
 *
 * Es la API gratuita que mejor encaja aquí: **no pide clave**, devuelve fichas
 * de verdad (título, año, sinopsis, carátula) y, a diferencia de TMDb o OMDb,
 * también da el **vídeo**, porque son obras de dominio público. Así la app pasa
 * a tener información real sin inventarse nada ni arrastrar material de nadie.
 *
 * Dos llamadas, y cada una en su momento:
 *
 * - `fetchMovies()` busca una vez al arrancar: una sola petición para toda la
 *   lista (sin el vídeo, que la búsqueda no lo da).
 * - `fetchStream(id)` se pide al abrir un título, no antes: la lista de ficheros
 *   de un item pesa, y pedir veinte al arrancar sería tirar red y batería.
 *
 * Los `SOURCES` de ejemplo siguen ahí: si no hay red, la app arranca igual con
 * ellos (ver `sources.ts`).
 */

const SEARCH = 'https://archive.org/advancedsearch.php';
const METADATA = 'https://archive.org/metadata';
const DOWNLOAD = 'https://archive.org/download';
/** La carátula que el propio archive genera para cada item. */
const THUMB = 'https://archive.org/services/img';

/**
 * De dónde sacamos las películas. El buscador acepta cualquier colección, pero
 * `feature_films` entera trae material para adultos entre lo más descargado,
 * así que vamos a dos colecciones acotadas: dibujos clásicos y cine mudo.
 */
const COLLECTIONS = [
  'animationandcartoons',
  'silent_films',
  'short_films',
  'SciFi_Horror',
];

/**
 * Lo que no sale aunque lo devuelva la búsqueda. La lista es corta a propósito:
 * son títulos muy descargados que no queremos de portada en una app de demo.
 */
const BLOCKED = new Set(['dw_griffith_birth_of_a_nation', 'TheBirthOfANation']);

/**
 * Y por título, para lo que no se puede listar de antemano. El archivo tiene
 * material de dominio público perfectamente legal —películas de instrucción
 * policial, cine de explotación— que nadie quiere ver aparecer en una rejilla
 * de «Películas». Es un filtro basto y se come algún falso positivo; prefiero
 * eso a lo contrario.
 */
const BLOCKED_WORDS =
  /\b(sex|sexy|porn|nude|naked|molest\w*|rape|nazi|hitler|lsd|drug|vice|venereal)\b/i;

export type ArchiveMovie = {
  /** Identificador del item: con él se piden ficheros y carátula. */
  id: string;
  title: string;
  /** Año de estreno, si el item lo trae. */
  year?: number;
  description: string;
  /** URL de la carátula (JPEG). */
  poster: string;
};

/** `fetch` con límite de tiempo: la red móvil puede quedarse colgada. */
async function get(url: string, timeout = 15000) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeout);
  try {
    const response = await fetch(url, {signal: abort.signal});
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

/** El campo `description` llega en HTML, y a veces repetido en una lista. */
function clean(value: unknown) {
  const text = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  return text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type SearchDoc = {
  identifier?: string;
  title?: string;
  year?: string | number;
  description?: string | string[];
};

/**
 * Las películas más descargadas de las colecciones elegidas. `rows` es cuántas
 * pedir y `page` por dónde seguir (de ahí sale el «cargar más»); se devuelven
 * solo las que traen título e identificador.
 */
export async function fetchMovies(
  rows = 60,
  page = 1,
): Promise<ArchiveMovie[]> {
  const query = `(${COLLECTIONS.map(name => `collection:"${name}"`).join(
    ' OR ',
  )}) AND mediatype:"movies"`;
  const fields = ['identifier', 'title', 'year', 'description']
    .map(name => `&fl%5B%5D=${name}`)
    .join('');
  const url =
    `${SEARCH}?q=${encodeURIComponent(query)}${fields}` +
    `&sort%5B%5D=${encodeURIComponent('downloads desc')}` +
    `&rows=${rows}&page=${page}&output=json`;

  const body = (await get(url)) as {response?: {docs?: SearchDoc[]}};
  const docs = body.response?.docs ?? [];

  return docs
    .filter(
      doc =>
        doc.identifier &&
        doc.title &&
        !BLOCKED.has(doc.identifier) &&
        !BLOCKED_WORDS.test(clean(doc.title)),
    )
    .map(doc => {
      const year = Number(doc.year);
      return {
        id: doc.identifier as string,
        title: clean(doc.title),
        year: Number.isFinite(year) && year > 1800 ? year : undefined,
        description: clean(doc.description),
        poster: `${THUMB}/${doc.identifier}`,
      };
    });
}

type ArchiveFile = {name?: string; format?: string; source?: string};

/**
 * El MP4 reproducible de un item. Se queda con el derivado que mejor abre el
 * reproductor; si el item está retirado (`is_dark`) o no tiene vídeo, falla y
 * quien llame decide qué enseñar.
 */
export async function fetchStream(id: string): Promise<string> {
  const body = (await get(`${METADATA}/${id}`)) as {
    is_dark?: boolean;
    files?: ArchiveFile[];
  };
  if (body.is_dark) {
    throw new Error(`El item «${id}» ya no está disponible`);
  }

  const files = (body.files ?? []).filter(file =>
    /\.(mp4|m4v)$/i.test(file.name ?? ''),
  );
  // Orden de preferencia: el derivado h.264 que genera archive, luego el MPEG4
  // de 512 kbps y, si no hay ninguno, lo primero que suene a MP4.
  const pick =
    files.find(file => /h\.?264/i.test(file.format ?? '')) ??
    files.find(file => /mpeg4/i.test(file.format ?? '')) ??
    files[0];
  if (!pick?.name) {
    throw new Error(`El item «${id}» no trae vídeo MP4`);
  }
  return `${DOWNLOAD}/${id}/${encodeURIComponent(pick.name)}`;
}
