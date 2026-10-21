/**
 * Ficha de cine desde TMDb (themoviedb.org).
 *
 * Reparto de papeles con el resto de APIs: el Internet Archive pone el **vídeo**
 * y el título (ver `api/archive.ts`), y TMDb pone todo lo demás —cartel, fondo,
 * sinopsis **en el idioma de la app**, géneros, duración, nota, dirección y
 * reparto—. TMDb no sirve vídeo, así que no sustituye al archivo: lo viste.
 *
 * Cómo se empareja: se busca por título y año, y solo se da por buena la
 * coincidencia si el título **normalizado** es el mismo. Los títulos del
 * archivo vienen sucios («… (Complete 1994 Series)») y sin ese filtro acabarías
 * poniéndole a un corto el cartel de otra película.
 *
 * Dos peticiones por título (buscar y pedir la ficha), guardadas un mes en el
 * dispositivo: la segunda vez no se toca la red.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLanguage} from '../i18n';
import {TMDB_KEY} from './keys';

const API = 'https://api.themoviedb.org/3';
/** CDN de imágenes: el tamaño va en la ruta. */
const IMAGES = 'https://image.tmdb.org/t/p';
/**
 * El número va en la clave: al cambiar lo que guardamos de cada película (al
 * añadir el tráiler, por ejemplo) se sube y lo viejo se ignora solo, sin tener
 * que borrarle los datos a nadie.
 */
const CACHE_PREFIX = 'tmdb:3:';
/** Lo guardado caduca al mes: una ficha de cine no cambia a menudo. */
const MAX_AGE = 30 * 24 * 3600 * 1000;

export type MovieFacts = {
  tmdbId: number;
  /** Cartel vertical, para las carátulas. */
  poster?: string;
  /** Fondo apaisado, para la cabecera de la ficha. */
  backdrop?: string;
  overview?: string;
  /** Géneros ya traducidos por TMDb. */
  genres: string[];
  /** Minutos. */
  runtime?: number;
  /** Nota media, de 0 a 10. */
  rating?: number;
  director?: string;
  cast: string[];
  year?: number;
  /** Id del tráiler en YouTube, cuando TMDb tiene uno. */
  trailer?: string;
};

type Cached = {at: number; facts: MovieFacts | null};

/** Idioma de la app en el formato que espera TMDb. */
const locale = () => (getLanguage() === 'en' ? 'en-US' : 'es-ES');

/**
 * Para comparar títulos: sin acentos, sin puntuación y sin lo que el archivo
 * añade entre paréntesis.
 */
function normalize(title: string) {
  return title
    .replace(/[([][^)\]]*[)\]]/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

