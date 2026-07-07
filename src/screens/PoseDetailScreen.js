/**
 * PoseDetailScreen - Full pose assistance with image + step-by-step instructions
 */
import React from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import ExperienceBadge from '../components/ExperienceBadge';
import { resolveImageSource } from '../utils/imageUtils';

const PoseDetailScreen = ({ route, navigation }) => {
  const { pose } = route.params;
  const { name, sanskritName, description, duration, difficulty, image, benefits, precautions, steps } = pose;

  const imgSource = resolveImageSource(image);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Hero Image */}
        <View style={styles.heroContainer}>
          <Image source={imgSource} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroContent}>
            <ExperienceBadge level={difficulty || 'beginner'} />
            <Text style={styles.heroTitle}>{name}</Text>
            {sanskritName && <Text style={styles.heroSanskrit}>{sanskritName}</Text>}
          </View>
        </View>

        <View style={styles.body}>
          {/* Duration & Difficulty Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>⏱️</Text>
              <Text style={styles.metaLabel}>Duration</Text>
              <Text style={styles.metaValue}>{duration}</Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Text style={styles.metaIcon}>📊</Text>
              <Text style={styles.metaLabel}>Level</Text>
              <Text style={styles.metaValue}>{(difficulty || 'beginner').charAt(0).toUpperCase() + (difficulty || 'beginner').slice(1)}</Text>
            </View>
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About This Pose</Text>
            <Text style={styles.cardBody}>{description}</Text>
          </View>

          {/* Step-by-Step Instructions */}
          {steps && steps.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🪜 How To Do It</Text>
              {steps.map((step, i) => (
                <View key={i} style={styles.stepRow}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Benefits */}
          {benefits && benefits.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>✨ Benefits</Text>
              {benefits.map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Precautions */}
          {precautions && precautions.length > 0 && (
            <View style={[styles.card, styles.cautionCard]}>
              <Text style={styles.cardTitle}>⚠️ Precautions</Text>
              {precautions.map((p, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{p}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Try Pose Corrector Button */}
          <TouchableOpacity
            style={styles.correctorBtn}
            onPress={() => navigation.navigate('PoseCorrector')}
            activeOpacity={0.85}
          >
            <Text style={styles.correctorBtnEmoji}>📸</Text>
            <View style={styles.correctorBtnContent}>
              <Text style={styles.correctorBtnTitle}>Try Pose Corrector</Text>
              <Text style={styles.correctorBtnDesc}>Use camera to check your alignment</Text>
            </View>
            <Text style={styles.correctorBtnArrow}>→</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  heroContainer: { position: 'relative', height: 280 },
  heroImage: { width: '100%', height: '100%', backgroundColor: colors.backgroundDark },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,46,26,0.35)',
  },
  heroContent: {
    position: 'absolute',
    bottom: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
  },
  heroTitle: {
    ...typography.headerLarge,
    color: colors.textWhite,
    marginTop: spacing.sm,
    fontSize: 26,
  },
  heroSanskrit: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
    fontStyle: 'italic',
    marginTop: 2,
  },
  body: { padding: spacing.md, paddingBottom: spacing.xxl },
  metaRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  metaItem: { flex: 1, alignItems: 'center' },
  metaDivider: { width: 1, backgroundColor: colors.border, marginVertical: 4 },
  metaIcon: { fontSize: 20, marginBottom: 4 },
  metaLabel: { ...typography.caption, color: colors.textMuted },
  metaValue: { ...typography.bodySmall, fontWeight: '700', color: colors.text, marginTop: 2 },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
  },
  cautionCard: {
    borderLeftWidth: 3,
    borderLeftColor: colors.warning,
  },
  cardTitle: {
    ...typography.headerSmall,
    fontSize: 16,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  cardBody: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
    marginTop: 1,
  },
  stepNumberText: {
    ...typography.caption,
    color: colors.textWhite,
    fontWeight: '800',
    fontSize: 13,
  },
  stepText: {
    ...typography.body,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 22,
  },
  bulletRow: { flexDirection: 'row', marginBottom: 6 },
  bulletDot: { fontSize: 16, color: colors.primary, marginRight: spacing.sm, lineHeight: 22 },
  bulletText: { ...typography.body, color: colors.textSecondary, flex: 1, lineHeight: 22 },
  correctorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginTop: spacing.sm,
    ...shadows.prominent,
  },
  correctorBtnEmoji: { fontSize: 24, marginRight: spacing.md },
  correctorBtnContent: { flex: 1 },
  correctorBtnTitle: { ...typography.headerSmall, color: colors.textWhite, fontSize: 15 },
  correctorBtnDesc: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  correctorBtnArrow: { fontSize: 20, color: colors.textWhite, fontWeight: '700' },
});

export default PoseDetailScreen;
