import GoogleCast
import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
// `Orientation` llega vía VideoApp-Bridging-Header.h (react-native-orientation-locker).

@main
class AppDelegate: RCTAppDelegate {
  override func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey : Any]? = nil) -> Bool {
    self.moduleName = "VideoApp"
    self.dependencyProvider = RCTAppDependencyProvider()

    // You can add your custom initial props in the dictionary below.
    // They will be passed down to the ViewController used by React Native.
    self.initialProps = [:]

    setUpGoogleCast()

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  /// Chromecast: iOS no tiene OptionsProvider como Android, así que el contexto se
  /// configura aquí. CC1AD845 es el Default Media Receiver de Google (reproduce HLS/MP4
  /// sin necesidad de registrar una aplicación receptora propia).
  private func setUpGoogleCast() {
    let criteria = GCKDiscoveryCriteria(applicationID: kGCKDefaultMediaReceiverApplicationID)
    let options = GCKCastOptions(discoveryCriteria: criteria)
    // El descubrimiento arranca cuando el usuario toca el botón de cast (iOS 14+ pide
    // entonces el permiso de red local), no al abrir la app.
    options.startDiscoveryAfterFirstTapOnCastButton = true
    options.physicalVolumeButtonsWillControlDeviceVolume = true
    GCKCastContext.setSharedInstanceWith(options)
  }

  // react-native-orientation-locker: permite lockToLandscape/Portrait desde JS.
  override func application(
    _ application: UIApplication,
    supportedInterfaceOrientationsFor window: UIWindow?
  ) -> UIInterfaceOrientationMask {
    Orientation.getOrientation()
  }

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
