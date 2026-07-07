/**
 * ProblemCard Component
 * Card for health problems with premium styling
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, typography, spacing, borderRadius, shadows } from '../theme/theme';

const problemIcons = {
  "Back Pain": "🦴",
  "Hip Alignment Issue": "🏃",
  "Scapula Winging": "💪",
  "Headache": "🧠",
  "Stress": "😌",
  "Anxiety": "🌿",
  "Poor Posture": "🧘",
  "Insomnia": "😴",
  "Knee Pain": "🦵",
  "Digestion Issues": "🫁",
  "Weight Loss": "🔥",
  "Neck Pain": "🦒",
  "Shoulder Pain": "💆",
  "Diabetes": "💉",
  "PCOS": "🩺",
  "Flexibility": "🤸",
};

const ProblemCard = ({ problemName, poseCount, onPress }) => {
  const icon = problemIcons[problemName] || "🧘";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.problemName}>{problemName}</Text>
        <Text style={styles.poseCount}>
          {poseCount} {poseCount === 1 ? 'pose' : 'poses'} available
        </Text>
      </View>
      <View style={styles.arrowContainer}>
        <Text style={styles.arrow}>→</Text>
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
  icon: {
    fontSize: 26,
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
  arrow: {
    fontSize: 16,
    color: colors.textWhite,
    fontWeight: 'bold',
  },
});

export default ProblemCard;
