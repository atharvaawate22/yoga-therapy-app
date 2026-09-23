/**
 * PracticeSessionScreen - Timed play-through of a pose list
 *
 * Route params:
 *   title      - session name shown in header/summary (e.g. "Back Pain")
 *   poses      - array of pose objects from yogaData
 *   sourceType - 'routine' | 'custom' | 'single' (stored in history)
 *
 * Flow per pose: GET READY (prep countdown) → HOLD (pose duration) → next.
 * Voice cues via expo-speech, session saved to history on finish/early end.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, screenStyles, gradients } from '../theme/theme';
import { savePracticeSession, parseDurationSec, formatDuration } from '../data/sessionStorage';
import { getVoiceEnabled } from '../data/userStorage';
import { resolveImageSource } from '../utils/imageUtils';

const PREP_SECONDS = 8;

const PracticeSessionScreen = ({ route, navigation }) => {
  const { title = 'Practice', poses = [], sourceType = 'routine' } = route.params || {};

  const [poseIndex, setPoseIndex] = useState(0);
  const [phase, setPhase] = useState('prep'); // 'prep' | 'hold' | 'done'
  const [secondsLeft, setSecondsLeft] = useState(PREP_SECONDS);
  const [isPaused, setIsPaused] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [prefsReady, setPrefsReady] = useState(false);
  const [posesCompleted, setPosesCompleted] = useState(0);

  const elapsedRef = useRef(0);       // active (unpaused) seconds
  const secondsRef = useRef(PREP_SECONDS); // countdown source of truth (state is the render copy)
  const completedRef = useRef(0);     // mirrors posesCompleted for unmount-safe saves
  const savedRef = useRef(false);     // guard against double-saving
  const voiceRef = useRef(true);

  const pose = poses[poseIndex];
  const holdSeconds = pose ? parseDurationSec(pose.duration) : 30;

  const speak = useCallback((message) => {
    if (!voiceRef.current) return;
    Speech.stop();
    Speech.speak(message, { language: 'en-IN', pitch: 1.0, rate: 0.9 });
  }, []);

  const saveSession = useCallback(async () => {
    if (savedRef.current || completedRef.current === 0) return null;
    savedRef.current = true;
    return savePracticeSession({
      type: sourceType,
      title,
      posesCompleted: completedRef.current,
      poseCount: poses.length,
      durationSec: elapsedRef.current,
    });
  }, [sourceType, title, poses.length]);

  // Load the global voice preference before the first announcement
  useEffect(() => {
    getVoiceEnabled().then(v => {
      voiceRef.current = v;
      setIsVoiceEnabled(v);
      setPrefsReady(true);
    });
  }, []);

  // Announce pose at each prep start
  useEffect(() => {
    if (!prefsReady || phase !== 'prep' || !pose) return;
    speak(`Get ready. ${pose.name}. ${formatDuration(parseDurationSec(pose.duration))}.`);
  }, [poseIndex, phase === 'prep', prefsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // Main 1-second tick
  useEffect(() => {
    if (phase === 'done' || isPaused) return;
    const timer = setInterval(() => {
      elapsedRef.current += 1;
      secondsRef.current -= 1;
      if (secondsRef.current > 0) {
        setSecondsLeft(secondsRef.current);
        return;
      }
      if (phase === 'prep') {
        secondsRef.current = holdSeconds;
        setSecondsLeft(holdSeconds);
        setPhase('hold');
        speak('Begin.');
        return;
      }
      // hold finished → pose complete
      completedRef.current += 1;
      setPosesCompleted(completedRef.current);
      if (poseIndex < poses.length - 1) {
        secondsRef.current = PREP_SECONDS;
        setSecondsLeft(PREP_SECONDS);
        setPoseIndex(poseIndex + 1);
        setPhase('prep');
        speak('Relax.');
      } else {
        setSecondsLeft(0);
        setPhase('done');
        speak('Session complete. Well done!');
        saveSession();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, isPaused, poseIndex, holdSeconds, speak, saveSession, poses.length]);

  // Cleanup: stop speech, save partial session if user leaves mid-way
  useEffect(() => {
    return () => {
      Speech.stop();
      saveSession();
    };
  }, [saveSession]);

  const handleEnd = () => {
    if (phase === 'done') { navigation.goBack(); return; }
    Alert.alert('End Session?', 'Your completed poses will be saved to history.', [
      { text: 'Keep Going', style: 'cancel' },
      { text: 'End Session', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  const goToPose = (index) => {
    secondsRef.current = PREP_SECONDS;
    setSecondsLeft(PREP_SECONDS);
    setPoseIndex(index);
    setPhase('prep');
  };

  const handleSkip = () => {
    if (poseIndex < poses.length - 1) {
      goToPose(poseIndex + 1);
    } else {
      setPhase('done');
      Speech.stop();
      saveSession();
    }
  };

  const handlePrev = () => {
    if (poseIndex === 0) return;
    goToPose(poseIndex - 1);
  };

  const toggleVoice = () => {
    if (voiceRef.current) Speech.stop();
    voiceRef.current = !voiceRef.current;
    setIsVoiceEnabled(voiceRef.current);
  };

  if (!poses.length) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No poses to practice.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Completion summary ──
  if (phase === 'done') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centered}>
          <LinearGradient colors={gradients.streak} style={styles.doneIconBox}>
            <Ionicons name="trophy" size={32} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.doneTitle}>Session Complete!</Text>
          <Text style={styles.doneSubtitle}>{title}</Text>

          <View style={styles.summaryCard}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{posesCompleted}/{poses.length}</Text>
              <Text style={styles.summaryLabel}>Poses</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{formatDuration(elapsedRef.current)}</Text>
              <Text style={styles.summaryLabel}>Duration</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.historyBtn}
            onPress={() => navigation.navigate('MainTabs', { screen: 'History' })}
            activeOpacity={0.85}
          >
            <Ionicons name="stats-chart-outline" size={17} color={colors.textWhite} />
            <Text style={styles.historyBtnText}>View My Progress</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Active practice ──
  const progressPct = ((poseIndex + (phase === 'hold' ? 0.5 : 0)) / poses.length) * 100;
  const isPrep = phase === 'prep';

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.practice}>
        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
        </View>
        <View style={styles.topRow}>
          <Text style={styles.progressText}>Pose {poseIndex + 1}/{poses.length} • {title}</Text>
          <TouchableOpacity onPress={toggleVoice} activeOpacity={0.7}>
            <Ionicons
              name={isVoiceEnabled ? 'volume-high-outline' : 'volume-mute-outline'}
              size={20}
              color={colors.textLight}
            />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          <Image source={resolveImageSource(pose.image)} style={styles.poseImage} resizeMode="cover" />

          {/* Timer */}
          <View style={[styles.timerBox, isPrep ? styles.timerBoxPrep : styles.timerBoxHold]}>
            <Text style={[styles.phaseLabel, isPrep ? styles.phaseLabelPrep : styles.phaseLabelHold]}>
              {isPrep ? 'GET READY' : 'HOLD THE POSE'}
            </Text>
            <Text style={styles.timerText}>{secondsLeft}</Text>
            <Text style={styles.timerUnit}>seconds</Text>
          </View>

          <Text style={styles.poseName}>{pose.name}</Text>
          {pose.sanskritName ? <Text style={styles.poseSanskrit}>{pose.sanskritName}</Text> : null}

          {pose.steps?.length ? (
            <View style={styles.stepsCard}>
              {pose.steps.map((s, i) => (
                <Text key={i} style={styles.stepText}>• {s}</Text>
              ))}
            </View>
          ) : null}
        </ScrollView>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity
            style={[styles.ctrlBtn, poseIndex === 0 && styles.ctrlBtnDisabled]}
            onPress={handlePrev}
            disabled={poseIndex === 0}
            activeOpacity={0.8}
          >
            <Ionicons name="chevron-back" size={15} color={colors.text} />
            <Text style={styles.ctrlBtnText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.pauseBtn}
            onPress={() => setIsPaused(p => !p)}
            activeOpacity={0.85}
          >
            <Ionicons name={isPaused ? 'play' : 'pause'} size={15} color={colors.textWhite} />
            <Text style={styles.pauseBtnText}>{isPaused ? 'Resume' : 'Pause'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctrlBtn} onPress={handleSkip} activeOpacity={0.8}>
            <Text style={styles.ctrlBtnText}>Skip</Text>
            <Ionicons name="chevron-forward" size={15} color={colors.text} />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd} activeOpacity={0.8}>
          <Text style={styles.endBtnText}>End Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  emptyText: { ...typography.body, color: colors.textMuted },

  practice: { flex: 1 },
  progressBar: { height: 4, backgroundColor: colors.borderLight },
  progressFill: { height: 4, backgroundColor: colors.primary, borderRadius: 2 },
  topRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
  },
  progressText: { ...typography.caption, color: colors.textMuted },
  scrollBody: { paddingBottom: spacing.md },

  poseImage: { width: '100%', height: 220, backgroundColor: colors.backgroundDark },

  timerBox: {
    alignItems: 'center', marginHorizontal: spacing.md, marginTop: -30,
    borderRadius: borderRadius.xl, paddingVertical: spacing.md, ...shadows.prominent,
  },
  timerBoxPrep: { backgroundColor: colors.accentWarm },
  timerBoxHold: { backgroundColor: colors.primary },
  phaseLabel: { ...typography.label, fontSize: 10 },
  phaseLabelPrep: { color: 'rgba(255,255,255,0.9)' },
  phaseLabelHold: { color: 'rgba(255,255,255,0.9)' },
  timerText: { fontSize: 56, fontWeight: '800', color: colors.textWhite, lineHeight: 62 },
  timerUnit: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },

  poseName: {
    ...typography.headerMedium, color: colors.primary,
    textAlign: 'center', marginTop: spacing.md,
  },
  poseSanskrit: {
    ...typography.bodySmall, color: colors.textMuted, fontStyle: 'italic', textAlign: 'center',
  },
  stepsCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md,
    marginHorizontal: spacing.md, marginTop: spacing.md, ...shadows.card,
  },
  stepText: { ...typography.bodySmall, color: colors.textLight, lineHeight: 22 },

  controls: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm },
  ctrlBtn: {
    flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  ctrlBtnDisabled: { opacity: 0.4 },
  ctrlBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  pauseBtn: {
    flex: 1.3, flexDirection: 'row', justifyContent: 'center', gap: 4,
    paddingVertical: 12, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary, alignItems: 'center', ...shadows.prominent,
  },
  pauseBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
  endBtn: { alignItems: 'center', paddingVertical: spacing.md },
  endBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.error },

  /* Done state */
  doneIconBox: {
    width: 72, height: 72, borderRadius: 36,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
    ...shadows.prominent,
  },
  doneTitle: { ...typography.headerLarge, color: colors.primary },
  doneSubtitle: { ...typography.body, color: colors.textLight, marginBottom: spacing.lg },
  summaryCard: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.lg, alignSelf: 'stretch', marginBottom: spacing.lg, ...shadows.card,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: colors.border },
  summaryValue: { ...typography.headerMedium, color: colors.primary },
  summaryLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  historyBtn: {
    flexDirection: 'row', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: borderRadius.xl, paddingVertical: 14,
    alignItems: 'center', alignSelf: 'stretch', ...shadows.prominent,
  },
  historyBtnText: { ...typography.headerSmall, fontSize: 15, color: colors.textWhite },
  doneBtn: { paddingVertical: spacing.md },
  doneBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.textLight },
});

export default PracticeSessionScreen;
