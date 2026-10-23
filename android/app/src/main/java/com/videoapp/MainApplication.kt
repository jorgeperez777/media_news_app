package com.videoapp

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.common.assets.ReactFontManager
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import org.wonday.orientation.OrientationActivityLifecycle

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // Figtree con sus pesos (res/font/figtree.xml): `fontFamily: 'Figtree'` en
    // JS, y `fontWeight` elige el archivo. En iOS va en el bundle (UIAppFonts).
    ReactFontManager.getInstance().addCustomFont(this, "Figtree", R.font.figtree)
    // react-native-orientation-locker: necesario para lockToLandscape/Portrait.
    registerActivityLifecycleCallbacks(OrientationActivityLifecycle.getInstance())
  }
}
