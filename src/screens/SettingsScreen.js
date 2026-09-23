/**
 * SettingsScreen - App preferences: voice guidance, reminders, profile, data
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import { getUserProfile, getVoiceEnabled, setVoiceEnabled } from '../data/userStorage';
import { clearPracticeSessions } from '../data/sessionStorage';
import { REMINDER_OPTIONS, getReminderSetting, applyReminderSetting } from '../utils/reminders';
import ExperienceBadge from '../components/ExperienceBadge';

const SettingsScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [reminder, setReminder] = useState('off');

  useFocusEffect(
    useCallback(() => {
      getUserProfile().then(setProfile);
      getVoiceEnabled().then(setVoiceOn);
      getReminderSetting().then(r => setReminder(r.key));
    }, [])
  );

  const handleVoiceToggle = async (value) => {
    setVoiceOn(value);
    await setVoiceEnabled(value);
  };

  const handleReminderSelect = async (key) => {
    const prev = reminder;
    setReminder(key);
    const result = await applyReminderSetting(key);
    if (!result.ok && result.reason === 'permission-denied') {
      setReminder(prev === key ? 'off' : prev);
      Alert.alert(
        'Notifications Disabled',
        'Enable notifications for this app in your device settings, then try again.'
      );
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Practice History?',
      'This permanently deletes all sessions, streaks and stats. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything', style: 'destructive',
          onPress: async () => {
            await clearPracticeSessions();
            Alert.alert('History Cleared', 'Your practice history has been deleted.');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Settings</Text>

        {/* Profile */}
        <Text style={styles.sectionLabel}>PROFILE</Text>
        <TouchableOpacity
          style={styles.profileCard}
          onPress={() => navigation.navigate('ProfileSetup')}
          activeOpacity={0.8}
        >
          <View style={styles.profileAvatar}>
            <Ionicons name="person" size={22} color={colors.primary} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{profile?.name || 'Yogi'}</Text>
            {profile && <ExperienceBadge level={profile.experience} small />}
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>

        {/* Practice preferences */}
        <Text style={styles.sectionLabel}>PRACTICE</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIconBox}>
              <Ionicons name="volume-high-outline" size={18} color={colors.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Voice guidance</Text>
              <Text style={styles.rowDesc}>Spoken cues in guided practice and pose corrector</Text>
            </View>
            <Switch
              value={voiceOn}
              onValueChange={handleVoiceToggle}
              trackColor={{ false: colors.border, true: colors.secondary }}
              thumbColor={voiceOn ? colors.primary : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Reminder */}
        <Text style={styles.sectionLabel}>DAILY REMINDER</Text>
        <View style={styles.card}>
          <View style={styles.rowHeader}>
            <View style={styles.rowIconBox}>
              <Ionicons name="notifications-outline" size={18} color={colors.primary} />
            </View>
            <Text style={styles.rowTitle}>Reminder time</Text>
          </View>
          <View style={styles.chipRow}>
            {REMINDER_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, reminder === opt.key && styles.chipActive]}
                onPress={() => handleReminderSelect(opt.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, reminder === opt.key && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.rowDesc}>One gentle nudge a day to keep your streak going.</Text>
        </View>

        {/* Data */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <TouchableOpacity style={styles.dangerCard} onPress={handleClearHistory} activeOpacity={0.8}>
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.dangerText}>Clear practice history</Text>
        </TouchableOpacity>

        <View style={styles.footerRow}>
          <Ionicons name="leaf-outline" size={14} color={colors.textMuted} />
          <Text style={styles.footer}>Yoga Therapy App · v1.0.0{'\n'}Practice safely.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.headerLarge, color: colors.primary, marginBottom: spacing.sm },
  sectionLabel: {
    ...typography.label, color: colors.primary,
    marginTop: spacing.md, marginBottom: spacing.sm,
  },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.lg, padding: spacing.md,
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  profileAvatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.cardAlt,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.md,
  },
  profileInfo: { flex: 1, gap: 4 },
  profileName: { ...typography.headerSmall, fontSize: 16, color: colors.text },

  card: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md,
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  rowIconBox: {
    width: 34, height: 34, borderRadius: borderRadius.sm, backgroundColor: colors.cardAlt,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
  },
  rowText: { flex: 1, marginRight: spacing.sm },
  rowTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.text },
  rowDesc: { ...typography.caption, color: colors.textMuted, marginTop: 3, lineHeight: 16 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  chip: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    borderRadius: borderRadius.round, backgroundColor: colors.background,
    borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.textWhite },

  dangerCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.expertBg, borderRadius: borderRadius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: '#FFCDD2',
  },
  dangerText: { ...typography.bodySmall, fontWeight: '700', color: colors.error },

  footerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing.xl,
  },
  footer: {
    ...typography.caption, color: colors.textMuted, textAlign: 'center',
    lineHeight: 18,
  },
});

export default SettingsScreen;
