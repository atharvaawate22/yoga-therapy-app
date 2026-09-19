export default ({ config }) => ({
  ...config,
  name: 'Yoga Therapy',
  slug: 'main',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#F1F8E9',
  },
  assetBundlePatterns: ['**/*'],
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