async function get(path: string, params: Record<string, string | number> = {}) {
  const query = Object.entries({api_key: TMDB_KEY, ...params})
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch(`${API}${path}?${query}`, {
      signal: abort.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return (await response.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

type SearchResult = {
  id: number;
  title?: string;
  original_title?: string;
  release_date?: string;
};

/** El id de TMDb de un título, o `null` si no hay una coincidencia clara. */
async function findId(title: string, year?: number) {
  const wanted = normalize(title);
  if (!wanted) {
    return null;
  }
  const body = await get('/search/movie', {
    language: locale(),
    query: wanted,
    ...(year ? {year} : {}),
  });
  const results = (body.results ?? []) as SearchResult[];
  const match = results.find(
    item =>
      normalize(item.title ?? '') === wanted ||
      normalize(item.original_title ?? '') === wanted,
  );
  // Con año, un único resultado ya es suficientemente fiable aunque el título
  // no calce letra a letra (acentos, artículos, «The»…).
  if (!match && year && results.length === 1) {
    return results[0].id;
  }
  return match?.id ?? null;
}

type Credits = {
  cast?: Array<{name?: string}>;
  crew?: Array<{name?: string; job?: string}>;
};

type Video = {site?: string; type?: string; key?: string; official?: boolean};

/** El tráiler de YouTube que mejor pinta: oficial y de tipo tráiler primero. */
function pickTrailer(videos: Video[]) {
  const youtube = videos.filter(video => video.site === 'YouTube' && video.key);
  const trailers = youtube.filter(video => video.type === 'Trailer');
  const teasers = youtube.filter(video => video.type === 'Teaser');
  const best =
    trailers.find(video => video.official) ??
    trailers[0] ??
    teasers.find(video => video.official) ??
    teasers[0];
  return best?.key;
}

async function fetchDetail(id: number): Promise<MovieFacts> {
  const body = await get(`/movie/${id}`, {
    language: locale(),
    // Una sola petición para ficha, equipo y tráilers.
    append_to_response: 'credits,videos',
    // Los tráilers suelen estar solo en inglés: sin esto, en español no sale
    // ninguno.
    include_video_language: 'es,en,null',
  });
  const credits = (body.credits ?? {}) as Credits;
  const videos = ((body.videos ?? {}) as {results?: Video[]}).results ?? [];
  const date = String(body.release_date ?? '');
  const poster = body.poster_path as string | null;
  const backdrop = body.backdrop_path as string | null;

  return {
    tmdbId: id,
    // w342 en vez de w500: las carátulas miden ~160 dp, y una imagen más
    // pequeña es menos red y menos memoria por tarjeta.
    poster: poster ? `${IMAGES}/w342${poster}` : undefined,
    backdrop: backdrop ? `${IMAGES}/w780${backdrop}` : undefined,
    overview: String(body.overview ?? '').trim() || undefined,
    genres: ((body.genres ?? []) as Array<{name: string}>).map(
      genre => genre.name,
    ),
    runtime: Number(body.runtime) || undefined,
    rating: Number(body.vote_average) || undefined,
    director: credits.crew?.find(person => person.job === 'Director')?.name,
    cast: (credits.cast ?? [])
      .slice(0, 4)
      .map(person => person.name ?? '')
      .filter(Boolean),
    year: date ? Number(date.slice(0, 4)) : undefined,
    trailer: pickTrailer(videos),
  };
}

/**
 * La ficha de una película, o `null` si TMDb no la tiene (o no hay red). No
 * lanza: quien llame se queda con lo que ya tenía.
 */
export async function fetchFacts(
  title: string,
  year?: number,
): Promise<MovieFacts | null> {
  if (!TMDB_KEY) {
    return null;
  }
  const key = `${CACHE_PREFIX}${locale()}|${normalize(title)}|${year ?? ''}`;

  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) {
      const cached = JSON.parse(saved) as Cached;
      if (Date.now() - cached.at < MAX_AGE) {
        return cached.facts;
      }
    }
  } catch {
    // Caché ilegible: se pregunta otra vez, que es justo lo que viene ahora.
  }

  let facts: MovieFacts | null = null;
  try {
    const id = await findId(title, year);
    // Los años del archivo no siempre son los del estreno: si con año no sale,
    // se prueba sin él antes de darla por perdida.
    const found = id ?? (year ? await findId(title) : null);
    facts = found ? await fetchDetail(found) : null;
  } catch {
    // Sin red no se guarda nada: así se reintenta en cuanto vuelva.
    return null;
  }

  try {
    await AsyncStorage.setItem(
      key,
      JSON.stringify({at: Date.now(), facts} satisfies Cached),
    );
  } catch {
    // Que no se pueda guardar no impide enseñar la ficha.
  }
  return facts;
}

/**
 * Catálogo entero de TMDb, para **probar**: su `discover` ordenado por
 * popularidad, que es la lista de la que salen las demás.
 *
 * TMDb no sirve vídeo (ver la cabecera de este fichero), así que lo que se trae
 * de aquí son fichas sin película detrás. Quien las use tiene que ponerles un
 * vídeo de prueba; eso se hace en `sources.ts` y solo cuando se pide a mano
 * desde Diagnóstico.
 */
export type TmdbTitle = {
  tmdbId: number;
  title: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  genres: string[];
  rating?: number;
};

type DiscoverResult = {
  id: number;
  title?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  genre_ids?: number[];
  vote_average?: number;
};

/** id de género → nombre ya traducido. Se pide una vez por idioma. */
const genreNames = new Map<string, Map<number, string>>();

async function genres() {
  const language = locale();
  const known = genreNames.get(language);
  if (known) {
    return known;
  }
  const body = await get('/genre/movie/list', {language});
  const list = (body.genres ?? []) as Array<{id: number; name: string}>;
  const map = new Map(list.map(genre => [genre.id, genre.name]));
  genreNames.set(language, map);
  return map;
}

/**
 * Una página del catálogo (20 títulos). `page` empieza en 1 y TMDb corta en la
 * 500, que son 10.000 películas: de sobra para llenar la app.
 */
export async function fetchCatalogPage(page = 1): Promise<TmdbTitle[]> {
  const names = await genres();
  const body = await get('/discover/movie', {
    language: locale(),
    sort_by: 'popularity.desc',
    include_adult: 'false',
    include_video: 'false',
    page,
  });
  const results = (body.results ?? []) as DiscoverResult[];
  return results
    .filter(movie => movie.title)
    .map(movie => ({
      tmdbId: movie.id,
      title: movie.title as string,
      overview: movie.overview || undefined,
      poster: movie.poster_path
        ? `${IMAGES}/w342${movie.poster_path}`
        : undefined,
      backdrop: movie.backdrop_path
        ? `${IMAGES}/w780${movie.backdrop_path}`
        : undefined,
      year: movie.release_date
        ? Number(movie.release_date.slice(0, 4))
        : undefined,
      genres: (movie.genre_ids ?? [])
        .map(id => names.get(id))
        .filter((name): name is string => !!name),
      rating: movie.vote_average,
    }));
}

/* --------------------------------------------------------------------------
 * Series
 * ------------------------------------------------------------------------ */

/**
 * TMDb tiene las series en una rama aparte de las películas: `/tv/popular`
 * para el listado, `/tv/{id}/season/{n}` para los episodios de una temporada.
 * Los géneros también van por su lista (`/genre/tv/list`): los de televisión no
 * son los del cine.
 *
 * Igual que con las películas, aquí no hay vídeo: TMDb sirve la ficha y quien
 * llame le pone la película (ver `loadTmdbSeries`, que les pone los vídeos de
 * muestra).
 */

export type TmdbEpisode = {
  season: number;
  number: number;
  title: string;
  overview?: string;
  /** Fotograma apaisado del episodio, que es lo que TMDb da por episodio. */
  still?: string;
  /** Minutos. */
  runtime?: number;
  year?: number;
};

export type TmdbSeries = {
  tmdbId: number;
  title: string;
  overview?: string;
  poster?: string;
  backdrop?: string;
  year?: number;
  genres: string[];
  rating?: number;
  episodes: TmdbEpisode[];
};

type CachedSeries = {at: number; series: TmdbSeries | null};

/** id de género de televisión → nombre traducido; una vez por idioma. */
const tvGenreNames = new Map<string, Map<number, string>>();

async function tvGenres() {
  const language = locale();
  const known = tvGenreNames.get(language);
  if (known) {
    return known;
  }
  const body = await get('/genre/tv/list', {language});
  const list = (body.genres ?? []) as Array<{id: number; name: string}>;
  const map = new Map(list.map(genre => [genre.id, genre.name]));
  tvGenreNames.set(language, map);
  return map;
}

type TvResult = {
  id: number;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  first_air_date?: string;
  genre_ids?: number[];
  vote_average?: number;
};

type SeasonEpisode = {
  episode_number?: number;
  season_number?: number;
  name?: string;
  overview?: string;
  still_path?: string | null;
  runtime?: number;
  air_date?: string;
};

/**
 * Cuántos episodios se cogen de una temporada.
 *
 * Medido: sin tope, veinte series populares daban 4.374 episodios y diez
 * megas en una sola fila del almacén, porque una temporada de una serie diaria
 * trae cientos. Con veinte por serie hay de sobra para ver cómo queda la ficha
 * y la lista.
 */
const MAX_EPISODES = 20;

/** Los episodios de una temporada, en orden. */
async function fetchSeason(id: number, season: number) {
  const body = await get(`/tv/${id}/season/${season}`, {language: locale()});
  const episodes = (body.episodes ?? []) as SeasonEpisode[];
  return episodes
    .filter(episode => episode.episode_number)
    .slice(0, MAX_EPISODES)
    .map<TmdbEpisode>(episode => ({
      season: episode.season_number ?? season,
      number: episode.episode_number as number,
      title: episode.name?.trim() || `Episodio ${episode.episode_number}`,
      overview: episode.overview?.trim() || undefined,
      // w300: va en una carátula apaisada, no a pantalla completa.
      still: episode.still_path
        ? `${IMAGES}/w300${episode.still_path}`
        : undefined,
      runtime: Number(episode.runtime) || undefined,
      year: episode.air_date ? Number(episode.air_date.slice(0, 4)) : undefined,
    }));
}

/**
 * Una serie con los episodios de su primera temporada. Guardada un mes, como
 * las fichas de cine: son dos peticiones por serie y no cambian a diario.
 */
async function fetchSeries(
  show: TvResult,
  names: Map<number, string>,
): Promise<TmdbSeries | null> {
  const key = `${CACHE_PREFIX}tv|${locale()}|${show.id}`;
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved) {
      const cached = JSON.parse(saved) as CachedSeries;
      if (Date.now() - cached.at < MAX_AGE) {
        return cached.series;
      }
    }
  } catch {
    // Sin caché se pide y punto.
  }

  let series: TmdbSeries | null = null;
  try {
    const episodes = await fetchSeason(show.id, 1);
    if (episodes.length > 0) {
      series = {
        tmdbId: show.id,
        title: show.name as string,
        overview: show.overview?.trim() || undefined,
        poster: show.poster_path
          ? `${IMAGES}/w342${show.poster_path}`
          : undefined,
        backdrop: show.backdrop_path
          ? `${IMAGES}/w780${show.backdrop_path}`
          : undefined,
        year: show.first_air_date
          ? Number(show.first_air_date.slice(0, 4))
          : undefined,
        genres: (show.genre_ids ?? [])
          .map(id => names.get(id))
          .filter((name): name is string => !!name),
        rating: show.vote_average,
        episodes,
      };
    }
  } catch {
    // Una serie que no se puede traer no tumba la página entera.
    return null;
  }

  await AsyncStorage.setItem(
    key,
    JSON.stringify({at: Date.now(), series} satisfies CachedSeries),
  ).catch(() => {});
  return series;
}

/**
 * Una página de series populares (20), ya con los episodios de la primera
 * temporada. Las series van de cuatro en cuatro para no soltarle a TMDb veinte
 * peticiones de golpe.
 */
export async function fetchSeriesPage(page = 1): Promise<TmdbSeries[]> {
  if (!TMDB_KEY) {
    return [];
  }
  const names = await tvGenres();
  const body = await get('/tv/popular', {language: locale(), page});
  const shows = ((body.results ?? []) as TvResult[]).filter(show => show.name);

  const found: TmdbSeries[] = [];
  for (let from = 0; from < shows.length; from += 4) {
    const batch = await Promise.all(
      shows.slice(from, from + 4).map(show => fetchSeries(show, names)),
    );
    batch.forEach(series => series && found.push(series));
  }
  return found;
}
