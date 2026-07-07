/**
 * HealthScanScreen - Search health problems and get yoga recommendations
 */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import yogaData from '../data/yogaData';
import { getUserProfile } from '../data/userStorage';
import ProblemCard from '../components/ProblemCard';

const categories = {
  'Physical': ['Back Pain', 'Hip Alignment Issue', 'Scapula Winging', 'Knee Pain', 'Poor Posture'],
  'Mental': ['Stress', 'Anxiety', 'Insomnia', 'Headache'],
  'Lifestyle': ['Digestion Issues', 'Weight Loss'],
};

const HealthScanScreen = ({ navigation }) => {
  const [search, setSearch] = useState('');
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    getUserProfile().then(setProfile);
  }, []);

  const allProblems = Object.keys(yogaData);
  const filtered = search.trim()
    ? allProblems.filter(p => p.toLowerCase().includes(search.toLowerCase()))
    : null;

  const filterByExperience = (poses) => {
    if (!profile) return poses;
    const exp = profile.experience;
    if (exp === 'beginner') return poses.filter(p => p.difficulty === 'beginner');
    if (exp === 'intermediate') return poses.filter(p => p.difficulty !== 'advanced');
    return poses; // expert sees all
  };

  const handleProblemPress = (problemName) => {
    const poses = filterByExperience(yogaData[problemName]);
    navigation.navigate('PoseScreen', { problemName, poses });
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Health Scanner</Text>
        <Text style={styles.subtitle}>
          Tell us your problem — we'll recommend the right yoga poses
          {profile ? ` for ${profile.experience} level` : ''}.
        </Text>

        {/* Search */}
        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search health conditions..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Text style={styles.clearBtn}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Search Results */}
        {filtered ? (
          <View>
            <Text style={styles.resultCount}>{filtered.length} condition{filtered.length !== 1 ? 's' : ''} found</Text>
            {filtered.map((name, i) => (
              <ProblemCard
                key={i}
                problemName={name}
                poseCount={filterByExperience(yogaData[name]).length}
                onPress={() => handleProblemPress(name)}
              />
            ))}
            {filtered.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🤷</Text>
                <Text style={styles.emptyText}>No matching conditions found.{'\n'}Try a different search term.</Text>
              </View>
            )}
          </View>
        ) : (
          /* Category Browse */
          Object.entries(categories).map(([category, problems]) => (
            <View key={category}>
              <Text style={styles.categoryLabel}>{category.toUpperCase()}</Text>
              {problems.filter(p => yogaData[p]).map((name, i) => (
                <ProblemCard
                  key={i}
                  problemName={name}
                  poseCount={filterByExperience(yogaData[name]).length}
                  onPress={() => handleProblemPress(name)}
                />
              ))}
            </View>
          ))
        )}

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            Poses are filtered based on your experience level ({profile?.experience || 'beginner'}).
            Update your profile to see different recommendations.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scroll: { padding: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.headerLarge, color: colors.primary, marginBottom: 4 },
  subtitle: { ...typography.bodySmall, color: colors.textLight, marginBottom: spacing.md, lineHeight: 20 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.xl, paddingHorizontal: spacing.md, paddingVertical: 4,
    marginBottom: spacing.lg, ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  searchIcon: { fontSize: 16, marginRight: spacing.sm },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: 10 },
  clearBtn: { fontSize: 16, color: colors.textMuted, padding: spacing.sm },
  resultCount: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  categoryLabel: {
    ...typography.label, color: colors.primary, marginTop: spacing.lg,
    marginBottom: spacing.sm, marginLeft: spacing.md,
  },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start', backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.lg, padding: spacing.md, marginTop: spacing.lg,
    borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  infoIcon: { fontSize: 18, marginRight: spacing.sm, marginTop: 2 },
  infoText: { ...typography.bodySmall, color: colors.textLight, flex: 1, lineHeight: 20 },
});

export default HealthScanScreen;
