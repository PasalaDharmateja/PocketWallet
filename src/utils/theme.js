import { Platform } from 'react-native';

export const COLORS = {
  primary: '#4F46E5',
  primaryLight: '#EEF2FF',
  primaryDark: '#3730A3',
  secondary: '#06B6D4',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  white: '#FFFFFF',
  background: '#F1F5FF',
  surface: 'rgba(255,255,255,0.92)',
  border: 'rgba(255,255,255,0.6)',
  text: '#1E293B',
  textSecondary: '#64748B',
  textLight: '#94A3B8',
  shadow: '#1E293B',
};

export const SHADOWS = {
  sm: Platform.select({
    ios:     { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4 },
    android: { elevation: 2 },
  }),
  md: Platform.select({
    ios:     { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12 },
    android: { elevation: 5 },
  }),
  lg: Platform.select({
    ios:     { shadowColor: '#1E293B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.16, shadowRadius: 20 },
    android: { elevation: 10 },
  }),
};

export const FONTS = {
  regular: Platform.select({ ios: 'System', android: 'Roboto' }),
  medium: Platform.select({ ios: 'System', android: 'Roboto-Medium' }),
  bold: Platform.select({ ios: 'System', android: 'Roboto-Bold' }),
};

export const RADIUS = {
  sm: 8, md: 14, lg: 20, xl: 28,
};

export const SPACING = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32,
};
