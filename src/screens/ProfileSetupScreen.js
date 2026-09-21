/**
 * ProfileSetupScreen - Onboarding screen for user profile
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import { setUserProfile, setOnboarded } from '../data/userStorage';
import { REMINDER_OPTIONS, getReminderSetting, applyReminderSetting } from '../utils/reminders';

const experienceLevels = [
  { key: 'beginner', label: 'Beginner', emoji: '🌱', desc: 'New to yoga, gentle corrections' },
  { key: 'intermediate', label: 'Intermediate', emoji: '🌿', desc: '1-2 years experience, balanced feedback' },
  { key: 'expert', label: 'Expert', emoji: '🌳', desc: '3+ years, strict & precise corrections' },
];

const ageRanges = [
  { key: '18-25', label: '18-25', value: 22 },
  { key: '26-35', label: '26-35', value: 30 },
  { key: '36-45', label: '36-45', value: 40 },
  { key: '46-55', label: '46-55', value: 50 },
  { key: '56+', label: '56+', value: 60 },
];

const ProfileSetupScreen = ({ navigation }) => {
  const [name, setName] = useState('');
  const [selectedAge, setSelectedAge] = useState('26-35');
  const [experience, setExperience] = useState('beginner');
  const [reminder, setReminder] = useState('off');

  useEffect(() => {
    getReminderSetting().then(r => setReminder(r.key));
  }, []);

  const handleContinue = async () => {
    const ageObj = ageRanges.find(a => a.key === selectedAge);
    await setUserProfile({
      name: name.trim() || 'Yogi',
      age: ageObj?.value || 30,
      ageRange: selectedAge,
      experience,
    });
    await setOnboarded();
    const result = await applyReminderSetting(reminder);
    if (!result.ok && result.reason === 'permission-denied') {
      Alert.alert(
        'Notifications Disabled',
        'Reminder was not set because notification permission is off. Enable notifications in your device settings and try again.'
      );
    }
    navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.emoji}>🧘‍♀️</Text>
            <Text style={styles.title}>Welcome to{'\n'}Yoga Therapy</Text>
            <Text style={styles.subtitle}>
              Let's personalize your experience for better yoga guidance.
            </Text>
          </View>

          {/* Name */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>YOUR NAME</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Age Range */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>AGE RANGE</Text>
            <View style={styles.chipRow}>
              {ageRanges.map(a => (
                <TouchableOpacity
                  key={a.key}
                  style={[styles.chip, selectedAge === a.key && styles.chipActive]}
                  onPress={() => setSelectedAge(a.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, selectedAge === a.key && styles.chipTextActive]}>
                    {a.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Experience Level */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>EXPERIENCE LEVEL</Text>
            {experienceLevels.map(lvl => (
              <TouchableOpacity
                key={lvl.key}
                style={[styles.levelCard, experience === lvl.key && styles.levelCardActive]}
                onPress={() => setExperience(lvl.key)}
                activeOpacity={0.8}
              >
                <Text style={styles.levelEmoji}>{lvl.emoji}</Text>
                <View style={styles.levelContent}>
                  <Text style={[styles.levelTitle, experience === lvl.key && styles.levelTitleActive]}>
                    {lvl.label}
                  </Text>
                  <Text style={styles.levelDesc}>{lvl.desc}</Text>
                </View>
                <View style={[styles.radio, experience === lvl.key && styles.radioActive]}>
                  {experience === lvl.key && <View style={styles.radioDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Daily Reminder */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>DAILY PRACTICE REMINDER</Text>
            <View style={styles.chipRow}>
              {REMINDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.chip, reminder === opt.key && styles.chipActive]}
                  onPress={() => setReminder(opt.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.chipText, reminder === opt.key && styles.chipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.sectionHint}>
              We'll send one gentle nudge a day to keep your streak going.
            </Text>
          </View>

          {/* Continue Button */}
          <TouchableOpacity style={styles.continueBtn} onPress={handleContinue} activeOpacity={0.85}>
            <Text style={styles.continueBtnText}>Start My Journey →</Text>
          </TouchableOpacity>

          <Text style={styles.skip} onPress={handleContinue}>
            Skip for now
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { alignItems: 'center', marginBottom: spacing.xl },
  emoji: { fontSize: 56, marginBottom: spacing.md },
  title: {
    ...typography.headerLarge,
    textAlign: 'center',
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: { marginBottom: spacing.lg },
  sectionLabel: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.sm,
  },
  sectionHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    ...typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textWhite },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadows.soft,
  },
  levelCardActive: {
    borderColor: colors.primary,
    backgroundColor: '#F0F9F0',
  },
  levelEmoji: { fontSize: 28, marginRight: spacing.md },
  levelContent: { flex: 1 },
  levelTitle: { ...typography.headerSmall, fontSize: 16, color: colors.text },
  levelTitleActive: { color: colors.primary },
  levelDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: { borderColor: colors.primary },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  continueBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.xl,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.md,
    ...shadows.prominent,
  },
  continueBtnText: {
    ...typography.headerSmall,
    color: colors.textWhite,
    fontSize: 17,
  },
  skip: {
    ...typography.bodySmall,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    textDecorationLine: 'underline',
  },
});

export default ProfileSetupScreen;
