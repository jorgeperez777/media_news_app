// Mocks de los módulos nativos que monta <App/>: en Jest no hay puente nativo, así que
// sin esto el render del smoke test falla al cargar el reproductor.
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => jest.fn()),
    fetch: jest.fn(() => Promise.resolve({type: 'wifi', details: {}})),
  },
}));

// AsyncStorage 3 ya no trae mock propio: uno en memoria basta para el render.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(key => Promise.resolve(store.get(key) ?? null)),
      setItem: jest.fn((key, value) => {
        store.set(key, value);
        return Promise.resolve();
      }),
      removeItem: jest.fn(key => {
        store.delete(key);
        return Promise.resolve();
      }),
    },
  };
});

jest.mock('react-native-orientation-locker', () => ({
  __esModule: true,
  default: {
    lockToLandscape: jest.fn(),
    lockToPortrait: jest.fn(),
    unlockAllOrientations: jest.fn(),
  },
}));

jest.mock('react-native-google-cast', () => ({
  __esModule: true,
  default: {},
  CastButton: () => null,
  CastState: {NOT_CONNECTED: 'notConnected'},
  useCastState: () => 'notConnected',
  useRemoteMediaClient: () => null,
  useMediaStatus: () => null,
  useStreamPosition: () => 0,
  useCastSession: () => null,
  useDevices: () => [],
}));

jest.mock('react-native-video', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: React.forwardRef(() => null),
    AirPlayButton: () => null,
    isPictureInPictureSupported: () => Promise.resolve(false),
    SelectedTrackType: {INDEX: 'index', DISABLED: 'disabled'},
    SelectedVideoTrackType: {AUTO: 'auto', RESOLUTION: 'resolution'},
  };
});
