/**
 * ExperienceBadge - Color-coded badge for difficulty/experience level
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing } from '../theme/theme';

const levelConfig = {
  beginner: { label: 'Beginner', color: colors.beginner, bg: colors.beginnerBg },
  intermediate: { label: 'Intermediate', color: colors.intermediate, bg: colors.intermediateBg },
  expert: { label: 'Expert', color: colors.expert, bg: colors.expertBg },
  advanced: { label: 'Advanced', color: colors.expert, bg: colors.expertBg },
};

const ExperienceBadge = ({ level = 'beginner', small = false }) => {
  const config = levelConfig[level] || levelConfig.beginner;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, small && styles.badgeSmall]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.label, { color: config.color }, small && styles.labelSmall]}>
        {config.label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
    alignSelf: 'flex-start',
  },
  badgeSmall: {
    paddingVertical: 2,
    paddingHorizontal: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  labelSmall: {
    fontSize: 9,
  },
});

export default ExperienceBadge;
