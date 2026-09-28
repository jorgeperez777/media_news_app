module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Mocks de Jest: se cargan antes de los tests, así que `jest` es global aquí.
      files: ['jest.setup.js', '__tests__/**'],
      env: {jest: true},
    },
  ],
};
