/**
 * HomeScreen - Main screen with prominent Live Pose Corrector + all features
 */
import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, typography, spacing, borderRadius, shadows, screenStyles, gradients } from '../theme/theme';
import yogaData, { getAllPoses } from '../data/yogaData';
import { getUserProfile, getFavoriteIds } from '../data/userStorage';
import { getPracticeStats } from '../data/sessionStorage';
import { resolveImageSource } from '../utils/imageUtils';
import ProblemCard from '../components/ProblemCard';
import ExperienceBadge from '../components/ExperienceBadge';
import WeeklyStreakStrip from '../components/WeeklyStreakStrip';

const HomeScreen = ({ navigation }) => {
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const problems = Object.keys(yogaData);

  useFocusEffect(
    useCallback(() => {
      getUserProfile().then(setProfile);
      getPracticeStats().then(setStats);
      getFavoriteIds().then(ids => {
        const all = getAllPoses();
        setFavorites(ids.map(id => all.find(p => p.id === id)).filter(Boolean));
      });
    }, [])
  );

  const handleProblemPress = (problemName) => {
    navigation.navigate('PoseScreen', { problemName, poses: yogaData[problemName] });
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.headerLeft}>
              <Text style={styles.greeting}>{greeting()}</Text>
              <Text style={styles.userName}>{profile?.name || 'Yogi'} 🙏</Text>
            </View>
            <TouchableOpacity
              style={styles.profileBtn}
              onPress={() => navigation.navigate('ProfileSetup')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-circle-outline" size={26} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {profile && (
            <View style={styles.headerBadge}>
              <ExperienceBadge level={profile.experience} />
            </View>
          )}
        </View>

        {/* ── Weekly streak ── */}
        {stats && (stats.totalSessions > 0) && (
          <TouchableOpacity
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.9}
          >
            <WeeklyStreakStrip
              last7Days={stats.last7Days}
              currentStreakDays={stats.currentStreakDays}
            />
          </TouchableOpacity>
        )}

        {/* ── Hero Banner: Live Pose Corrector (main feature) ── */}
        <TouchableOpacity
          onPress={() => navigation.navigate('PoseCorrector')}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={gradients.hero}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.poseCoachBanner}
          >
            <View style={styles.poseCoachLeft}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
            <View style={styles.poseCoachCenter}>
              <View style={styles.poseCoachIconBox}>
                <Ionicons name="camera" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.poseCoachTitle}>Live Mobile Pose Corrector</Text>
                <Text style={styles.poseCoachDesc}>
                  Open camera · AI detects your pose · Get real-time corrections
                </Text>
                <Text style={styles.poseCoachSub}>
                  Experience: {profile?.experience || 'beginner'} mode active
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={22} color="#FFFFFF" />
          </LinearGradient>
        </TouchableOpacity>

        {/* ── Quick Actions Row ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SuryaNamaskar')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FF8A6518' }]}>
              <Ionicons name="sunny" size={20} color="#FF8A65" />
            </View>
            <Text style={styles.actionTitle}>Surya Namaskar</Text>
            <Text style={styles.actionDesc}>Sun Salutation</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('CustomSet')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#4DB6AC18' }]}>
              <Ionicons name="list-outline" size={20} color="#4DB6AC" />
            </View>
            <Text style={styles.actionTitle}>My Custom Sets</Text>
            <Text style={styles.actionDesc}>Build routines</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('HealthScan')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#7986CB18' }]}>
              <MaterialCommunityIcons name="stethoscope" size={20} color="#7986CB" />
            </View>
            <Text style={styles.actionTitle}>Health Scanner</Text>
            <Text style={styles.actionDesc}>Find by problem</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('History')}
            activeOpacity={0.8}
          >
            <View style={[styles.actionIconBox, { backgroundColor: '#FFB74D18' }]}>
              <Ionicons name="stats-chart-outline" size={20} color="#FFB74D" />
            </View>
            <Text style={styles.actionTitle}>My Progress</Text>
            <Text style={styles.actionDesc}>
              {stats?.totalSessions ? `${stats.totalSessions} sessions` : 'History & streaks'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Your Favorites ── */}
        {favorites.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={13} color={colors.error} />
                <Text style={styles.sectionTitle}>Your Favorites</Text>
              </View>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.favoritesRow}
            >
              {favorites.map(p => (
                <TouchableOpacity
                  key={p.id}
                  style={styles.favCard}
                  onPress={() => navigation.navigate('PoseDetail', { pose: p })}
                  activeOpacity={0.85}
                >
                  <Image source={resolveImageSource(p.image)} style={styles.favImage} />
                  <Text style={styles.favName} numberOfLines={1}>{p.name}</Text>
                  <Text style={styles.favDuration}>{p.duration}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </>
        )}

        {/* ── Choose by Condition ── */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>Choose a condition</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.problemsList}>
          {problems.map((problemName, index) => (
            <ProblemCard
              key={index}
              problemName={problemName}
              poseCount={yogaData[problemName].length}
              onPress={() => handleProblemPress(problemName)}
            />
          ))}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            🌿 Practice yoga safely. Consult a professional if needed.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scrollContent: { paddingBottom: spacing.xl },

  /* Header */
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1 },
  greeting: { ...typography.bodySmall, color: colors.textMuted, fontWeight: '500' },
  userName: { ...typography.headerLarge, color: colors.primary, fontSize: 26, marginTop: 2 },
  profileBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.card, justifyContent: 'center', alignItems: 'center',
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  headerBadge: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  /* Live Pose Corrector Banner */
  poseCoachBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    ...shadows.prominent,
  },
  poseCoachLeft: {
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#69F0AE',
    marginBottom: 3,
  },
  liveLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#69F0AE',
    letterSpacing: 1,
  },
  poseCoachCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  poseCoachIconBox: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    justifyContent: 'center', alignItems: 'center',
    marginRight: spacing.sm,
  },
  poseCoachTitle: {
    ...typography.headerSmall,
    color: colors.textWhite,
    fontSize: 15,
  },
  poseCoachDesc: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    lineHeight: 15,
  },
  poseCoachSub: {
    ...typography.caption,
    color: '#69F0AE',
    marginTop: 3,
    fontWeight: '600',
    fontSize: 10,
  },

  /* Section Header */
  sectionHeader: {
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.primary,
  },

  /* Quick Actions */
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionCard: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionIconBox: {
    width: 40, height: 40, borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm,
  },
  actionEmoji: { fontSize: 20 },
  actionTitle: { ...typography.caption, fontWeight: '700', color: colors.text },
  actionDesc: { ...typography.caption, color: colors.textMuted, marginTop: 1, fontSize: 10 },

  /* Favorites */
  favoritesRow: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  favCard: {
    width: 120,
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    ...shadows.card,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  favImage: {
    width: '100%',
    height: 76,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundDark,
    marginBottom: spacing.sm,
  },
  favName: { ...typography.caption, fontWeight: '700', color: colors.text },
  favDuration: { ...typography.caption, color: colors.textMuted, fontSize: 10, marginTop: 1 },

  /* Divider */
  divider: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.lg, marginVertical: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: {
    ...typography.label, color: colors.textMuted,
    paddingHorizontal: spacing.md, fontSize: 10,
  },

  problemsList: { paddingBottom: spacing.md },

  footer: {
    alignItems: 'center', paddingVertical: spacing.lg, paddingHorizontal: spacing.xl,
  },
  footerText: {
    ...typography.bodySmall, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic',
  },
});

export default HomeScreen;
