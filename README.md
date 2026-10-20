# VideoApp

App React Native (0.87, bare) mínima para probar y desarrollar la librería
`react-native-video` que vive en `../video_player`.

La librería se enlaza como symlink (`"react-native-video": "link:../video_player"`)
y Metro observa ese directorio, así que cualquier cambio en `../video_player/src`
se refleja con un reload; los cambios nativos (Kotlin/Swift) requieren recompilar.

## Requisitos

- Node 22, Ruby 4 y JDK 17 — ver `.tool-versions` (`asdf install` los instala; Yarn 3
  viene vendorizado en `.yarn/releases`).
- **iOS:** Xcode + CocoaPods. La primera vez acepta la licencia: `sudo xcodebuild -license accept`.
  El `Gemfile` fija `json < 3` y añade `nkf` (Ruby 4 de Homebrew rompe CocoaPods sin eso) y el
  `Podfile` compila la pod `fmt` como C++17 (necesario con Xcode 26+).
- **Android:** SDK en `/opt/homebrew/share/android-commandlinetools` (ya configurado en `android/local.properties`), JDK 17.
- **Parche versionado:** `react-native-orientation-locker` (sin publicar desde 2024) llama a
  `removeListeners:1` en su `dealloc`, y RN 0.87 aborta con redbox si se dan de baja más
  oyentes de los que se dieron de alta — saltaba en cada reload de Metro. El parche está en
  `.yarn/patches/` y lo aplica `yarn install`; no hay que hacer nada a mano.

## Instalación

```bash
yarn install
cd ios && pod install && cd ..   # solo iOS
```

## Ejecutar

```bash
yarn start            # Metro (déjalo abierto)
yarn android          # emulador/dispositivo Android
yarn ios              # simulador iOS
```

### En otro puerto, sin tocar el 8081

Si ya tienes otro proyecto con Metro en el 8081 (un móvil enchufado, por ejemplo), esta
app puede ir por su cuenta en el 8088:

```bash
yarn start --port 8088

# Android: el emulador no ve el 8088 del Mac hasta que se le reenvía
adb -s emulator-5554 reverse tcp:8088 tcp:8088
npx react-native run-android --port 8088

# iOS: el simulador sí ve el Mac, pero el puerto va compilado dentro de la app
npx react-native run-ios --udid <UDID>
xcrun simctl spawn <UDID> defaults write org.reactjs.native.example.VideoApp \
  RCT_jsLocation -string "localhost:8088"
xcrun simctl terminate <UDID> org.reactjs.native.example.VideoApp
xcrun simctl launch   <UDID> org.reactjs.native.example.VideoApp
```

En iOS, `--port` **no basta**: el puerto por defecto es una constante de compilación
(`RCT_METRO_PORT` en `RCTBundleURLProvider`). Lo que sí se puede cambiar en caliente es
`RCT_jsLocation`, que es lo mismo que guarda el menú de desarrollo en «Configure
Bundler»; de ahí el `defaults write` y el relanzar.

En Xcode 27 ya no existe `Simulator.app`: la ventana del simulador la abre
`Xcode.app/Contents/Applications/DeviceHub.app`.

## Flujo de trabajo con la librería

| Cambio en `../video_player` | Qué hacer |
|---|---|
| `src/**` (TS/JS) | `yarn build` en la librería y reload en la app (`r` en Metro): la app consume `lib/`, que es lo compilado |
| `android/**` (Kotlin/Java) | `yarn android` de nuevo |
| `ios/**` (Swift/ObjC) | `yarn ios` de nuevo (si añades archivos, `pod install` antes) |

## Estructura: inicio, fichas, TV en vivo y miniplayer

```
App.tsx ─ PlayerProvider (player/PlayerContext.tsx)
          ├─ HomeScreen / CategoryScreen / SeriesScreen / DetailScreen / LiveScreen / NewsScreen …
          ├─ TabBar (components/TabBar.tsx)          ← Inicio · Noticias · Buscar · Favoritos · Perfil
          └─ PlayerHost (components/PlayerHost.tsx)  ← el <VideoPlayer>, siempre montado
```

**Inicio** es el catálogo entero: destacados en carrusel y, debajo, Seguir viendo,
Películas, Series y En directo. «Ver todo» abre esa categoría en su propia pantalla
(`screens/CategoryScreen.tsx`, una rejilla con todo). La pestaña es una pila: Inicio →
categoría → ficha de serie o de película, y atrás deshace un nivel cada vez.

La pila es de verdad: lo de encima **se pone encima**, no sustituye a lo de abajo. Inicio
sigue montado mientras miras una ficha, así que al volver la portada está por donde la
dejaste. Montarla otra vez al volver la devolvía al principio del scroll, que es lo que
se notaba. Tapada no se queda trabajando: `active={false}` le para el carrusel de
destacados.

### Transiciones

Nada de esto cambia a dónde se va: cambia cómo se llega, que es lo que se sentía seco.

Las duraciones están en `components/motion.ts`, en el mismo rango que las del sistema
(una pantalla entra en unos 350 ms en iOS, algo menos en Android). Por debajo de 250 ms
la transición no se ve: solo notas que la pantalla ya ha cambiado, que es el salto seco
que se quería quitar. Si algún día hay que tocarlas, es ahí y en un solo sitio.

| Qué | Cómo | Dónde |
|---|---|---|
| Abrir una ficha, una categoría o una noticia | Entra desde la derecha (110 px) con fundido, 350 ms; al cerrar, se va por donde vino en 280 ms | `components/Sheet.tsx` |
| Cambiar de pestaña | El contenido entra subiendo 22 px, 300 ms | `components/FadeIn.tsx` |
| Elegir pestaña | El icono crece un 22 % con un muelle blando | `components/TabBar.tsx` |
| Carátula grande de una ficha | Aparece con un fundido al cargar, en vez de plantarse sobre el degradado que hacía de hueco | `components/FadeImage.tsx` |
| Lo que llega de TMDb (géneros, sinopsis, tráiler, ficha técnica) | Entra con fundido cuando contesta la API, unos segundos después del resto | `screens/DetailScreen.tsx` |
| Episodios ↔ Títulos similares, y cambiar de temporada | El panel entra; la rayita de la pestaña crece a lo ancho con un muelle | `screens/SeriesScreen.tsx` |
| «Ver completo» de una sinopsis | Lo de debajo se acomoda con `LayoutAnimation` | `components/ExpandableText.tsx` |

Tres detalles que no se ven pero sostienen lo anterior:

- **El deslizamiento es corto y lleva fundido** porque la pantalla de abajo no se mueve
  (sigue montada con su scroll). Un barrido de pantalla completa sin nada moviéndose
  detrás parece que te tapan la vista de golpe, no que llega algo nuevo.
- **La de encima sigue pintada mientras se va.** Al cerrar, el estado dice que ya no hay
  nada abierto, pero `Sheet` guarda lo último y no lo suelta hasta que acaba la
  animación; si no, desaparecería de un fotograma al siguiente.
- **«Reducir movimiento» manda** (`components/motion.ts`): con esa opción del sistema
  puesta, todo dura cero y el cambio es seco a propósito. A mucha gente el movimiento le
  marea de verdad.

Todo va con `Animated` y el driver nativo —solo opacidad y transformaciones—, así que la
transición no se entrecorta aunque JS esté ocupado cargando la pantalla que entra. La
excepción es «Ver completo»: ahí no hay una altura que animar (el texto crece porque le
quitas el recorte), así que se le pide a `LayoutAnimation` que haga la transición del
cambio de disposición entero.

Las **tarjetas de una rejilla siguen sin fundido**, a propósito: `Poster` lleva
`fadeDuration={0}` desde antes de todo esto porque con sesenta carátulas en pantalla,
sesenta animaciones se notan. El fundido es solo para las imágenes grandes, que son una
por pantalla y están justo donde estás mirando.

El catálogo (`sources.ts`) tiene **tres tipos**, marcados con `kind`, y cada uno se ve de
una manera:

| `kind` | Qué es | Cómo se abre |
|---|---|---|
| `movie` | Película o vídeo suelto | Ficha con portada (`DetailScreen`) y, al reproducir, horizontal a pantalla completa |
| `episode` | Capítulo de una serie | Ficha de la serie (`SeriesScreen`) y de ahí a pantalla completa en horizontal |
| `live` | Canal en directo | Guía de canales (`LiveScreen`) y, al tocarlo, horizontal a pantalla completa, con badge EN VIVO y ventana DVR si la hay |

