export default ({ config }) => ({
  ...config,
  slug: 'main',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  splash: {
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
      backgroundColor: '#F1F8E9',
    },
    package: 'com.yogatherapy.app',
  },
  web: {
    bundler: 'metro',
  },
});
