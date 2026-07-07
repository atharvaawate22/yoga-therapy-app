/**
 * SuryaNamaskarScreen - 12-step sequence with round selection
 */
import React, { useState } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import suryaNamaskarSteps from '../data/suryaNamaskarData';
import RoundSelector from '../components/RoundSelector';
import { resolveImageSource } from '../utils/imageUtils';

const SuryaNamaskarScreen = ({ navigation }) => {
  const [rounds, setRounds] = useState(3);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);

  const step = suryaNamaskarSteps[currentStep];
  const imgSrc = resolveImageSource(step.image);

  const handleNext = () => {
    if (currentStep < suryaNamaskarSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentRound < rounds) {
      setCurrentRound(currentRound + 1);
      setCurrentStep(0);
    } else {
      // Completed all rounds
      setStarted(false);
      setCurrentStep(0);
      setCurrentRound(1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else if (currentRound > 1) {
      setCurrentRound(currentRound - 1);
      setCurrentStep(suryaNamaskarSteps.length - 1);
    }
  };

  const isLastStep = currentStep === suryaNamaskarSteps.length - 1 && currentRound === rounds;
  const totalSteps = rounds * 12;
  const completedSteps = (currentRound - 1) * 12 + currentStep;
  const progressPct = (completedSteps / totalSteps) * 100;

  if (!started) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.emoji}>☀️</Text>
            <Text style={styles.title}>Surya Namaskar</Text>
            <Text style={styles.subtitle}>Sun Salutation — 12-step sacred sequence</Text>
          </View>

          <RoundSelector rounds={rounds} setRounds={setRounds} />

          {/* Preview Steps */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionLabel}>12-STEP SEQUENCE</Text>
            {suryaNamaskarSteps.map((s, i) => {
              const sImg = resolveImageSource(s.image);
              return (
                <View key={i} style={styles.previewRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{s.step}</Text>
                  </View>
                  <Image source={sImg} style={styles.previewThumb} />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>{s.name}</Text>
                    <Text style={styles.previewSanskrit}>{s.sanskritName}</Text>
                  </View>
                  <Text style={styles.breathTag}>{s.breathing}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={() => setStarted(true)} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Begin Practice →</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Active practice mode
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.practiceContainer}>
        {/* Progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <Text style={styles.progressText}>
          Round {currentRound}/{rounds} • Step {currentStep + 1}/12
        </Text>

        {/* Step Image */}
        <Image source={imgSrc} style={styles.stepImage} resizeMode="cover" />

        {/* Step Info */}
        <View style={styles.stepInfo}>
          <View style={styles.breathBadge}>
            <Text style={styles.breathBadgeText}>{step.breathing}</Text>
          </View>
          <Text style={styles.stepTitle}>{step.name}</Text>
          <Text style={styles.stepSanskrit}>{step.sanskritName}</Text>
          <Text style={styles.stepDesc}>{step.description}</Text>

          {step.steps && (
            <View style={styles.miniSteps}>
              {step.steps.map((s, i) => (
                <Text key={i} style={styles.miniStepText}>• {s}</Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.testPoseRow}>
          <TouchableOpacity
            style={styles.testPoseButton}
            onPress={() => navigation.navigate('PoseCorrector', {
              expectedPoseId: step.expectedPoseId,
              expectedPoseName: step.sanskritName,
            })}
            activeOpacity={0.85}
          >
            <Text style={styles.testPoseButtonText}>Test This Pose →</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation */}
        <View style={styles.navRow}>
          <TouchableOpacity
            style={[styles.navBtn, (currentStep === 0 && currentRound === 1) && styles.navBtnDisabled]}
            onPress={handlePrev}
            disabled={currentStep === 0 && currentRound === 1}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnText}>← Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={() => { setStarted(false); setCurrentStep(0); setCurrentRound(1); }}
            activeOpacity={0.8}
          >
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{isLastStep ? '✓ Done' : 'Next →'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.lg },
  emoji: { fontSize: 48, marginBottom: spacing.sm },
  title: { ...typography.headerLarge, color: colors.primary },
  subtitle: { ...typography.bodySmall, color: colors.textLight, marginTop: 4 },
  sectionLabel: { ...typography.label, color: colors.primary, marginTop: spacing.lg, marginBottom: spacing.sm },
  previewSection: { marginTop: spacing.sm },
  previewRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: 6,
    ...shadows.soft, borderWidth: 1, borderColor: colors.borderLight,
  },
  stepBadge: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
  },
  stepBadgeText: { ...typography.caption, color: colors.textWhite, fontWeight: '800' },
  previewThumb: { width: 44, height: 44, borderRadius: borderRadius.sm, backgroundColor: colors.backgroundDark, marginRight: spacing.sm },
  previewInfo: { flex: 1 },
  previewName: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  previewSanskrit: { ...typography.caption, color: colors.textMuted, fontStyle: 'italic' },
  breathTag: {
    ...typography.caption, fontWeight: '700', color: colors.accent,
    backgroundColor: colors.cardAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
  },
  startBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    paddingVertical: 16, alignItems: 'center', marginTop: spacing.lg, ...shadows.prominent,
  },
  startBtnText: { ...typography.headerSmall, color: colors.textWhite, fontSize: 17 },
  // Practice mode
  practiceContainer: { flex: 1 },
  progressBar: { height: 4, backgroundColor: colors.borderLight },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  progressText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', paddingVertical: spacing.sm },
  stepImage: { width: '100%', height: 240, backgroundColor: colors.backgroundDark },
  stepInfo: { flex: 1, padding: spacing.md },
  breathBadge: {
    alignSelf: 'flex-start', backgroundColor: colors.accent, borderRadius: borderRadius.round,
    paddingHorizontal: spacing.sm, paddingVertical: 3, marginBottom: spacing.sm,
  },
  breathBadgeText: { ...typography.caption, color: colors.textWhite, fontWeight: '700' },
  stepTitle: { ...typography.headerMedium, color: colors.primary, marginBottom: 2 },
  stepSanskrit: { ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm },
  stepDesc: { ...typography.body, color: colors.textSecondary, lineHeight: 22 },
  miniSteps: { marginTop: spacing.sm },
  miniStepText: { ...typography.bodySmall, color: colors.textLight, lineHeight: 22 },
  testPoseRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  testPoseButton: {
    backgroundColor: colors.cardAlt, borderRadius: borderRadius.lg,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  testPoseButtonText: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  navRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  navBtn: {
    flex: 1, paddingVertical: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  stopBtn: {
    paddingVertical: 12, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg,
    backgroundColor: colors.expertBg, alignItems: 'center',
  },
  stopBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.error },
  nextBtn: {
    flex: 1, paddingVertical: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary, alignItems: 'center', ...shadows.prominent,
  },
  nextBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
});

export default SuryaNamaskarScreen;
