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
    // Evita que la librería resuelva su propia copia de react / react-native
    // desde ../video_player/node_modules (causaría "Invalid hook call").
    extraNodeModules: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-native': path.resolve(__dirname, 'node_modules/react-native'),
    },
    blockList: [
      new RegExp(`${playerRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react/.*`),
      new RegExp(`${playerRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/node_modules/react-native/.*`),
    ],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
