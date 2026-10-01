/**
 * SuryaNamaskarScreen - 12-step sequence with round selection
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, screenStyles, gradients } from '../theme/theme';
import suryaNamaskarSteps from '../data/suryaNamaskarData';
import RoundSelector from '../components/RoundSelector';
import PoseImage from '../components/PoseImage';
import { savePracticeSession, formatDuration } from '../data/sessionStorage';

const STEPS_PER_ROUND = suryaNamaskarSteps.length;
// Estimate for the round picker: each step's hold plus a few seconds to move
// into it. (The practice itself is stepped manually with Next.)
const TRANSITION_SEC = 3;
const SECONDS_PER_ROUND = suryaNamaskarSteps.reduce((sum, s) => sum + s.duration + TRANSITION_SEC, 0);

const SuryaNamaskarScreen = ({ navigation }) => {
  const [rounds, setRounds] = useState(3);
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);
  const startTimeRef = useRef(null);
  // "round-step" keys the user moved past with Next. Saved counts come from
  // this rather than assuming every planned step was done.
  const completedStepsRef = useRef(new Set());
  const roundsRef = useRef(rounds);
  const savedRef = useRef(false);
  roundsRef.current = rounds;

  const step = suryaNamaskarSteps[currentStep];

  // Saves at most once per practice; nothing if no step was completed.
  const saveSession = useCallback(async () => {
    if (savedRef.current || !startTimeRef.current || completedStepsRef.current.size === 0) return null;
    savedRef.current = true;
    const durationSec = Math.round((Date.now() - startTimeRef.current) / 1000);
    await savePracticeSession({
      type: 'surya',
      title: 'Surya Namaskar',
      posesCompleted: completedStepsRef.current.size,
      poseCount: roundsRef.current * STEPS_PER_ROUND,
      durationSec,
    });
    return durationSec;
  }, []);

  // Leaving mid-practice (back button/gesture) keeps the steps done so far.
  useEffect(() => () => { saveSession(); }, [saveSession]);

  const handleStart = () => {
    startTimeRef.current = Date.now();
    completedStepsRef.current = new Set();
    savedRef.current = false;
    setStarted(true);
  };

  const resetPractice = () => {
    startTimeRef.current = null;
    setStarted(false);
    setCurrentStep(0);
    setCurrentRound(1);
  };

  const handleStop = () => {
    const done = completedStepsRef.current.size;
    Alert.alert(
      'Stop Practice?',
      done > 0
        ? `You've completed ${done} step${done !== 1 ? 's' : ''}. They'll be saved to your progress.`
        : 'No steps completed yet, so nothing will be saved.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: 'Stop', style: 'destructive',
          onPress: async () => { await saveSession(); resetPractice(); },
        },
      ]
    );
  };

  const handleComplete = async () => {
    // A second tap on Done while the first save is running would save twice.
    if (savedRef.current) return;
    const durationSec = await saveSession();
    resetPractice();
    Alert.alert(
      'Practice Complete! 🎉',
      `${rounds} round${rounds > 1 ? 's' : ''} of Surya Namaskar in ${formatDuration(durationSec || 0)}.\nSaved to your progress.`,
      [
        { text: 'View Progress', onPress: () => navigation.navigate('MainTabs', { screen: 'History' }) },
        { text: 'Done', style: 'cancel' },
      ]
    );
  };

  const handleNext = () => {
    completedStepsRef.current.add(`${currentRound}-${currentStep}`);
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
  const totalSteps = rounds * STEPS_PER_ROUND;
  const completedSteps = (currentRound - 1) * STEPS_PER_ROUND + currentStep;
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

          <RoundSelector
            rounds={rounds}
            setRounds={setRounds}
            stepsPerRound={STEPS_PER_ROUND}
            secondsPerRound={SECONDS_PER_ROUND}
          />

          {/* Preview Steps */}
          <View style={styles.previewSection}>
            <Text style={styles.sectionLabel}>12-STEP SEQUENCE</Text>
            {suryaNamaskarSteps.map((s, i) => {
              return (
                <View key={i} style={styles.previewRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{s.step}</Text>
                  </View>
                  <PoseImage poseId={s.imageId} image={s.image} iconSize={22} style={styles.previewThumb} />
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
        <PoseImage poseId={step.imageId} image={step.image} iconSize={72} style={styles.stepImage} />

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
            onPress={handleStop}
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
