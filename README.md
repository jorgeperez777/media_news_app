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

`App.tsx` alterna entre un stream HLS y un MP4 públicos.
