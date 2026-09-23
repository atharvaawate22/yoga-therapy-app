/**
 * CustomSetScreen - Create and manage custom yoga pose sets
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Alert, Image
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing, borderRadius, shadows, screenStyles } from '../theme/theme';
import { getAllPoses } from '../data/yogaData';
import { getCustomSets, saveCustomSet, deleteCustomSet, updateCustomSet } from '../data/userStorage';
import ExperienceBadge from '../components/ExperienceBadge';
import { resolveImageSource } from '../utils/imageUtils';

const CustomSetScreen = ({ navigation }) => {
  const [mode, setMode] = useState('list'); // 'list' | 'edit' (edit covers create too)
  const [editingId, setEditingId] = useState(null); // null = creating a new set
  const [sets, setSets] = useState([]);
  const [setName, setSetName] = useState('');
  const [selectedPoses, setSelectedPoses] = useState([]); // ordered pose ids
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

  const movePose = (index, direction) => {
    setSelectedPoses(prev => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const startCreate = () => {
    setEditingId(null);
    setSetName('');
    setSelectedPoses([]);
    setMode('edit');
  };

  const startEdit = (set) => {
    setEditingId(set.id);
    setSetName(set.name);
    setSelectedPoses((set.poses || []).map(p => p.id));
    setMode('edit');
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
    // Map ids → poses in the user's chosen order
    const poses = selectedPoses
      .map(id => allPoses.find(p => p.id === id))
      .filter(Boolean);
    if (editingId) {
      await updateCustomSet(editingId, { name: setName.trim(), poses });
    } else {
      await saveCustomSet({ name: setName.trim(), poses });
    }
    setSetName('');
    setSelectedPoses([]);
    setEditingId(null);
    setMode('list');
    await loadSets();
    Alert.alert('Saved!', editingId ? 'Your custom set has been updated.' : 'Your custom set has been created.');
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

  const handleViewSet = (set) => {
    navigation.navigate('PoseScreen', { problemName: set.name, poses: set.poses });
  };

  const handlePlaySet = (set) => {
    navigation.navigate('PracticeSession', {
      title: set.name,
      poses: set.poses || [],
      sourceType: 'custom',
    });
  };

  if (mode === 'edit') {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{editingId ? 'Edit Custom Set' : 'Create Custom Set'}</Text>
          <TextInput
            style={styles.input}
            placeholder="Set name (e.g. Morning Routine)"
            placeholderTextColor={colors.textMuted}
            value={setName}
            onChangeText={setSetName}
          />

          {/* Ordered selection with reorder controls */}
          {selectedPoses.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>POSE ORDER</Text>
              {selectedPoses.map((id, index) => {
                const p = allPoses.find(pose => pose.id === id);
                if (!p) return null;
                return (
                  <View key={id} style={styles.orderRow}>
                    <Text style={styles.orderIndex}>{index + 1}</Text>
                    <Text style={styles.orderName} numberOfLines={1}>{p.name}</Text>
                    <TouchableOpacity
                      style={[styles.orderBtn, index === 0 && styles.orderBtnDisabled]}
                      onPress={() => movePose(index, -1)}
                      disabled={index === 0}
                    >
                      <Ionicons name="arrow-up" size={15} color={index === 0 ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orderBtn, index === selectedPoses.length - 1 && styles.orderBtnDisabled]}
                      onPress={() => movePose(index, 1)}
                      disabled={index === selectedPoses.length - 1}
                    >
                      <Ionicons name="arrow-down" size={15} color={index === selectedPoses.length - 1 ? colors.textMuted : colors.primary} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </>
          )}

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
                  {selected && <Ionicons name="checkmark" size={14} color={colors.textWhite} />}
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

        <TouchableOpacity style={styles.createBtn} onPress={startCreate} activeOpacity={0.85}>
          <Ionicons name="add" size={20} color={colors.textWhite} style={styles.createBtnIcon} />
          <Text style={styles.createBtnText}>Create New Set</Text>
        </TouchableOpacity>

        {sets.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="clipboard-outline" size={44} color={colors.textMuted} />
            <Text style={styles.emptyText}>No custom sets yet.{'\n'}Tap above to create one!</Text>
          </View>
        ) : (
          sets.map(set => (
            <View key={set.id} style={styles.setCard}>
              <TouchableOpacity style={styles.setCardBody} onPress={() => handleViewSet(set)} activeOpacity={0.8}>
                <Text style={styles.setName}>{set.name}</Text>
                <Text style={styles.setMeta}>{set.poses?.length || 0} poses · tap to view</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.playBtn} onPress={() => handlePlaySet(set)} activeOpacity={0.8}>
                <Ionicons name="play" size={15} color={colors.textWhite} style={{ marginLeft: 2 }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.editBtn} onPress={() => startEdit(set)}>
                <Ionicons name="create-outline" size={19} color={colors.textLight} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(set.id, set.name)}>
                <Ionicons name="trash-outline" size={19} color={colors.error} />
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
  createBtnIcon: { marginRight: spacing.sm },
  createBtnText: { ...typography.headerSmall, color: colors.textWhite, fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyText: { ...typography.body, color: colors.textMuted, textAlign: 'center', lineHeight: 24 },
  setCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.sm,
    ...shadows.card, borderWidth: 1, borderColor: colors.borderLight,
  },
  setCardBody: { flex: 1 },
  setName: { ...typography.headerSmall, fontSize: 16, color: colors.text },
  setMeta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  playBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center', marginRight: spacing.xs,
    ...shadows.soft,
  },
  editBtn: { padding: spacing.sm },
  deleteBtn: { padding: spacing.sm },

  /* Reorder rows */
  orderRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt,
    borderRadius: borderRadius.md, paddingVertical: 6, paddingHorizontal: spacing.sm,
    marginBottom: 4, borderWidth: 1, borderColor: colors.borderLight,
  },
  orderIndex: {
    ...typography.caption, fontWeight: '800', color: colors.primary,
    width: 22, textAlign: 'center',
  },
  orderName: { ...typography.bodySmall, color: colors.text, flex: 1, marginHorizontal: spacing.sm },
  orderBtn: {
    width: 32, height: 32, borderRadius: borderRadius.sm, backgroundColor: colors.card,
    justifyContent: 'center', alignItems: 'center', marginLeft: 4,
    borderWidth: 1, borderColor: colors.border,
  },
  orderBtnDisabled: { opacity: 0.3 },
});

export default CustomSetScreen;
