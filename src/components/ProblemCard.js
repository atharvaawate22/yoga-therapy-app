/**
 * ProblemCard Component
 * Card for health problems with premium styling
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

// { family: 'ion' | 'mci', name }
const problemIcons = {
  'Back Pain': { family: 'mci', name: 'human-handsdown' },
  'Hip Alignment Issue': { family: 'ion', name: 'walk-outline' },
  'Scapula Winging': { family: 'mci', name: 'arm-flex-outline' },
  'Headache': { family: 'mci', name: 'head-alert' },
  'Stress': { family: 'mci', name: 'emoticon-neutral-outline' },
  'Anxiety': { family: 'mci', name: 'leaf' },
  'Poor Posture': { family: 'mci', name: 'human-male-height' },
  'Insomnia': { family: 'mci', name: 'sleep' },
  'Knee Pain': { family: 'mci', name: 'shoe-print' },
  'Digestion Issues': { family: 'mci', name: 'stomach' },
  'Weight Loss': { family: 'ion', name: 'flame' },
  'Neck Pain': { family: 'mci', name: 'head-outline' },
  'Shoulder Pain': { family: 'mci', name: 'human-handsup' },
  'Diabetes': { family: 'mci', name: 'diabetes' },
  'PCOS': { family: 'mci', name: 'human-female' },
  'Flexibility': { family: 'mci', name: 'yoga' },
};

const ProblemIcon = ({ problemName, size, color }) => {
  const icon = problemIcons[problemName] || { family: 'mci', name: 'yoga' };
  if (icon.family === 'ion') {
    return <Ionicons name={icon.name} size={size} color={color} />;
  }
  return <MaterialCommunityIcons name={icon.name} size={size} color={color} />;
};

const ProblemCard = ({ problemName, poseCount, onPress }) => {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconContainer}>
        <ProblemIcon problemName={problemName} size={26} color={colors.primary} />
      </View>
      <View style={styles.content}>
        <Text style={styles.problemName}>{problemName}</Text>
        <Text style={styles.poseCount}>
          {poseCount} {poseCount === 1 ? 'pose' : 'poses'} available
        </Text>
      </View>
      <View style={styles.arrowContainer}>
        <Ionicons name="chevron-forward" size={16} color={colors.textWhite} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginVertical: 6,
    marginHorizontal: spacing.md,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  problemName: {
    ...typography.headerSmall,
    color: colors.text,
    marginBottom: 2,
    fontSize: 16,
  },
  poseCount: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  arrowContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProblemCard;
