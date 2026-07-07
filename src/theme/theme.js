/**
 * Theme Configuration for Yoga Therapy App
 * Premium wellness design system
 */

export const colors = {
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  secondary: '#81C784',
  accent: '#00BFA5',
  accentWarm: '#FF8A65',
  background: '#F5F9F4',
  backgroundDark: '#E8F5E9',
  card: '#FFFFFF',
  cardAlt: '#F1F8E9',
  text: '#1A2E1A',
  textSecondary: '#37474F',
  textLight: '#5F7161',
  textMuted: '#90A4AE',
  textWhite: '#FFFFFF',
  success: '#43A047',
  warning: '#FB8C00',
  error: '#E53935',
  info: '#039BE5',
  shadow: '#1A2E1A',
  border: '#C8E6C9',
  borderLight: '#E8F5E9',
  divider: '#E0E0E0',
  overlay: 'rgba(26, 46, 26, 0.6)',
  gradientStart: '#1B5E20',
  gradientEnd: '#4CAF50',
  beginner: '#66BB6A',
  intermediate: '#FFA726',
  expert: '#EF5350',
  beginnerBg: '#E8F5E9',
  intermediateBg: '#FFF3E0',
  expertBg: '#FFEBEE',
};

export const typography = {
  headerLarge: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1A2E1A',
    letterSpacing: -0.5,
  },
  headerMedium: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1A2E1A',
    letterSpacing: -0.3,
  },
  headerSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A2E1A',
  },
  body: {
    fontSize: 16,
    color: '#37474F',
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    color: '#5F7161',
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: '#90A4AE',
    lineHeight: 16,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: '#90A4AE',
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  round: 999,
};

export const shadows = {
  card: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHover: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  soft: {
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  prominent: {
    shadowColor: '#2E7D32',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const cardStyles = {
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#1A2E1A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
};

export const screenStyles = {
  container: {
    flex: 1,
    backgroundColor: '#F5F9F4',
  },
  content: {
    padding: 16,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 16,
  },
};

const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  cardStyles,
  screenStyles,
};

export default theme;
