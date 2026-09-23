/**
 * WeeklyStreakStrip - Mon-Sun (rolling 7-day) practice strip with a streak flame.
 * Consumes `last7Days` / `currentStreakDays` from getPracticeStats().
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, gradients } from '../theme/theme';

const WeeklyStreakStrip = ({ last7Days = [], currentStreakDays = 0 }) => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.streakInfo}>
          <LinearGradient
            colors={gradients.streak}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.flameBadge}
          >
            <Ionicons name="flame" size={16} color="#FFFFFF" />
          </LinearGradient>
          <View>
            <Text style={styles.streakValue}>
              {currentStreakDays} {currentStreakDays === 1 ? 'day' : 'days'}
            </Text>
            <Text style={styles.streakLabel}>Current streak</Text>
          </View>
        </View>
      </View>

      <View style={styles.daysRow}>
        {last7Days.map((day, i) => {
          const isToday = i === last7Days.length - 1;
          const practiced = day.count > 0;
          return (
            <View key={day.key} style={styles.dayCol}>
              <View
                style={[
                  styles.dayDot,
                  practiced && styles.dayDotFilled,
                  isToday && styles.dayDotToday,
                ]}
              >
                {practiced ? (
                  <Ionicons name="checkmark" size={13} color="#FFFFFF" />
                ) : (
                  <View style={styles.dayDotEmpty} />
                )}
              </View>
              <Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>
                {day.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  streakInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flameBadge: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  streakValue: { ...typography.headerSmall, color: colors.text, fontSize: 16 },
  streakLabel: { ...typography.caption, color: colors.textMuted, marginTop: 1 },

  daysRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', flex: 1 },
  dayDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.backgroundDark,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.border,
  },
  dayDotFilled: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayDotToday: {
    borderColor: colors.accentWarm,
    borderWidth: 2,
  },
  dayDotEmpty: {
    width: 5, height: 5, borderRadius: 2.5, backgroundColor: colors.textMuted,
  },
  dayLabel: { ...typography.caption, color: colors.textMuted, marginTop: 5, fontSize: 10 },
  dayLabelToday: { color: colors.text, fontWeight: '700' },
});

export default WeeklyStreakStrip;
