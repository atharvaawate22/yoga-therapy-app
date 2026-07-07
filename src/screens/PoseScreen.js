/**
 * PoseScreen - Shows recommended poses for a condition
 */
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, screenStyles, borderRadius, shadows } from '../theme/theme';
import PoseCard from '../components/PoseCard';
import proTips from '../data/proTips';

const PoseScreen = ({ route, navigation }) => {
  const { problemName, poses } = route.params;
  const tips = proTips[problemName] || proTips.default;

  const handlePosePress = (pose) => {
    navigation.navigate('PoseDetail', { pose });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.problemBadge}>
            <Text style={styles.problemBadgeText}>{problemName}</Text>
          </View>
          <Text style={styles.title}>Recommended Yoga</Text>
          <Text style={styles.subtitle}>
            {poses.length} {poses.length === 1 ? 'pose' : 'poses'} tailored for {problemName}
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Tap any pose to see step-by-step image instructions and benefits.
          </Text>
        </View>

        {/* Poses List */}
        <View style={styles.posesList}>
          {poses.map((pose, index) => (
            <View key={pose.id || index}>
              <View style={styles.poseNumberRow}>
                <View style={styles.poseNumberBadge}>
                  <Text style={styles.poseNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.poseNumberLabel}>Pose {index + 1}</Text>
              </View>
              <PoseCard pose={pose} onPress={() => handlePosePress(pose)} />
            </View>
          ))}
        </View>

        {/* Condition-specific Pro Tips */}
        <View style={styles.tipCard}>
          <Text style={styles.tipTitle}>🌟 Pro Tips for {problemName}</Text>
          {tips.map((tip, i) => (
            <View key={i} style={styles.tipRow}>
              <Text style={styles.tipBullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* Warning */}
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            ⚕️ These poses are for general wellness. Consult a doctor or certified yoga therapist for medical conditions.
          </Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scrollContent: { paddingBottom: 40 },
  header: {
    alignItems: 'center',
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  problemBadge: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.round,
    marginBottom: spacing.md,
  },
  problemBadgeText: {
    ...typography.bodySmall,
    color: colors.textWhite,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: { ...typography.headerLarge, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.textLight, textAlign: 'center' },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    ...shadows.soft,
  },
  infoIcon: { fontSize: 22, marginRight: spacing.md },
  infoText: { ...typography.bodySmall, color: colors.textLight, flex: 1, lineHeight: 20 },
  posesList: { paddingTop: spacing.sm },
  poseNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  poseNumberBadge: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  poseNumberText: { ...typography.caption, color: colors.textWhite, fontWeight: '800' },
  poseNumberLabel: { ...typography.label, color: colors.primary },
  tipCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.lg,
    ...shadows.card,
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
  },
  tipTitle: {
    ...typography.headerSmall,
    color: colors.primary,
    marginBottom: spacing.md,
    fontSize: 16,
  },
  tipRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  tipBullet: {
    fontSize: 16,
    color: colors.primaryLight,
    marginRight: spacing.sm,
    lineHeight: 22,
    fontWeight: '700',
  },
  tipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  warningCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: '#FFF8E1',
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  warningText: {
    ...typography.bodySmall,
    color: '#795548',
    lineHeight: 20,
  },
});

export default PoseScreen;
