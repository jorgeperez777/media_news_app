# VideoApp

App React Native (0.78, bare) mínima para probar y desarrollar la librería
`react-native-video` que vive en `../video_player`.

La librería se enlaza como symlink (`"react-native-video": "link:../video_player"`)
y Metro observa ese directorio, así que cualquier cambio en `../video_player/src`
se refleja con un reload; los cambios nativos (Kotlin/Swift) requieren recompilar.

## Requisitos

- Node 22, Ruby 4 y JDK 17 — ver `.tool-versions` (`asdf install` los instala; Yarn 3
  viene vendorizado en `.yarn/releases`).
- **iOS:** Xcode + CocoaPods. La primera vez acepta la licencia: `sudo xcodebuild -license accept`.
  El `Gemfile` fija `json < 3` y añade `nkf` (Ruby 4 de Homebrew rompe CocoaPods sin eso) y el
  `Podfile` compila la pod `fmt` como C++17 (necesario con Xcode 26+ y RN 0.78).
- **Android:** SDK en `/opt/homebrew/share/android-commandlinetools` (ya configurado en `android/local.properties`), JDK 17.

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

## Flujo de trabajo con la librería

| Cambio en `../video_player` | Qué hacer |
|---|---|
| `src/**` (TS/JS) | Reload en la app (`r` en Metro) |
| `android/**` (Kotlin/Java) | `yarn android` de nuevo |
| `ios/**` (Swift/ObjC) | `yarn ios` de nuevo (si añades archivos, `pod install` antes) |

## Controles estilo YouTube

`components/VideoPlayer.tsx` envuelve `<Video controls={false}>` con un overlay
propio (sin fuentes de iconos ni módulos nativos extra para los controles):

| Gesto / control | Comportamiento |
|---|---|
| Tap en el vídeo | Muestra/oculta los controles (se ocultan solos a los 3 s) |
| Doble tap izquierda/derecha | −10 s / +10 s; taps seguidos acumulan (20 s, 30 s…) |
| Botones centrales | ⏮ · ⟲10 · Play/Pause/Replay · ⟳10 · ⏭ (⏮/⏭ cuando hay lista, también en directo; en VOD ⏮ reinicia si llevas > 3 s, como YouTube) |
| Fin del vídeo | Autoplay del siguiente de la lista (`autoplayNext`, por defecto `true`); sin siguiente, icono de Replay |
| Barra roja inferior | Arrastrable (scrubbing) con buffer en gris; mini barra cuando los controles están ocultos |
| ⚙ (arriba derecha) | Menú: **Calidad** (Auto + alturas disponibles, p. ej. 1080p/720p/480p, vía `onVideoTracks` + `selectedVideoTrack`; en iOS 15+ es un tope de resolución) y **Velocidad** 0.5x – 2x |
| ⛶ (abajo derecha) | Pantalla completa: rota a horizontal, botón atrás sale |
| Spinner | Mientras hace buffering |
| ▭ (arriba derecha, junto a ⚙) | Picture in Picture manual; también entra solo al salir de la app (`enterPictureInPictureOnLeave`) |
| Botón de cast / AirPlay (arriba derecha) | Envía el vídeo a un Chromecast o a AirPlay (ver [Chromecast y AirPlay](#chromecast-y-airplay)) |

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

### Chromecast y AirPlay

| | Chromecast | AirPlay |
|---|---|---|
| Plataforma | Android e iOS | Solo iOS |
| Botón | `<CastButton>` de `react-native-google-cast` (se oculta solo si no hay dispositivos) | `<AirPlayButton>` de la librería (`../video_player`), envuelve `AVRoutePickerView` |
| Quién reproduce | El receptor: la app pausa el vídeo local y manda la URL | AVPlayer enruta el vídeo él mismo (`allowsExternalPlayback`, activado por defecto) |

**Chromecast** (`components/useCast.ts`): al conectar un dispositivo se carga en el
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
- La fuente "URL rota" (404) de `App.tsx` sirve para probar este flujo.

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

`App.tsx` alterna entre un stream HLS y un MP4 públicos.
