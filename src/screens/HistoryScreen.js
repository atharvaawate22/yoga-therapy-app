/**
 * HistoryScreen - Practice history, streak and weekly stats
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, screenStyles, gradients } from '../theme/theme';
import { getPracticeSessions, getPracticeStats, groupSessionsByDay, formatDuration } from '../data/sessionStorage';
import WeeklyStreakStrip from '../components/WeeklyStreakStrip';

const TYPE_META = {
  routine: { icon: 'body-outline', label: 'Routine' },
  custom: { icon: 'list-outline', label: 'Custom set' },
  single: { icon: 'radio-button-on-outline', label: 'Single pose' },
  surya: { icon: 'sunny', label: 'Surya Namaskar' },
  corrector: { icon: 'camera', label: 'Pose corrector' },
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
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text style={styles.statValue}>{stats.currentStreakDays}</Text>
            <Text style={styles.statLabel}>Day streak</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="time-outline" size={18} color={colors.info} />
            <Text style={styles.statValue}>{stats.weekMinutes}</Text>
            <Text style={styles.statLabel}>Min this week</Text>
          </View>
          <View style={styles.statTile}>
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.statValue}>{stats.totalSessions}</Text>
            <Text style={styles.statLabel}>Sessions</Text>
          </View>
        </View>

        {/* Weekly streak strip */}
        <WeeklyStreakStrip last7Days={stats.last7Days} currentStreakDays={stats.currentStreakDays} />

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
                      ? (
                        <LinearGradient
                          colors={isToday ? gradients.streak : [colors.primaryLight, colors.primary]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 0, y: 1 }}
                          style={[styles.bar, { height }]}
                        />
                      )
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
            <View style={styles.emptyIconBox}>
              <Ionicons name="body-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptyText}>
              Complete a timed practice, a custom set, or Surya Namaskar and it will show up here.
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Home')}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>Start Practicing</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textWhite} />
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
                      <Ionicons name={meta.icon} size={18} color={colors.primary} />
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
  statValue: { ...typography.headerMedium, color: colors.text, marginTop: 4 },
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
    width: 14,
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
  sessionInfo: { flex: 1 },
  sessionTitle: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  sessionMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  sessionRight: { alignItems: 'flex-end' },
  sessionDuration: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  sessionTime: { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  /* Empty state */
  emptyState: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  emptyIconBox: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.backgroundDark,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.md,
  },
  emptyTitle: { ...typography.headerSmall, color: colors.text, marginBottom: spacing.xs },
  emptyText: { ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    paddingVertical: 12, paddingHorizontal: spacing.lg, marginTop: spacing.md, ...shadows.prominent,
  },
  emptyBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
});

export default HistoryScreen;
