/**
 * RoundSelector - Animated round counter for Surya Namaskar
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, borderRadius, spacing, typography, shadows } from '../theme/theme';

const RoundSelector = ({ rounds, setRounds, min = 1, max = 12 }) => {
  const decrease = () => setRounds(Math.max(min, rounds - 1));
  const increase = () => setRounds(Math.min(max, rounds + 1));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>NUMBER OF ROUNDS</Text>
      <View style={styles.row}>
        <TouchableOpacity
          style={[styles.btn, rounds <= min && styles.btnDisabled]}
          onPress={decrease}
          disabled={rounds <= min}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, rounds <= min && styles.btnTextDisabled]}>−</Text>
        </TouchableOpacity>
        <View style={styles.valueBox}>
          <Text style={styles.value}>{rounds}</Text>
          <Text style={styles.valueLabel}>{rounds === 1 ? 'round' : 'rounds'}</Text>
        </View>
        <TouchableOpacity
          style={[styles.btn, rounds >= max && styles.btnDisabled]}
          onPress={increase}
          disabled={rounds >= max}
          activeOpacity={0.7}
        >
          <Text style={[styles.btnText, rounds >= max && styles.btnTextDisabled]}>+</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.hint}>
        ≈ {Math.round(rounds * 1.5)} min • {rounds * 12} poses total
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.card,
  },
  label: {
    ...typography.label,
    color: colors.primary,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.soft,
  },
  btnDisabled: {
    backgroundColor: colors.borderLight,
  },
  btnText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textWhite,
  },
  btnTextDisabled: {
    color: colors.textMuted,
  },
  valueBox: {
    alignItems: 'center',
    marginHorizontal: spacing.xl,
  },
  value: {
    fontSize: 48,
    fontWeight: '800',
    color: colors.primary,
  },
  valueLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: -4,
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
});

export default RoundSelector;