`movies()`, `allSeries()` (que agrupa los `episode` por `series.id`) y `liveChannels()`
son vistas del mismo array, cada una con el índice global que usa el reproductor, así que
⏮/⏭ se mueven dentro de la sección del elemento actual (un canal no salta a una película,
y un episodio solo encadena con los de su serie). Son funciones, no constantes, porque el
catálogo crece al arrancar (ver más abajo).

### Colores

La paleta de la app vive en `theme.ts`: `#574CD8` (azul violeta), `#721C9B` y `#972B99`.
Sustituyen al **rojo** que el reproductor trae por defecto, que es el de YouTube.

- **Ninguna barra de progreso es de color plano**: todas llevan el **degradado**
  `#574CD8 → #972B99`, metido como PNG de 64×1 px en base64 (`PROGRESS_GRADIENT`, 298
  bytes) y estirado al ancho de lo reproducido. Mismo truco que el velo de las carátulas:
  un degradado de verdad por el precio de una vista, sin SVG ni librerías. Vale para las
  tarjetas, los episodios, la barra del reproductor, la barra fina de los controles
  ocultos y la del HUD de volumen/brillo.
- El reproductor tiene dos props: `accentGradient` (las barras) y `accent`, que se queda
  para **lo que no puede llevar degradado** —iconos activos, badge de directo y el tirador
  de la barra—. La app le pasa `#972B99`, el color en el que **acaba** el degradado, así
  que el tirador empalma siempre con el final de la barra. La librería sigue trayendo
  `#ff0000` por defecto para quien la use fuera de esta app.
- Los **botones principales** (el play del destacado, el de la serie y el de la ficha)
  llevan el mismo degradado de fondo, con `GradientFill`: el PNG estirado dentro de un
  `Pressable` con `overflow: 'hidden'`. Antes eran blancos o gris.
- Las **marcas de pestaña** (Episodios / Títulos similares de la serie) llevan el
  degradado, no un color plano.
- En la **barra de abajo**, el icono de la pestaña elegida lleva el degradado **dentro del
  SVG** (`GRADIENT` como `color`, ver `components/icons.tsx`). La etiqueta es texto y un
  texto no admite degradado sin máscara: se queda con `#574CD8`, el color en el que el
  degradado empieza.
- El **rojo se queda** donde significa «en directo» (el punto y el badge EN VIVO) y en el
  corazón de favoritos: ahí no indica progreso, indica estado.

### Catálogo real: Internet Archive

