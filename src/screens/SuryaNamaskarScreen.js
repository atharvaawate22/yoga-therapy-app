/**
 * SuryaNamaskarScreen - 12-step sequence with round selection
 */
import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, screenStyles, gradients } from '../theme/theme';
import suryaNamaskarSteps from '../data/suryaNamaskarData';
import RoundSelector from '../components/RoundSelector';
import { resolveImageSource } from '../utils/imageUtils';
import { hasRealPoseImage, POSE_ICON_FALLBACK } from '../data/poseImages';
import { savePracticeSession, formatDuration } from '../data/sessionStorage';

// Small thumbnail for the preview list -- a photo when one genuinely
// matches the pose, otherwise a themed icon rather than an unrelated stock
// photo passed off as the real thing.
const PoseThumb = ({ poseId, source, iconSize, style }) => {
  if (hasRealPoseImage(poseId)) {
    return <Image source={source} style={style} />;
  }
  const icon = POSE_ICON_FALLBACK[poseId] || { family: 'mci', name: 'yoga' };
  return (
    <View style={[style, { backgroundColor: colors.cardAlt, justifyContent: 'center', alignItems: 'center' }]}>
      {icon.family === 'ion'
        ? <Ionicons name={icon.name} size={iconSize} color={colors.primary} />
        : <MaterialCommunityIcons name={icon.name} size={iconSize} color={colors.primary} />}
    </View>
  );
};

const SuryaNamaskarScreen = ({ navigation }) => {
  const [rounds, setRounds] = useState(3);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const startTimeRef = useRef(null);

  const step = suryaNamaskarSteps[currentStep];
  const imgSrc = resolveImageSource(step.image);

  const handleStart = () => {
    startTimeRef.current = Date.now();
    setStarted(true);
  };

  const resetPractice = () => {
    setStarted(false);
    setCurrentStep(0);
    setCurrentRound(1);
  };

  const handleComplete = async () => {
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    await savePracticeSession({
      type: 'surya',
      title: 'Surya Namaskar',
      posesCompleted: rounds * suryaNamaskarSteps.length,
      poseCount: rounds * suryaNamaskarSteps.length,
      durationSec,
    });
    resetPractice();
    Alert.alert(
      'Practice Complete! 🎉',
      `${rounds} round${rounds > 1 ? 's' : ''} of Surya Namaskar in ${formatDuration(durationSec)}.\nSaved to your progress.`,
      [
        { text: 'View Progress', onPress: () => navigation.navigate('MainTabs', { screen: 'History' }) },
        { text: 'Done', style: 'cancel' },
      ]
    );
  };

  const handleNext = () => {
    if (currentStep < suryaNamaskarSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (currentRound < rounds) {
      setCurrentRound(currentRound + 1);
      setCurrentStep(0);
    } else {
      // Completed all rounds
      handleComplete();
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
            <LinearGradient colors={gradients.streak} style={styles.headerIconBox}>
              <Ionicons name="sunny" size={30} color="#FFFFFF" />
            </LinearGradient>
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
                  <PoseThumb poseId={s.imageId} source={sImg} iconSize={22} style={styles.previewThumb} />
                  <View style={styles.previewInfo}>
                    <Text style={styles.previewName}>{s.name}</Text>
                    <Text style={styles.previewSanskrit}>{s.sanskritName}</Text>
                  </View>
                  <Text style={styles.breathTag}>{s.breathing}</Text>
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
            <Text style={styles.startBtnText}>Begin Practice</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textWhite} />
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
        <PoseThumb poseId={step.imageId} source={imgSrc} iconSize={72} style={styles.stepImage} />

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
            <Text style={styles.testPoseButtonText}>Test This Pose</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.primary} />
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
            <Ionicons name="chevron-back" size={15} color={colors.text} />
            <Text style={styles.navBtnText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.stopBtn}
            onPress={resetPractice}
            activeOpacity={0.8}
          >
            <Text style={styles.stopBtnText}>Stop</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
            <Text style={styles.nextBtnText}>{isLastStep ? 'Done' : 'Next'}</Text>
            <Ionicons name={isLastStep ? 'checkmark' : 'chevron-forward'} size={15} color={colors.textWhite} />
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
  headerIconBox: {
    width: 64, height: 64, borderRadius: 32,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
    ...shadows.prominent,
  },
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
    flexDirection: 'row', justifyContent: 'center', gap: 6,
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
    flexDirection: 'row', justifyContent: 'center', gap: 4,
    backgroundColor: colors.cardAlt, borderRadius: borderRadius.lg,
    paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  testPoseButtonText: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  navRow: { flexDirection: 'row', padding: spacing.md, gap: spacing.sm },
  navBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: borderRadius.lg,
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
    flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary, alignItems: 'center', ...shadows.prominent,
  },
  nextBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
});

export default SuryaNamaskarScreen;
