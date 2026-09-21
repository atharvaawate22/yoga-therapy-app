/**
 * HistoryScreen - Practice history, streak and weekly stats
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import { getPracticeSessions, getPracticeStats, groupSessionsByDay, formatDuration } from '../data/sessionStorage';

const TYPE_META = {
  routine: { emoji: '🧘', label: 'Routine' },
  custom: { emoji: '📋', label: 'Custom set' },
  single: { emoji: '🎯', label: 'Single pose' },
  surya: { emoji: '☀️', label: 'Surya Namaskar' },
  corrector: { emoji: '📸', label: 'Pose corrector' },
};

const BAR_MAX_HEIGHT = 72;

const HistoryScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [groups, setGroups] = useState([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([getPracticeStats(), getPracticeSessions()]).then(([s, sessions]) => {
        if (!active) return;
        setStats(s);
        setGroups(groupSessionsByDay(sessions));
      });
      return () => { active = false; };
    }, [])
  );

  if (!stats) return <SafeAreaView style={styles.container} edges={['bottom']} />;

  const maxMinutes = Math.max(...stats.last7Days.map(d => d.minutes), 1);
  const isEmpty = stats.totalSessions === 0;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Progress</Text>
        <Text style={styles.subtitle}>Your yoga practice, day by day</Text>

        {/* Stat tiles */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statEmoji}>🔥</Text>
            <Text style={styles.statValue}>{stats.currentStreakDays}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statEmoji}>⏱️</Text>
            <Text style={styles.statValue}>{stats.weekMinutes}</Text>
            <Text style={styles.statLabel}>Min this week</Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statEmoji}>✅</Text>
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {/* 7-day activity */}
        <View style={styles.activityCard}>
          <Text style={styles.cardLabel}>LAST 7 DAYS · MINUTES</Text>
          <View style={styles.barsRow}>
            {stats.last7Days.map((day, i) => {
              const isToday = i === stats.last7Days.length - 1;
              const height = day.minutes > 0
                ? Math.max(8, (day.minutes / maxMinutes) * BAR_MAX_HEIGHT)
                : 0;
              return (
                <View key={day.key} style={styles.barSlot}>
                  <View style={styles.barTrack}>
                    {isToday && day.minutes > 0 && (
                      <Text style={styles.barValue}>{day.minutes}</Text>
                    )}
                    {day.minutes > 0
                      ? <View style={[styles.bar, { height }]} />
                      : <View style={styles.barEmptyDot} />}
                  </View>
                  <Text style={[styles.barLabel, isToday && styles.barLabelToday]}>
                    {isToday ? 'Today' : day.label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Session log */}
        {isEmpty ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🧘‍♀️</Text>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>
              Complete a timed practice, a custom set, or Surya Namaskar and it will show up here.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Start Practicing →</Text>
            </TouchableOpacity>
          </View>
        ) : (
          groups.map(group => (
            <View key={group.key}>
              <Text style={styles.groupTitle}>{group.title.toUpperCase()}</Text>
              {group.sessions.map(session => {
                const meta = TYPE_META[session.type] || TYPE_META.routine;
                const partial = session.posesCompleted < session.poseCount;
                const time = new Date(session.completedAt)
                  .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
                return (
                  <View key={session.id} style={styles.sessionRow}>
                    <View style={styles.sessionIconBox}>
                      <Text style={styles.sessionEmoji}>{meta.emoji}</Text>
                    </View>
                    <View style={styles.sessionInfo}>
                      <Text style={styles.sessionTitle}>{session.title}</Text>
                      <Text style={styles.sessionMeta}>
                        {meta.label} · {session.posesCompleted}/{session.poseCount} poses
                        {partial ? ' · ended early' : ''}
                      </Text>
                    </View>
                    <View style={styles.sessionRight}>
                      <Text style={styles.sessionDuration}>{formatDuration(session.durationSec)}</Text>
                      <Text style={styles.sessionTime}>{time}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.headerLarge, color: colors.primary, marginBottom: 4 },
  subtitle: { ...typography.bodySmall, color: colors.textLight, marginBottom: spacing.md },

  /* Stat tiles */
  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statTile: {
    flex: 1, backgroundColor: colors.card, borderRadius: borderRadius.lg,
    paddingVertical: spacing.md, alignItems: 'center',
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  statEmoji: { fontSize: 18, marginBottom: 4 },
  statValue: { ...typography.headerMedium, color: colors.text },
  statLabel: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 11 },

  /* Activity bars */
  activityCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.lg, ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  cardLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md },
  barsRow: { flexDirection: 'row', gap: spacing.sm },
  barSlot: { flex: 1, alignItems: 'center' },
  barTrack: {
    height: BAR_MAX_HEIGHT + 18, // room for the value label above today's bar
    justifyContent: 'flex-end', alignItems: 'center', alignSelf: 'stretch',
  },
  barValue: { ...typography.caption, color: colors.text, fontWeight: '700', marginBottom: 3 },
  bar: {
    width: 14, backgroundColor: colors.primary,
    borderTopLeftRadius: 4, borderTopRightRadius: 4,
  },
  barEmptyDot: { width: 14, height: 3, borderRadius: 2, backgroundColor: colors.border },
  barLabel: { ...typography.caption, color: colors.textMuted, marginTop: 6, fontSize: 10 },
  barLabelToday: { color: colors.text, fontWeight: '700' },

  /* Session log */
  groupTitle: { ...typography.label, color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.sm },
  sessionRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm,
    ...shadows.soft, borderWidth: 1, borderColor: colors.borderLight,
  },
  sessionIconBox: {
    width: 40, height: 40, borderRadius: borderRadius.sm, backgroundColor: colors.cardAlt,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm,
  },
  sessionEmoji: { fontSize: 18 },
  sessionInfo: { flex: 1 },
  sessionTitle: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  sessionMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  sessionRight: { alignItems: 'flex-end' },
  sessionDuration: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  sessionTime: { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { ...typography.headerSmall, color: colors.text, marginBottom: spacing.xs },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    paddingVertical: 12, paddingHorizontal: spacing.lg, marginTop: spacing.md, ...shadows.prominent,
  },
  emptyBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
});

export default HistoryScreen;
