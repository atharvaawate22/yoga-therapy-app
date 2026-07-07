/**
 * CustomSetScreen - Create and manage custom yoga pose sets
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import { getAllPoses } from '../data/yogaData';
import { getCustomSets, saveCustomSet, deleteCustomSet } from '../data/userStorage';
import ExperienceBadge from '../components/ExperienceBadge';
import { resolveImageSource } from '../utils/imageUtils';

const CustomSetScreen = ({ navigation }) => {
  const [mode, setMode] = useState('list'); // 'list' | 'create'
  const [sets, setSets] = useState([]);
  const [setName, setSetName] = useState('');
  const [selectedPoses, setSelectedPoses] = useState([]);
  const allPoses = getAllPoses();

  const loadSets = useCallback(async () => {
    const data = await getCustomSets();
    setSets(data);
  }, []);

  useEffect(() => { loadSets(); }, [loadSets]);

  const togglePose = (poseId) => {
    setSelectedPoses(prev =>
      prev.includes(poseId) ? prev.filter(id => id !== poseId) : [...prev, poseId]
    );
  };

  const handleSave = async () => {
    if (!setName.trim()) {
      Alert.alert('Name Required', 'Please enter a name for your set.');
      return;
    }
    if (selectedPoses.length === 0) {
      Alert.alert('Select Poses', 'Please select at least one pose.');
      return;
    }
    const poses = allPoses.filter(p => selectedPoses.includes(p.id));
    await saveCustomSet({ name: setName.trim(), poses });
    setSetName('');
    setSelectedPoses([]);
    setMode('list');
    await loadSets();
    Alert.alert('Saved!', 'Your custom set has been created.');
  };

  const handleDelete = (id, name) => {
    Alert.alert('Delete Set', `Delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCustomSet(id);
        await loadSets();
      }},
    ]);
  };

  const handlePlaySet = (set) => {
    navigation.navigate('PoseScreen', { problemName: set.name, poses: set.poses });
  };

  if (mode === 'create') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>Create Custom Set</Text>
          <TextInput
            style={styles.input}
            placeholder="Set name (e.g. Morning Routine)"
            placeholderTextColor={colors.textMuted}
            value={setName}
            onChangeText={setSetName}
          />
          <Text style={styles.sectionLabel}>
            SELECT POSES ({selectedPoses.length} selected)
          </Text>
          {allPoses.map(pose => {
            const selected = selectedPoses.includes(pose.id);
            const imgSrc = resolveImageSource(pose.image);
            return (
              <TouchableOpacity
                key={pose.id}
                style={[styles.poseRow, selected && styles.poseRowActive]}
                onPress={() => togglePose(pose.id)}
                activeOpacity={0.8}
              >
                <Image source={imgSrc} style={styles.poseThumb} />
                <View style={styles.poseInfo}>
                  <Text style={styles.poseName}>{pose.name}</Text>
                  <ExperienceBadge level={pose.difficulty} small />
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                  {selected && <Text style={styles.check}>✓</Text>}
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setMode('list')} activeOpacity={0.8}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Text style={styles.saveBtnText}>Save Set</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // List mode
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>My Custom Sets</Text>
        <Text style={styles.subtitle}>Create your own yoga routines</Text>

        <TouchableOpacity style={styles.createBtn} onPress={() => setMode('create')} activeOpacity={0.85}>
          <Text style={styles.createBtnIcon}>＋</Text>
          <Text style={styles.createBtnText}>Create New Set</Text>
        </TouchableOpacity>

        {sets.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📋</Text>
            <Text style={styles.emptyText}>No custom sets yet.{'\n'}Tap above to create one!</Text>
          </View>
        ) : (
          sets.map(set => (
            <View key={set.id} style={styles.setCard}>
              <TouchableOpacity style={styles.setCardBody} onPress={() => handlePlaySet(set)} activeOpacity={0.8}>
                <Text style={styles.setName}>{set.name}</Text>
                <Text style={styles.setMeta}>{set.poses?.length || 0} poses</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(set.id, set.name)}>
                <Text style={styles.deleteBtnText}>🗑️</Text>
              </TouchableOpacity>
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
  subtitle: { ...typography.bodySmall, color: colors.textLight, marginBottom: spacing.lg },
  sectionLabel: { ...typography.label, color: colors.primary, marginBottom: spacing.sm, marginTop: spacing.md },
  input: {
    backgroundColor: colors.card, borderRadius: borderRadius.md, padding: spacing.md,
    ...typography.body, color: colors.text, borderWidth: 1, borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  poseRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.md, padding: spacing.sm, marginBottom: spacing.sm,
    borderWidth: 1.5, borderColor: colors.borderLight, ...shadows.soft,
  },
  poseRowActive: { borderColor: colors.primary, backgroundColor: '#F0F9F0' },
  poseThumb: { width: 50, height: 50, borderRadius: borderRadius.sm, backgroundColor: colors.backgroundDark, marginRight: spacing.sm },
  poseInfo: { flex: 1 },
  poseName: { ...typography.bodySmall, fontWeight: '600', color: colors.text, marginBottom: 3 },
  checkbox: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: colors.border, justifyContent: 'center', alignItems: 'center',
  },
  checkboxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.textWhite, fontSize: 14, fontWeight: '800' },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg,
    backgroundColor: colors.cardAlt, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  cancelBtnText: { ...typography.bodySmall, fontWeight: '600', color: colors.text },
  saveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: borderRadius.lg,
    backgroundColor: colors.primary, alignItems: 'center', ...shadows.prominent,
  },
  saveBtnText: { ...typography.bodySmall, fontWeight: '700', color: colors.textWhite },
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: borderRadius.xl,
    paddingVertical: 14, marginBottom: spacing.lg, ...shadows.prominent,
  },
  createBtnIcon: { fontSize: 20, color: colors.textWhite, marginRight: spacing.sm },
  createBtnText: { ...typography.headerSmall, color: colors.textWhite, fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  setCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm,
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  setCardBody: { flex: 1 },
  setName: { ...typography.headerSmall, fontSize: 16, color: colors.text },
  setMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  deleteBtn: { padding: spacing.sm },
  deleteBtnText: { fontSize: 18 },
});

export default CustomSetScreen;
