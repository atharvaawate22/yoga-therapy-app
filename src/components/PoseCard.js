/**
 * PoseCard Component
 * Tappable card displaying yoga pose with difficulty badge
 */
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';
import ExperienceBadge from './ExperienceBadge';
import { resolveImageSource } from '../utils/imageUtils';

const PoseCard = ({ pose, onPress }) => {
  const { name, sanskritName, description, duration, image, difficulty } = pose;

  const CardWrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.85 } : {};

  return (
    <CardWrapper style={styles.card} {...wrapperProps}>
      {/* Yoga pose image */}
      <View style={styles.imageContainer}>
        <Image source={resolveImageSource(image)} style={styles.image} resizeMode="cover" />
        <View style={styles.imageOverlay} />
        {difficulty && (
          <View style={styles.badgeContainer}>
            <ExperienceBadge level={difficulty} small />
          </View>
        )}
      </View>

      {/* Card content */}
      <View style={styles.content}>
        <Text style={styles.poseName}>{name}</Text>
        {sanskritName ? <Text style={styles.sanskritName}>{sanskritName}</Text> : null}
        <Text style={styles.description} numberOfLines={2}>{description}</Text>
        <View style={styles.footer}>
          <View style={styles.durationBadge}>
            <Text style={styles.durationIcon}>⏱️</Text>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
          {onPress && (
            <View style={styles.viewBtn}>
              <Text style={styles.viewBtnText}>View Steps →</Text>
            </View>
          )}
        </View>
      </View>
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    marginVertical: spacing.sm,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
    ...shadows.card,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 180,
    backgroundColor: colors.backgroundDark,
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26, 46, 26, 0.08)',
  },
  badgeContainer: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  content: {
    padding: spacing.md,
  },
  poseName: {
    ...typography.headerSmall,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  sanskritName: {
    ...typography.caption,
    color: colors.textLight,
    fontStyle: 'italic',
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textLight,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundDark,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.round,
  },
  durationIcon: {
    fontSize: 12,
    marginRight: spacing.xs,
  },
  durationText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  viewBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  viewBtnText: {
    ...typography.caption,
    color: colors.accent,
    fontWeight: '700',
  },
});

export default PoseCard;