Las películas de la app son **de verdad**: al abrirla se piden al [Internet
Archive](https://archive.org) (`api/archive.ts`), que es la API de cine gratuita que mejor
encaja aquí porque **no pide clave** y, además de la ficha (título, año, sinopsis,
carátula), da el **vídeo**: son obras de dominio público. TMDb u OMDb darían metadatos más
ricos, pero exigen registrarse y no sirven ni un fotograma.

Dos llamadas, cada una en su momento:

| Cuándo | Qué | Para qué |
|---|---|---|
| Al arrancar la app | `advancedsearch.php` (una petición) | La lista: identificador, título, año y sinopsis. **60 por página**, y «Cargar más» en la rejilla de Películas trae la siguiente |
| Al abrir un título | `metadata/<id>` | El MP4 concreto de ese item |

El vídeo **no** se pide con la lista: la lista de ficheros de un item pesa, y traer veinte
al arrancar sería tirar red y batería. Por eso una película del archivo nace con
`source.uri` vacío y `archiveId` puesto; `ensureStream(index)` lo resuelve al abrirla,
mientras el reproductor ya enseña su spinner.

Detalles que importan:

- **El catálogo es una lista viva.** Lo nuevo se añade al final, así que los índices que
  usa el reproductor siguen valiendo. Quien pinte algo del catálogo se suscribe con
  `useCatalog()` (mismo patrón que el idioma).
- **Sin red no pasa nada**: se queda el catálogo de ejemplo de siempre y en Inicio sale el
  error con un botón de reintentar.
- **Las carátulas son fotos de verdad** (`archive.org/services/img/<id>`), con un velo
  degradado debajo para que el título se lea. Lo que no viene del archivo se sigue
  dibujando con su degradado.
- La búsqueda va a cuatro colecciones acotadas (`animationandcartoons`, `silent_films`,
  `short_films` y `SciFi_Horror`): `feature_films` entera trae material para adultos entre
  lo más descargado. Aun así hay un **filtro por palabras** en el título, porque el archivo
  tiene cosas de dominio público perfectamente legales (películas de instrucción policial,
  cine de explotación) que no pintan nada en una rejilla de «Películas». Es un filtro
  basto y se come algún falso positivo; prefiero eso a lo contrario.

### Ficha y géneros: TMDb

El archivo pone el vídeo; **TMDb** (`api/tmdb.ts`) pone todo lo demás: cartel oficial,
fondo, sinopsis **en el idioma de la app**, géneros ya traducidos, duración, nota,
dirección y reparto. TMDb no sirve vídeo, así que no sustituye al archivo: lo viste.

Dos usos distintos:

- **Ficha**: al abrir una película se piden sus datos y se pintan en `DetailScreen`
  (`TMDb 5.9 · 1954 · 7 min`, géneros, sinopsis, dirección y reparto). Si TMDb tiene
  **tráiler**, sale el botón «Ver tráiler», que **abre YouTube** (`Linking`): el tráiler es
  suyo y no pasa por nuestro reproductor. Incrustarlo en un `WebView` se probó y su
  reproductor contesta «error 152» donde no hay servicios de Google (el emulador, sin ir
  más lejos), así que no es de fiar.
- **Filas por género en Inicio**: tras cargar el catálogo, `enrichCatalog()` pregunta por
  cada película **de cuatro en cuatro y en segundo plano**, le cambia el cartel por el
  oficial, le guarda el fondo apaisado y los géneros. En el carrusel y en la tarjeta de la
  ficha manda el **fondo apaisado**, no el cartel vertical: un cartel 2:3 recortado a lo
  ancho queda fatal. Inicio agrupa por género y saca las cuatro filas más
  llenas (solo con dos o más títulos: una fila de un elemento no es una fila).

Lo delicado es **emparejar** un item del archivo con una película de TMDb. Se busca por
título y año, y la coincidencia solo se da por buena si el título **normalizado** (sin
acentos, sin puntuación y sin lo que el archivo mete entre paréntesis) es el mismo; con
año, un único resultado también vale. Sin ese filtro acabas poniéndole a un corto el
cartel de otra película. Lo que no casa se queda con lo del archivo, que también es real.

Las respuestas se guardan un mes en el dispositivo, **los fallos también**, así que en el
segundo arranque esto no toca la red. La clave de caché lleva número de versión
(`tmdb:2:…`): al añadir un campo nuevo se sube y lo viejo se ignora solo.

La clave vive en `api/keys.ts`. **Una clave dentro de la app se puede sacar del binario**,
así que ahí solo va lo que sea gratuito y de uso personal; para algo serio, la clave se
queda en un servidor propio y la app le pregunta a él. Con `TMDB_KEY` vacía la app
funciona igual, solo que sin fichas ni filas por género.

Los términos de TMDb **exigen atribución**: está en la pestaña Perfil, junto a la del
Internet Archive.

El miniplayer estilo YouTube exige que **la instancia de `<Video>` no se desmonte** al
cambiar de pantalla: en React Native no se puede reparentar una vista nativa, así que si
el reproductor viviera dentro de la pantalla de detalle, volver a la lista liberaría
ExoPlayer/AVPlayer y la reproducción se reiniciaría.

Por eso el vídeo vive en `PlayerHost`, en la raíz y en posición absoluta, y lo único que
se anima es su geometría entre dos cajas:

| | Expandido | Miniplayer |
|---|---|---|
| Geometría | El hueco que reserva `DetailScreen` (lo mide y lo publica en el contexto) | Barra de 72 px justo encima de la barra de pestañas |
| Minimizar | ⌄ a la izquierda del título (prop `onMinimize` de `VideoPlayer`), el botón "Minimizar" o Atrás | — |
| Controles | Los de siempre (`VideoPlayer`) | `compact`: sin overlay; la barra pone título, ⏯ y ✕ |
| Volver | — | Tocar el título expande; ✕ cierra y libera el reproductor |

El cambio entre los dos estados es **inmediato**: se pulsa el botón y la caja se
redibuja ya en la barra de abajo, sin animación de colapso ni gesto de arrastre (la
versión animada, con arrastre, está en el historial de git hasta `0c54660`).

Con el **teclado abierto** (buscar) el miniplayer se sube justo encima de él
(`components/useKeyboard.ts`): tapado por el teclado parecía que el vídeo se había
cerrado. La cuenta es el **solape** con la ventana, no el alto del teclado, porque en
Android la ventana ya se encoge sola (`adjustResize`) y ahí no hay nada que subir.

Cambiar de pestaña con un vídeo empotrado lo deja en miniplayer, que se queda visible
sobre todas las pestañas. Volver a su pestaña **no lo vuelve a abrir**: aquí todo se
abre en horizontal, así que «expandir» es ponerlo a pantalla completa, y quien acaba de
mandarlo al miniplayer está navegando, no pidiendo vídeo. Se sale del mini tocándolo.

En esta app todo (películas, episodios y canales) se abre en horizontal, así que el
miniplayer se alcanza desde ahí: el botón **⌄** del reproductor manda el vídeo al
miniplayer y devuelve la pantalla a vertical, y tocar el miniplayer (su carátula o su
título) vuelve a abrirlo en horizontal por donde iba. La ✕ lo cierra.

Lo que hay que cuidar de ese viaje:

- **La orientación la manda `compact`, no solo `fullscreen`**: en miniplayer se vuelve a
  bloquear en vertical aunque el modo siga siendo inmersivo, porque la app de detrás está
  en portrait. Si no, el móvil se queda tumbado enseñando una pantalla vertical.
- Mientras está en miniplayer, el reproductor **no registra el back**: ese gesto es de la
  pantalla que hay debajo.
- `PlayerHost` deja de acotar el vídeo (`absoluteFill`) solo cuando **no** está en mini;
  si no, el miniplayer taparía la app entera.
- El toque para expandir va en una zona **encima** del vídeo: la vista nativa se queda los
  toques y un `Pressable` envolviéndola no se entera.

### Catálogo de pruebas (TMDb)

Para ver la app llena —filas por género de verdad, rejillas largas, carátulas buenas—
hay un botón en **Perfil → Catálogo de pruebas** que trae 100 fichas de TMDb cada vez
(`discover` por popularidad, hasta 10.000 títulos). Se añaden al catálogo como cualquier
otra película, así que las filas por género, «Ver todo», buscar y favoritos funcionan
sin tocar nada más.

Tiene una trampa que conviene no olvidar: **TMDb no sirve vídeo**. Cada ficha traída así
lleva un vídeo de muestra en rotación (Big Buck Bunny, Sintel, BipBop…), de modo que la
ficha es real y la película no. Por eso está en Diagnóstico y no se carga sola: es para
probar, no para publicar.

### Noticias (TV en vivo)

`LiveScreen` tiene la forma de una app de noticias: cabecera con buscador, carrusel de
«Última hora» con sus puntos, lista de recomendadas y, al final, los canales en directo
(«Ver todo» abre su rejilla en `CategoryScreen`). El buscador filtra por titular, sección
o medio sin salir de la pantalla.

Las noticias son **de prueba y están inventadas** (`news.ts`): ni los medios ni los
firmantes existen y el texto habla de la propia app, para que nadie las confunda con
noticias reales. Cada una lleva sección, titular, entradilla, cuerpo por párrafos y fecha
(de ahí sale el «hace 6 h», ver `timeAgo` en `components/format.ts`); si apunta a un canal
del catálogo, su ficha saca el botón de verlo en directo.

Tocar una noticia abre `screens/NewsScreen.tsx`: foto a toda pantalla con los botones de
volver, guardar y compartir flotando en botones redondos opacos, etiqueta, titular y, por encima de la
foto, la hoja con el medio y el texto. Una noticia puede traer **varias fotos**
(`images`): entonces la de arriba pasa a ser un carrusel con sus puntos y el pie de la que
se está viendo; con una sola (o ninguna), se dibuja como siempre. Guardar usa la misma «Mi lista» que las películas
(apuntada como `news:<id>`), y desde Favoritos se vuelve a la noticia.

La app es **siempre oscura**; esta pestaña no es una excepción.

⏮/⏭ cambian de canal dentro del reproductor, y eso **no** lo recrea: solo cambia la
fuente (ver [Rendimiento](#rendimiento)).

Detalles que costaron una pasada de pruebas:

- El hueco se mide con `measureLayout` **contra la vista raíz**, no con `measureInWindow`:
  en Android sus coordenadas no incluyen la barra de estado y el vídeo salía desplazado.
- Hay que volver a medir cuando cambian los insets o el tamaño de ventana (en iOS los
  insets llegan después del primer render y el `onLayout` del hueco no vuelve a dispararse).
- En pantalla completa y en PiP el host deja de acotar (pasa a `absoluteFill`), porque
  ahí el reproductor se coloca él mismo.
- `paused` se levanta al contexto (props `paused`/`onPausedChange` de `VideoPlayer`) para
  que el ⏯ de la barra y el del reproductor grande sean el mismo estado.

No hay `react-navigation`: las pantallas se intercambian con estado. Si se añade, el host
se queda igual, fuera del navigator.

## Idiomas

`i18n/index.ts` tiene los textos en español e inglés y se puede cambiar en caliente:

```tsx
setLanguage('en');          // 'es' | 'en' | 'auto' (el del dispositivo)
useLanguage();              // suscribe al componente: se repinta al cambiar
t('screen.play');           // texto ya traducido, con {parámetros}
```

- El selector está en **Perfil**, y la elección se guarda (`loadLanguage`/`saveLanguage`
  en `player/storage.ts`); mientras no se toque, manda el idioma del dispositivo.
- `Main` llama a `useLanguage()`: como toda la app cuelga de ahí, un cambio repinta
  todas las pantallas.
- **No se puede llamar a `t()` al cargar un módulo.** Ese texto se congelaría en el
  idioma de arranque; por eso las tablas de etiquetas (la barra de pestañas, por ejemplo)
  guardan la **clave** (`TextKey`) y traducen al pintar.
- Para añadir un idioma basta con otro diccionario con las mismas claves: el tipo
  `TextKey` sale de `es`, así que al que le falte una clave no compila.

## Animaciones Lottie

Las animaciones Lottie (`.json` de Bodymovin y `.lottie`) se pintan con
[`lottie-react-native`](https://github.com/lottie-react-native/lottie-react-native).
Es un módulo nativo: al traerlo hay que reconstruir la app (`yarn android`) y, en iOS,
`pod install` antes de compilar. En Jest está mockeado en `jest.setup.js`.

Todo pasa por `components/Lottie.tsx`, que es una capa fina sobre la librería:

```tsx
import Lottie, {LOADER} from './components/Lottie';

<Lottie source={LOADER} size={64} />                    // la que trae la app
<Lottie source={require('./assets/lottie/ok.json')} size={120} loop={false} onFinish={…} />
<Lottie source={{uri: 'https://…/animacion.lottie'}} size={80} />   // remota
```

Qué añade el envoltorio, para que sea igual en toda la app:

- **Un solo tamaño.** Los Lottie son cuadrados casi siempre; `size` es el lado.
- **Es adorno.** El envoltorio se esconde del lector de pantalla: lo que significa la
  animación lo dice quien la coloca, no ella.
- **Respeta «reducir movimiento».** Si el sistema lo tiene activado, la animación no da
  vueltas: se queda en un fotograma con forma (`progress`). Se escucha el cambio en
  caliente, así que no hace falta reiniciar la app.

La animación de carga (`assets/lottie/loader.json`) está hecha a mano —un aro con
*trim path* girando— para no arrastrar material de terceros. Para añadir otra, basta con
dejar el `.json` o el `.lottie` en `assets/lottie/` e importarlo.

El reproductor no depende de Lottie: tiene una prop `loadingIndicator` que sustituye el
spinner del sistema mientras hace buffering, y es `PlayerHost` quien le pasa la animación
(en el miniplayer no, que no cabe).

## Rendimiento

Medido en el emulador con build de **debug** (en release y en dispositivo real mejora;
el vídeo va por `SurfaceView`, así que sus fotogramas no pasan por el toolkit de UI):

| | Antes | Ahora |
|---|---|---|
| Renders de JS reproduciendo, controles ocultos | 4,3/s | 1,2/s |
| Frames de UI en 20 s, controles ocultos | 68 | 24 |
| CPU del proceso | 11-12 % | 8 % |
| Native heap al mostrar la vista previa | 11,5 MB | 7,8 MB |

Lo que lo consigue:

- `progressUpdateInterval` pasa a 1 s cuando los controles están ocultos (ahí no hay nada
  que mover, salvo la barra fina si se ha pedido) y vuelve a 250 ms al mostrarlos o
  arrastrar. Cada aviso de progreso re-renderiza el overlay entero, así que la cadencia
  manda.
- `subtitleStyle` memoizado: sin eso, cada render mandaba una prop nueva a la vista nativa.
- Miniaturas de 120 px y sprite dibujado a tamaño natural con `transform: scale`.

### El catálogo, cuando crece

Con catorce títulos de ejemplo daba igual cómo se pintara. Con el catálogo del archivo
(60 por página, carátulas de verdad) la app se notaba lenta, y estas son las medidas de
`dumpsys gfxinfo` haciendo el mismo barrido de doce gestos en el emulador:

| | Antes | Ahora |
|---|---|---|
| Inicio, mediana por fotograma | 113 ms | **36 ms** |
| Inicio, percentil 90 | 350 ms | **65 ms** |
| Rejilla de Películas, mediana | 150 ms | **36 ms** |
| Rejilla, fotogramas con tirón | 92 % | **44 %** |
| Inicio con **todo** el catálogo (10 géneros, 57 destacados) | — | **42 ms** / p90 77 ms |
| Carrusel, pasando páginas | — | **40 ms** / p90 61 ms |

Qué lo causaba, y qué se hizo:

- **Dos SVG por carátula.** `Poster` dibujaba el degradado *y* el velo con
  `react-native-svg`, incluso teniendo foto. Con foto ya no se dibuja el degradado (la foto
  lo tapa) y el velo es un **PNG de 1×128 px en base64** (`components/scrim.ts`, 250 bytes)
  estirado al tamaño de la tarjeta: lo interpola la GPU, así que el degradado sale limpio y
  cuesta una vista. Con tres `View` de opacidad creciente —lo primero que probé— se veían
  los escalones.
- **La rejilla montaba todas las tarjetas.** `CategoryScreen` pasa de `ScrollView` a
  `FlatList` de dos columnas con ventana (`getItemLayout`, `windowSize`,
  `removeClippedSubviews`), y `Poster` va envuelto en `React.memo`.
- **Imágenes a tamaño completo.** Los carteles de TMDb se piden en `w342` (las carátulas
  miden ~160 dp) y el `Image` lleva `resizeMethod="resize"`, que en Android reescala al
  decodificar en vez de meter el bitmap entero en memoria.
- **Listas recalculadas en cada render.** `movies()`, `allSeries()` y `liveChannels()`
  recorren el catálogo entero; ahora se calculan una vez por revisión y se guardan.
- **Inicio tampoco se monta entero.** Era un `ScrollView` con todas las filas y todas sus
  tarjetas dentro; ahora el cuerpo es una `FlatList` de **filas como datos**, cada fila es
  otra `FlatList` horizontal y el carrusel es una tercera con `pagingEnabled`. Como solo
  se monta lo que se ve, Inicio puede enseñar **todo el catálogo**: la fila de Películas
  con todas, una fila **por cada género** que TMDb reconozca (con dos títulos o más) y el
  carrusel con todos los destacados que tengan imagen. Con más de ocho, los puntos del
  carrusel se cambian por un contador (`15 / 57`): cuarenta puntos no dicen nada.

Un aviso para medir: en **debug** estas cifras son entre tres y cuatro veces peores
(`50th` de 150 ms frente a 36 ms en release) porque el bundle va sin optimizar. Si algo se
siente lento, compruébalo con `npx react-native run-android --mode release` antes de
tocar nada.

### Cambiar de vídeo o de canal sin recrear el reproductor

`PlayerHost` ya no le pone `key={index}` a `VideoPlayer`: cambiar de vídeo o de canal
solo cambia la prop `source`, así que ni ExoPlayer/AVPlayer ni la vista nativa se
recrean (`ExoPlayerImpl: Init`/`Release` = 0 al cambiar). A cambio, el componente ya no
se desmonta y hay que limpiar a mano lo que era del medio anterior —tiempo, duración,
pistas, subtítulos, calidad, error y reintentos—: lo hace un efecto sobre la URL de la
fuente, en `VideoPlayer`.

Lo que se nota: antes, un segundo después de tocar otro canal la superficie estaba
**negra** con el spinner; ahora se queda el último fotograma del canal anterior hasta
que llega el nuevo. El tiempo total hasta que suena el canal nuevo lo manda la red
(0,4-2 s según el canal en el emulador), no el reproductor.

Sigue habiendo un remontaje deliberado: el de los reintentos tras un error fatal
(`playerKey`), porque ahí sí hace falta reinicializar el reproductor.

Dos cosas que conviene no confundir al medir:

- Al soltar la barra, el native heap sube ~13 MB **por el seek** (ExoPlayer rellena
  buffers), no por la miniatura. Para medir la vista previa hay que mirar con el dedo
  aún puesto.
- `gfxinfo` marca como *janky* el 50 % de los frames, pero con 1-4 fps de UI son frames
  aislados que pasan de 16 ms al despertar; el dato útil es el p95 (17-32 ms).

## Controles estilo YouTube

> Referencia completa del componente (props, `features`, `accent`, gestos, capítulos,
> seguir viendo, telemetría, accesibilidad, idiomas, storyboard, PiP, cast, errores y
> recetas) en **[`docs/index.html`](docs/index.html)** — `open docs/index.html`.

La app guarda la posición de cada vídeo y las preferencias (idioma de subtítulos y de
audio, calidad, velocidad y ahorro de datos) en AsyncStorage (`player/storage.ts`), y
recoge métricas de QoE por sesión (`player/telemetry.ts`) que se ven en la pestaña
**Perfil**. Los textos de la app salen de `i18n/`; los de los controles los trae la
librería (español e inglés), y aquí solo se le dice en qué idioma va la app
(`setControlsLanguage`, en `App.tsx`).

**Los controles ya no son de esta app**: viven en la librería y se importan de
`react-native-video/controls` (`../video_player/src/controls/`). Aquí solo queda quien
los coloca y les da de comer, `components/PlayerHost.tsx`. Lo que sigue describe cómo se
comportan; el código está allí.

`VideoPlayer` envuelve `<Video controls={false}>` con un overlay propio. Los iconos son
SVG (`src/controls/icons.tsx`, con `react-native-svg`) sobre la geometría de Material
Symbols: un viewBox 24×24 común, color y tamaño por prop:

| Gesto / control | Comportamiento |
|---|---|
| ⌄ (arriba izquierda, junto al título) | Manda el vídeo al miniplayer (solo si el contenedor pasa `onMinimize`) |
| Tap en el vídeo | Muestra/oculta los controles (se ocultan solos a los 3 s) |
| Doble tap izquierda/derecha | −10 s / +10 s; taps seguidos acumulan (20 s, 30 s…) |
| Mantener pulsado el vídeo | x2 mientras no sueltes (ver [Acelerar manteniendo pulsado](#acelerar-manteniendo-pulsado-x2)) |
| Deslizar arriba/abajo | Volumen (mitad derecha) y brillo (mitad izquierda), con aviso en pantalla |
| Pellizcar | Ajustar (contain) o rellenar (cover) |
| «Saltar intro» | En los tramos marcados como saltables de `chapters` |
| Tarjeta «a continuación» | Últimos 10 s de un VOD con siguiente: cuenta atrás, reproducir ya o cancelar |
| Botones centrales | ⏮ · ⟲10 · Play/Pause/Replay · ⟳10 · ⏭ (⏮/⏭ cuando hay lista, también en directo; en VOD ⏮ reinicia si llevas > 3 s, como YouTube) |
| Fin del vídeo | Autoplay del siguiente de la lista (`autoplayNext`, por defecto `true`); sin siguiente, icono de Replay |
| Barra roja inferior | Arrastrable (scrubbing) con buffer en gris; mini barra cuando los controles están ocultos |
| Arrastrar la barra | Vista previa con miniatura y tiempo (ver [Vista previa](#vista-previa-en-la-barra-storyboard)); el resto de controles se aparta |
| ⚙ (arriba derecha) | Menú: **Audio** (pistas del stream), **Calidad** (Auto + alturas disponibles, p. ej. 1080p/720p/480p, vía `onVideoTracks` + `selectedVideoTrack`; en iOS 15+ es un tope de resolución), **Ahorro de datos**, **Subtítulos** y **Velocidad** 0.5x – 2x |
| CC (arriba derecha) | Enciende/apaga los subtítulos; solo aparece si el vídeo trae pistas. Azul = activos |
| ⛶ (abajo derecha) | Pantalla completa: rota a horizontal, botón atrás sale |
| 🔒 (abajo derecha, solo inmersivo) | Bloquea la pantalla: se van controles y gestos hasta desbloquear (ver [Series: modo inmersivo](#series-modo-inmersivo-como-netflix)) |
| ☰ (abajo derecha, con `episodes`) | Hoja de episodios: cambia de episodio sin salir del reproductor |
| Spinner | Mientras hace buffering |
| ▭ (arriba derecha, junto a ⚙) | Picture in Picture manual; también entra solo al salir de la app (`enterPictureInPictureOnLeave`). Solo aparece donde el dispositivo lo soporta |
| Botón de cast / AirPlay (arriba derecha) | Envía el vídeo a un Chromecast o a AirPlay (ver [Chromecast y AirPlay](#chromecast-y-airplay)) |

Cualquiera de estos controles se puede quitar, y su color cambiarse, desde fuera: ver [Qué controles se ofrecen y de qué color](#qué-controles-se-ofrecen-y-de-qué-color-props).

### Qué controles se ofrecen y de qué color (props)

Todo el overlay se puede recortar desde fuera, sin tocar `VideoPlayer.tsx`: dos
props, `features` y `accent`.

```tsx
<VideoPlayer
  source={source}
  // Todo lo que no se nombra sigue activo.
  features={{skipButtons: false, trackButtons: false, holdToSpeed: false}}
  // Barra de progreso y estados activos, del mismo color.
  accent="#3ea6ff"
/>
```

| `features` | Qué quita |
|---|---|
| `skipButtons` | Los botones ⟲10 / ⟳10 de la fila central |
| `doubleTapSkip` | El doble tap en los lados; el tap pasa a actuar al instante |
| `trackButtons` | Los botones ⏮ / ⏭ (que además necesitan `onNext`/`onPrevious`) |
| `seekBar` | La barra de progreso arrastrable |
| `seekPreview` | La miniatura al arrastrar (que además necesita `storyboard`) |
| `idleProgressBar` | La barra fina de cuando se ocultan los controles. **Apagada por defecto**: se va con el resto; `features={{idleProgressBar: true}}` la deja, como YouTube |
| `holdToSpeed` | El x2 al mantener pulsado |
| `subtitlesButton` | El botón CC; los subtítulos se siguen eligiendo en ⚙ |
| `settingsButton` | El botón ⚙ y su menú entero |
| `pipButton` | El botón ▭ (que además necesita que el dispositivo soporte PiP) |
| `routeButtons` | Los botones de Chromecast y AirPlay |
| `fullscreenButton` | El botón ⤢ (por defecto solo en `presentation="inline"`) |
| `lockButton` | El candado 🔒 (por defecto solo en `presentation="immersive"`) |
| `skipIntro` | El botón «Saltar intro» de los tramos saltables |
| `nextUpCard` | La tarjeta de «a continuación» del final |
| `verticalGestures` | Deslizar arriba/abajo para volumen y brillo |
| `pinchToFill` | El pellizco para ajustar/rellenar |

Quitar un control quita el control, no la función: sin `skipButtons` el doble tap
sigue saltando ±10 s, y sin `subtitlesButton` las pistas siguen en ⚙. Para
quitar la función hay que apagar las dos cosas.

`loadingIndicator` sustituye el spinner de buffering por lo que se le pase (en esta app,
una animación Lottie; ver [Animaciones Lottie](#animaciones-lottie)). Si no se pasa, sale
el `ActivityIndicator` del sistema: el reproductor no depende de nada para dibujarlo.

`accent` (por defecto `#ff0000`) es **un solo color para todo lo que significa lo
mismo**: la parte reproducida de la barra y su tirador, la barra fina (si se pide), el botón CC
encendido, la opción marcada en ⚙ y el badge EN VIVO cuando vas en directo. Antes
la barra era roja y lo activo azul; ahora salen del mismo sitio, así que para
dejarlo todo azul basta `accent="#3ea6ff"`.

### Ficha de película

`screens/DetailScreen.tsx` tiene la forma de la ficha de Netflix. **No lleva reproductor**:
arriba va la portada y, al darle a reproducir (en la portada o en el botón), la película se
abre en horizontal a pantalla completa, el mismo modo inmersivo que los episodios. Atrás
cierra el vídeo y devuelve a la ficha. Debajo de la portada:

- Título, y una línea de datos con lo que de verdad se sabe del vídeo: lo ya visto en
  verde (`67 % visto`), la etiqueta del catálogo, la duración y HD. No hay año, duración
  ni reparto inventados: la duración sale de lo guardado o del último capítulo.
- Botón grande: «Reproducir», o «Seguir viendo» si hay posición guardada.
- Accesos en icono + etiqueta: **Mi lista**, **Compartir** (`Share` del sistema) y Cerrar.
- Sinopsis plegada a 3 líneas con «Ver completo» (`components/ExpandableText.tsx`), que
  solo aparece si el texto no cabe: para saberlo se mide una copia invisible sin recortar,
  porque con `numberOfLines` puesto `onTextLayout` ya devuelve las líneas recortadas. Lo
  mismo en la ficha de serie y en la sinopsis de cada episodio.
- Carrusel de capítulos (marcando los saltables) y «Más películas».

**Mi lista** se guarda en AsyncStorage por `uri` (`loadFavourites` / `toggleFavourite` en
`player/storage.ts`; el índice del catálogo no vale, cambia al tocar `sources.ts`) y es lo
que lista la pestaña **Favoritos** (`screens/FavouritesScreen.tsx`).

### Series: ficha y modo inmersivo (como Netflix)

El catálogo lleva una serie de ejemplo (*Open Movies*, 14 episodios en 3 temporadas; la
primera es larga a propósito, para ver el botón de temporada pegarse a la cabecera). Un
episodio **no** se empotra en una ficha como las películas: se abre ya en horizontal y a
pantalla completa, y atrás cierra y devuelve a la ficha de la serie.

La ficha (`screens/SeriesScreen.tsx`) está montada como la de Netflix:

- Portada a sangre con el título encima y la flecha de volver suelta sobre ella.
- Botón grande que **sabe por dónde ibas**: «Reproducir» en una serie sin empezar y
  «Seguir viendo T1:E2» cuando hay un episodio a medias (el primero empezado y, si no hay
  ninguno, el primero sin terminar).
- Debajo, «Ver desde el principio», que solo sale cuando hay algo que reiniciar. Pasa por
  `player.open(index, {fromStart: true})`, y es lo único que ignora la posición guardada.
- Sinopsis y, debajo, la fila de accesos de Netflix (icono arriba, etiqueta debajo):
  **Mi lista** y **Compartir**. La serie se guarda por el `uri` de su primer episodio,
  que es lo que la pestaña Favoritos sabe resolver.
- Pestañas **Episodios** / **Títulos similares**, con la barra roja sobre la abierta.
- Selector de temporada: **un solo botón** («Temporada 2 ⌄») que abre una hoja inferior
  con la lista, como en Netflix; una fila de chips se desbordaría con ocho temporadas.
  Con una sola temporada no hay botón, solo el título. La serie de ejemplo trae tres.
  Al llegar arriba **se queda pegado bajo la cabecera**: se apaga el del contenido y se
  enciende una copia fija, así que no hay salto ni dos botones a la vez.
- Cabecera que **aparece al bajar**, como la de Inicio: fondo sólido, la flecha de
  volver pierde su burbuja al entrar la cabecera y el **título** aparece cuando el
  grande de la portada ya se ha ido. Todo son opacidades sobre el mismo
  `Animated.Value` del scroll, así que va por el hilo nativo. Es
  `components/ScreenHeader.tsx`, compartida con la **ficha de película**: eran la misma
  cabecera y la película no la tenía. El título de arriba entra **solo cuando el grande
  ya está tapado**, nunca antes: en la película no se puede calcular (el título va
  debajo de la portada, y su alto depende de lo largo que sea), así que se mide con
  `onLayout`. Si la ficha es corta y el título nunca llega a taparse, la cabecera se
  queda sin él, que es lo correcto.
- Lista de episodios con miniatura, botón de play, barra de lo ya visto, **duración**
  (`24 min`, de lo reproducido o del último capítulo) y sinopsis a todo lo ancho.

```tsx
player.open(episode.index, {presentation: 'immersive'});
```

```tsx
<VideoPlayer
  presentation="immersive"   // nace a pantalla completa; atrás llama a onClose
  onClose={player.close}
  episodes={episodes}        // saca el botón ☰ y la hoja de episodios
  currentEpisodeId={index}
  onSelectEpisode={id => player.goTo(Number(id))}
  nextUp={{title: next.title, label: 'Siguiente episodio'}}
/>
```

| | `inline` (YouTube) | `immersive` (Netflix) |
|---|---|---|
| Al abrir | Empotrado en su hueco, en vertical | Ya en horizontal y a pantalla completa |
| Atrás | Sale de pantalla completa | Cierra el reproductor (`onClose`) |
| Botones propios | ⤢ y ⌄ (miniplayer) | ← cerrar, 🔒 candado y ☰ episodios |

El candado deja la pantalla sorda (ni controles ni gestos) y un toque saca la pastilla
de «Desbloquear»; con el candado puesto, atrás solo desbloquea. Quien envuelve al
reproductor tiene que dibujarlo a pantalla completa desde el primer fotograma
(`PlayerHost` usa `absoluteFill` en cuanto la presentación es inmersiva), y al
desmontarse el reproductor vuelve a bloquear el vertical.

También se puede mandar la pantalla completa desde fuera con la prop `fullscreen`
(controlada, como `paused`): si se pasa, el reproductor solo la pide por
`onFullscreenChange`.

### Acelerar manteniendo pulsado (x2)

Como en TikTok: mantén el dedo en cualquier lado del vídeo y va al doble de
velocidad; al soltar vuelve a la de antes. El umbral son 400 ms
(`BOOST_HOLD_MS`), por encima de la ventana de doble tap, para que un tap que se
demora no acelere sin querer; `Pressable` no llama a `onPress` si ya disparó el
pulsado largo, así que el gesto no se pisa con el tap ni con los ±10 s.

Detalles de comportamiento:

- Mientras acelera, los controles se ocultan (estorban justo cuando quieres ver
  pasar el vídeo) y sale un aviso **⏩ 2x** arriba. Al soltar se quedan ocultos,
  como en YouTube: un tap los devuelve.
- Si en ⚙ ya habías elegido algo más rápido, gana tu elección
  (`Math.max(rate, BOOST_RATE)`): acelerar nunca frena.
- No se activa en directo (correríamos hasta el borde del directo para acabar
  atascados), ni transmitiendo a Chromecast (la velocidad la manda el receptor),
  ni con el vídeo en pausa, terminado o en error. Si alguna de esas cosas pasa
  con el dedo todavía abajo, la velocidad vuelve sola a la normal.
- Es solo la prop `rate` del `<Video>`, así que no hay nada nativo nuevo: en
  Android lo aplica ExoPlayer y en iOS AVPlayer, y el audio sigue sonando
  (corregido de tono en ambos).

### Vista previa en la barra (storyboard)

Al arrastrar la barra sale la miniatura del instante, como en YouTube. No se sacan
fotogramas del vídeo al vuelo (lento, y en HLS acaba compitiendo por ancho de banda y
decodificadores): se usa un **storyboard**, una imagen-mosaico con una miniatura cada
5 s más un índice, y solo se recorta.

`src/controls/useStoryboard.ts` (en la librería) admite las dos formas de dar ese índice:

```ts
// 1. Sprite empaquetado con la app (lo que usa sources.ts).
storyboard: {
  image: require('./assets/storyboards/big-buck-bunny.jpg'),
  index: require('./assets/storyboards/big-buck-bunny.json'),
}

// 2. WebVTT de miniaturas, que es lo que sirven los empaquetadores:
//    cada cue apunta a `sprite.jpg#xywh=x,y,w,h`.
storyboard: {vttUri: 'https://cdn.example.com/bbb/storyboard.vtt'}
```

Los sprites se generan con `scripts/storyboard.swift`, que escribe el .jpg, el .json y
el .vtt equivalente:

```sh
swift scripts/storyboard.swift \
  https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8 \
  assets/storyboards/big-buck-bunny 5 120
```

Dos cosas del generador que conviene saber:

- Usa AVFoundation, que **no saca fotogramas de un HLS remoto** («The operation could
  not be completed»). Por eso, ante un `.m3u8`, el script baja la variante más ligera
  a un fichero temporal y trabaja sobre él; para miniaturas de 160 px sobra.
- En Linux/CI el equivalente es ffmpeg, y el índice se escribe a mano:
  `ffmpeg -i entrada.m3u8 -vf "fps=1/5,scale=160:-1,tile=12x11" -frames:v 1 salida.jpg`

El sprite se dibuja a su tamaño natural en píxeles (dividido por `PixelRatio`) y se
amplía con un `transform: scale`: así el bitmap se decodifica al tamaño del fichero y
no al de la vista, que en pantallas densas multiplica la memoria. Con miniaturas de
120 px, tener la vista previa en pantalla cuesta **7,8 MB** de native heap (antes, con
160 px y sin el transform, 11,5 MB).

La vista previa solo aparece en VOD con storyboard: en directo no tiene sentido (habría
que generar los sprites en continuo desde el servidor) y al transmitir manda el receptor.
El polyfill de `URL` de React Native concatena base y ruta sin quitar el nombre de
fichero, así que la URL del sprite se resuelve a mano en `useStoryboard`.

### Calidad y ahorro de datos

Con HLS multi-calidad, quien cambia de calidad es el ABR del reproductor (ExoPlayer
en Android, AVPlayer en iOS): mide el ancho de banda real y sube o baja de variante
solo. Lo que añade la app encima es un **tope por tipo de red**, que es lo que hace
YouTube con los datos móviles:

| Red | Tope (`maxBitRate`) |
|---|---|
| Wi-Fi o cable | sin tope |
| Móvil 4G/5G | 2,5 Mb/s (~720p) |
| Móvil 3G | 0,8 Mb/s (~360p) |
| Móvil 2G | 0,4 Mb/s (~240p) |

`src/controls/useNetworkCap.ts` (en la librería) traduce el estado de NetInfo (`type`,
`cellularGeneration`, `isConnectionExpensive`) a ese tope, y el modo se elige en ⚙ →
**Ahorro de datos**: *Automático* (la tabla), *Siempre activado* (0,8 Mb/s en
cualquier red) o *Desactivado*. El tope **solo se aplica con calidad automática**: si
eliges una resolución a mano, manda tu elección y la fila lo dice («sin efecto:
calidad fija»).

Detalles que conviene tener presentes:

- El tope limita el gasto, no mejora la fluidez: para eso ya está el ABR, que mide el
  rendimiento real en vez de fiarse de la etiqueta «cellular».
- `maxBitRate` se aplica en caliente, sin remontar el reproductor ni cortar el vídeo
  (en iOS es `preferredPeakBitRate`; en Android, `0` significa «sin tope»).
- `reportBandwidth` + `onBandwidthUpdate` dan la estimación de ancho de banda que se
  ve bajo la cabecera del menú de Calidad. **Solo Android**.
- El modo vive en `PlayerContext` para que sobreviva al cambio de vídeo (que remonta
  `VideoPlayer`), pero **no se guarda entre arranques**: eso necesitaría
  `@react-native-async-storage/async-storage`.

### Subtítulos

Las pistas llegan en `onLoad` y en `onTextTracks`, y se eligen con
`selectedTextTrack` (`{type: 'index', value}` o `{type: 'disabled'}`). El menú ⚙ las
lista por título (o idioma), con «Desactivados» arriba; el botón CC es un atajo que
alterna entre apagado y la última pista elegida. En Android los subtítulos se pintan
dentro del vídeo, así que `subtitleStyle` los sube mientras los controles tapan la
parte de abajo; en iOS los coloca el sistema.

En iOS, AVPlayer puede anunciar una pista legible sin título (pasa con el HLS de Mux,
que no lleva subtítulos): por eso la etiqueta cae al idioma o a «Pista N» con `||` y no
con `??`, que dejaba la fila en blanco.

La fuente «Apple BipBop» de `sources.ts` trae ocho pistas (inglés, francés, español y
japonés, cada una normal y forzada) para probarlo. También se pueden pasar pistas
externas (.vtt, y .srt/.ttml solo en Android) en `source.textTracks`, pero en iOS eso
desactiva AirPlay: es una limitación de AVPlayer.

> Esto sacó un fallo de la librería: `getTextTrackInfo()` numera las pistas de forma
> plana y `selectedTextTrack` por índice las buscaba dentro de cada grupo, así que en
> HLS (un grupo por pista) solo funcionaba el índice 0. Arreglado en el fork.

### Directos (live)

Usa los campos `isLive` y `liveOffset` que se añadieron a `onLoad`/`onProgress`
en la librería (`../video_player`):

| Situación | UI |
|---|---|
| Cualquier directo | Sin botones ±10 s ni doble tap; ⏮/⏭ sí (lista con varios canales) |
| En directo (`liveOffset` ≤ 5 s) | Badge rojo **● EN VIVO**, sin tiempos |
| Atrasado | Badge gris + `-m:ss` de retraso; tap en el badge = volver al directo |
| Con ventana DVR (≥ 30 s) | Barra arrastrable sobre la ventana; soltar cerca del final = volver al directo |
| Sin DVR | Sin barra |
| Velocidad | Desactivada (como YouTube) |

`liveOffset` es relativo a la posición live del reproductor (ExoPlayer/AVPlayer
se mantienen unos segundos por detrás del borde real), así que 0 = "en directo"
y volver al directo es `seek(currentTime + liveOffset)`.

### Picture in Picture

- Android: `android:supportsPictureInPicture="true"` en `MainActivity` (manifest). La
  ventana PiP muestra la Activity completa escalada, por eso mientras `isActive` el
  reproductor oculta el overlay, ocupa toda la pantalla y `App.tsx` deja de renderizar
  el resto (`onPipChange`). Entrar en PiP manda la app a segundo plano (sistema).
  Play/pause nativo en la ventanita lo pone la librería (`RemoteAction`).
- iOS: `UIBackgroundModes: audio` en `Info.plist` (+ la capability *Background Modes*
  si firmas para dispositivo). `onRestoreUserInterfaceForPictureInPictureStop` responde
  con `restoreUserInterfaceForPictureInPictureStopCompleted(true)` porque el reproductor
  sigue montado. **No funciona en el simulador de iPhone** (`isPictureInPictureSupported`
  = NO); pruébalo en un dispositivo real.
- El botón ▭ solo se dibuja donde hay soporte: al montar, el reproductor pregunta a la
  librería con `isPictureInPictureSupported()` (iOS: `AVPictureInPictureController`;
  Android: API 26+ y la característica `android.software.picture_in_picture`). Sin
  soporte, entrar en PiP no falla —no hace nada—, así que un botón muerto solo
  confunde; por lo mismo, `enterPictureInPictureOnLeave` también se desactiva.

### Al abrir a pantalla completa

Entrar en un vídeo son dos cosas que tardan un poco y no llegan juntas: el **giro** a
horizontal (la caja cambia de tamaño y los márgenes del notch pasan a ser otros) y el
**`onLoad`** (duración, pistas de audio y de subtítulos). Pintar los controles antes de
las dos se veía raro y encima no servía de nada: salían descolocados, con `0:00 / 0:00`,
y ni el ⚙ ni la barra ni los ±10 hacían nada hasta que llegaba la información.

Ahora:

- Los controles no se pintan hasta que la caja **está donde va a quedarse** (en pantalla
  completa, hasta que es más ancha que alta), **con un plazo de 800 ms**. El giro puede no
  llegar nunca —el móvil con el giro bloqueado, o una app sin
  `react-native-orientation-locker`, que es opcional—, y sin plazo ahí no habría controles
  jamás.
- Los **mandos, la barra inferior y el ⚙** esperan al primer `onLoad`. Mientras tanto se
  ve el indicador de carga, que es lo que de verdad está pasando.
- La **barra de arriba** —atrás, minimizar, título, enviar a una tele, PiP— está desde el
  primer momento, y **no se auto-oculta mientras no haya cargado nada**: esconderla sobre
  un vídeo que aún no ha arrancado dejaba una ruleta sobre negro sin ninguna salida a la
  vista. En pantalla completa sin `presentation="immersive"` —donde la salida es el ⤢ de
  la barra de abajo, que todavía no está— aparece arriba un ⤢ provisional que se va solo
  al cargar.

Con un **error** no hay encierro posible: el aviso con «Reintentar» se pinta pase lo que
pase y, además, vuelve a sacar los controles (y con ellos el atrás).

### Mientras se resuelve el vídeo

Una película del Internet Archive se abre **antes** de saber su vídeo: el catálogo la
trae con `uri: ''` y hay que preguntar a archive.org por el fichero. Hasta que contesta no
hay reproductor que montar —ni su barra de arriba, ni su atrás—, solo el spinner. Sin
red, eso no termina nunca.

Así que esa espera, que es de la app y no del reproductor, tiene lo suyo
(`components/PlayerHost.tsx`): una **flecha de volver** en la esquina desde el primer
fotograma y, a los **10 segundos**, una línea diciendo que algo va mal.

### Menús en horizontal (iOS)

Los menús que son `Modal` —el ⚙ del reproductor y la hoja de temporadas— llevan
`supportedOrientations={['portrait', 'landscape']}`. No es cosmética: en iOS un `Modal`
**solo admite vertical** si no se dice lo contrario, y abrirlo con el móvil en horizontal
tira la app entera con `UIApplicationInvalidInterfaceOrientation` («Supported
orientations has no common orientation with the application»). El reproductor a pantalla
completa es justo eso: horizontal. En Android no pasa, y la prop no estorba.

### Al salir de la app

Cuando la app se va al fondo —bajar la persiana de notificaciones, el centro de control,
irse al escritorio— el **reproductor nativo se pausa solo**: en Android por
`onHostPause`, en iOS por `applicationWillResignActive`. Eso pasa por debajo, sin avisar
a JS, así que los controles se quedaban enseñando «pausar» encima de un vídeo parado.

El reproductor escucha `AppState` y distingue dos cosas que se parecen pero no lo son
(la regla está en `src/controls/appStatePause.ts`, en la librería, aparte y con sus tests
al lado: `yarn test` allí):

| Qué pasa | `AppState` | Qué hace el reproductor |
|---|---|---|
| Algo **tapa** la app un momento: la persiana de notificaciones o el centro de control (solo iOS) | `inactive` | Se marca pausado y, al quitarlo, **vuelve a reproducir solo** |
| La app **se va al fondo**: al escritorio, a otra app | `background` | Se queda pausado; sigue con un toque en play |

Lo de iOS necesita el viaje de ida y vuelta del prop `paused`: el nativo se pausa en
`applicationWillResignActive` pero **no se reanuda**, porque mira `_isPlaying` cuando ya
vale `false`. Si el prop no cambia, no se entera de que hay que seguir.

Nada de esto se aplica en **PiP**, enviando a una **tele**, ni con `playInBackground` o
`playWhenInactive`: ahí el vídeo sigue a propósito.

### Controles en la notificación y en la pantalla de bloqueo

`showNotificationControls` publica play/pausa y ±10 s fuera de la app: en Android como
notificación de un `MediaSessionService` (y con ello Assistant, auriculares y coche); en
iOS en la pantalla de bloqueo y el centro de control. Salen de `source.metadata`.

Qué hace falta para que sirvan de algo:

| | Qué se hizo |
|---|---|
| **Carátula** | `metadata.imageUri`: la del propio archive.org al cargar el catálogo y, en cuanto TMDb contesta, el cartel oficial (`enrichCatalog`). Sin esto la notificación sale con un hueco gris |
| **Qué sigue sonando** | Un **directo** lleva `playInBackground` y `playWhenInactive`: se oye con la app al fondo, como una radio, que es lo que hace útil la notificación. Una **película** no: se pausa y se sigue luego por donde iba |
| **Android 13+** | `POST_NOTIFICATIONS` en el manifiesto **y** pedido en tiempo de ejecución. Sin él la notificación no se ve y el sistema no avisa; se pregunta al abrir el primer vídeo, no al arrancar |
| **Android 14+** | `FOREGROUND_SERVICE_MEDIA_PLAYBACK` y el `<service>` de la librería, ya declarados |
| **iOS** | `UIBackgroundModes: audio` en el `Info.plist`; la sesión de audio (`.playback`) la pone la librería |
| **Enviando a una tele** | Se apagan (`showNotificationControls={notificationControls && !casting}`): ahí manda la notificación de Chromecast |

En el **simulador de iOS no se ven**: hace falta un dispositivo de verdad.

### Chromecast y AirPlay

| | Chromecast | AirPlay |
|---|---|---|
| Plataforma | Android e iOS | Solo iOS |
| Botón | `<CastButton>` de `react-native-google-cast` (se oculta solo si no hay dispositivos) | `<AirPlayButton>` de la librería (`../video_player`), envuelve `AVRoutePickerView` |
| Quién reproduce | El receptor: la app pausa el vídeo local y manda la URL | AVPlayer enruta el vídeo él mismo (`allowsExternalPlayback`, activado por defecto) |

**Chromecast** (`src/controls/useCast.ts`, en la librería): al conectar un dispositivo se carga en el
receptor el vídeo actual (`loadMedia`) arrancando en la posición local, y el reproductor
local se pausa. Mientras se transmite:

- Los controles siguen en el reproductor (como en Netflix): ⏮ · ⟲10 · play/pause · ⟳10 ·
  ⏭ · **⏹ (detener)**, tiempos y barra del receptor (`useMediaStatus`/`useStreamPosition`),
  y debajo el nombre del dispositivo. Tocarlo abre el **controlador ampliado nativo**
  (`GoogleCast.showExpandedControls()`): carátula, volumen del dispositivo, pistas de
  audio/subtítulos del receptor y desconectar.
- Con los controles ocultos queda la pantalla de transmisión: icono de cast, título y
  "Transmitiendo a *dispositivo*".
- ⏮/⏭ cambian de vídeo en la lista y recargan el receptor.
- Calidad y velocidad quedan desactivadas (las decide el receptor), igual que PiP y
  pantalla completa.
- Al desconectar, la reproducción local se reanuda en la posición donde iba el receptor.

Configuración nativa:

- Android: la Activity `RNGCExpandedControllerActivity` declarada en el manifest (la
  librería no la declara y sin ella el controlador ampliado y la notificación revientan
  con `ActivityNotFoundException`), `castFrameworkVersion` en `android/build.gradle`, la dependencia
  `play-services-cast-framework` en `app/build.gradle` (el módulo del paquete la declara
  como `implementation`, así que `MainActivity` no la vería), las `meta-data` del
  `OPTIONS_PROVIDER_CLASS_NAME` y del `RECEIVER_APPLICATION_ID` en el manifest, y
  `RNGCCastContext.getSharedInstance(this)` en `MainActivity.onCreate` para que el
  descubrimiento arranque con la app.
- iOS: `GCKCastContext.setSharedInstanceWith(...)` en `AppDelegate.swift` y, en
  `Info.plist`, `NSLocalNetworkUsageDescription` + `NSBonjourServices`
  (`_googlecast._tcp` y `_CC1AD845._googlecast._tcp`). iOS 14+ pide permiso de red
  local la primera vez que se toca el botón de cast.

Se usa el **Default Media Receiver** de Google (`CC1AD845`), que reproduce HLS y MP4
sin registrar una app receptora propia; para DRM, subtítulos personalizados o una UI
propia en la tele hace falta registrar un receiver en la Cast Developer Console y
cambiar ese id en los dos sitios.

> Ni el emulador de Android ni el simulador de iOS descubren dispositivos reales
> (la red del emulador está detrás de NAT y no pasa mDNS): el diálogo abre y se queda
> en "Buscando dispositivos". Además, la imagen del emulador no trae el módulo
> `cast.framework.dynamite` de Play Services, así que el controlador ampliado nativo
> allí falla (`ModuleUnavailableException`). Hay que probarlo en un móvil real en la
> misma red que el Chromecast / Apple TV.

**AirPlay**: el botón abre el selector de rutas del sistema (única forma soportada por
iOS de iniciar AirPlay; no hay API para enrutar por código). El vídeo pasa a la tele
solo, sin recargar nada, porque `<Video>` mantiene `allowsExternalPlayback`.

A diferencia de Chromecast **no hay controles remotos aparte**: el vídeo lo sigue
reproduciendo el mismo AVPlayer, así que play/pause, ±10 s, barra, calidad y velocidad
funcionan igual que en local. Lo único que cambia es lo que se ve en el móvil:

- `onExternalPlaybackChange` avisa de que la reproducción se fue a la tele y **con qué
  dispositivo** (el campo `deviceName` se añadió a la librería: AVPlayer no expone la
  ruta, se lee del `AVAudioSession`).
- Controles visibles: el icono de AirPlay se pinta en azul y bajo la barra aparece el
  nombre del dispositivo.
- Controles ocultos: pantalla con el icono de AirPlay, el título y "Reproduciendo en
  *dispositivo*".
- PiP se oculta (no hay vídeo local que meter en la ventanita).

Para volver al móvil se usa el mismo selector de rutas (elegir "iPhone"), como en
cualquier app de Apple.

### Recuperación de errores y red

- `<Video disableDisconnectError>`: en Android activa la política de reintentos de la
  librería; sin la prop, ExoPlayer falla tras 3 intentos. Con ella, los fallos de
  red (DNS, timeout, conexión rechazada) reintentan cada segundo hasta que vuelva
  la conexión, sin error fatal. Solo los errores HTTP del servidor (4xx/5xx) fallan.
- `@react-native-community/netinfo`: banner "Sin conexión · reconectando…" mientras
  no hay red, y reintento inmediato en cuanto vuelve.
- Error fatal (`onError`): overlay con el detalle y botón **Reintentar**; reintento
  automático con backoff 2/4/8/16/30 s remontando `<Video>` y reanudando desde la
  última posición (VOD) o desde el directo (live). Sin red, espera a NetInfo en vez
  de gastar reintentos.
- Con error se siguen dibujando los controles de navegación (⌄, título, Cast/AirPlay y
  ⤢), y además no se auto-ocultan: solo desaparece el transporte (⏯, ±10 s, ⏮/⏭, barra,
  ⚙ y PiP), que no tiene nada que manejar. Antes se ocultaba todo y un error persistente
  en pantalla completa dejaba la app atrapada en iOS, donde no hay botón Atrás.
- La fuente "URL rota" (404) de `sources.ts` sirve para probar este flujo.

Dependencias nativas de la app (no de la librería):

- `react-native-orientation-locker` — rotación en fullscreen. Android registra
  `OrientationActivityLifecycle` en `MainApplication.kt`; iOS tiene el override de
  `supportedInterfaceOrientationsFor` en `AppDelegate.swift`, con `Orientation.h`
  expuesto a Swift vía `VideoApp/VideoApp-Bridging-Header.h`.
- `react-native-safe-area-context` — insets de barras del sistema (Android 15 es
  edge-to-edge) para que los controles no queden bajo la barra de navegación.
- `@react-native-community/netinfo` — estado de la conexión para la recuperación.
- `react-native-google-cast` — Chromecast (el botón y la sesión); AirPlay no necesita
  dependencia extra, el botón lo añade la propia librería `react-native-video`.
- `react-native-svg` — los iconos de los controles.

Las fuentes de prueba están en `sources.ts`: un directo HLS con DVR, un VOD HLS
multi-calidad, una URL rota (404) para probar la recuperación y un MP4 progresivo.
