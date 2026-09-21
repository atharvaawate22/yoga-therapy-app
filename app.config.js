// Single source of Expo configuration for the app.
// (Replaces the former app.json, whose values were all overridden here.)
// A function rather than an object so `config.extra` below is defined.
export default ({ config }) => ({
  ...config,
  name: 'Yoga Therapy',
  slug: 'main',
  version: '1.0.0',
  owner: 'atharvaawates-team',
  extra: {
    ...config.extra,
    eas: {
      projectId: '4d93d50c-4e33-4b46-88a8-7696c40e30d5',
    },
  },
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F1F8E9',
  },
  assetBundlePatterns: ['**/*'],
  // Disabled: the New Architecture's CMake/ninja codegen hits Windows' 260-char
  // path limit for native modules (react-native-safe-area-context, gesture-handler)
  // when built from a deeply nested project path. Re-enable once building from CI
  // or a short path, or once long-path support is confirmed on the build machine.
  newArchEnabled: false,
  ios: {
    supportsTablet: true,
    infoPlist: {
      NSCameraUsageDescription:
        'We use camera access to analyze your yoga pose and provide correction suggestions.',
    },
    bundleIdentifier: 'com.yogatherapy.app',
  },
  android: {
    permissions: ['CAMERA'],
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F1F8E9',
    },
    package: 'com.yogatherapy.app',
  },
  web: {
    bundler: 'metro',
    favicon: './assets/favicon.png',
  },
});
