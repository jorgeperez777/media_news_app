const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

// La librería vive en ../video_player (symlink vía "link:" en package.json).
const playerRoot = path.resolve(__dirname, '../video_player');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Metro debe observar el directorio de la librería para recoger cambios en src/.
  watchFolders: [playerRoot],
  resolver: {
    /**
     * Todo lo que la librería pida se busca **aquí**, no en su propio
     * node_modules. Dos motivos:
     *
     * - react y react-native tienen que ser los de la app; con dos copias sale
     *   «Invalid hook call».
     * - los controles (`react-native-video/controls`) cargan svg, safe-area,
     *   orientación, cast y netinfo como dependencias opcionales, y esas solo
     *   están instaladas en la app.
     */
    extraNodeModules: new Proxy(
      {},
      {
        get: (_target, name) =>
          path.resolve(__dirname, 'node_modules', String(name)),
      },
    ),
    blockList: [
      new RegExp(`${playerRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react/.*`),
      new RegExp(`${playerRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react-native/.*`),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
