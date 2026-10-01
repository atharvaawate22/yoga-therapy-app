/**
 * User Storage - AsyncStorage helpers for profile & custom sets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllPoses } from './yogaData';

const PROFILE_KEY = '@yoga_user_profile';
const CUSTOM_SETS_KEY = '@yoga_custom_sets';
const ONBOARDED_KEY = '@yoga_onboarded';
const FAVORITES_KEY = '@yoga_favorite_poses';
const VOICE_KEY = '@yoga_voice_enabled';

// Default profile
const defaultProfile = {
  name: 'Yogi',
  age: 25,
  experience: 'beginner', // beginner | intermediate | expert
};

/** Check if user has completed onboarding */
export const isOnboarded = async () => {
  try {
    const val = await AsyncStorage.getItem(ONBOARDED_KEY);
    return val === 'true';
  } catch { return false; }
};

/** Mark onboarding as complete */
export const setOnboarded = async () => {
  await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
};

/** Get user profile */
export const getUserProfile = async () => {
  try {
    const json = await AsyncStorage.getItem(PROFILE_KEY);
    return json ? JSON.parse(json) : defaultProfile;
  } catch { return defaultProfile; }
};

/** Save user profile */
export const setUserProfile = async (profile) => {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

// Custom sets are stored as pose ids only and resolved against yogaData on
// read. Storing whole pose objects froze their text at save time and kept
// `require()` image handles, which are bundle-specific numbers that can point
// at the wrong image (or none) after an app update.
//
// Stored: { id, name, poseIds: string[], createdAt }
// Returned by getCustomSets: the same plus `poses` (resolved pose objects).

const readStoredSets = async () => {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_SETS_KEY);
    const sets = json ? JSON.parse(json) : [];
    // Sets saved by older builds hold full `poses` objects instead of ids.
    return sets.map(({ poses, ...set }) => ({
      ...set,
      poseIds: set.poseIds || (poses || []).map(p => p.id).filter(Boolean),
    }));
  } catch { return []; }
};

const writeStoredSets = (sets) =>
  AsyncStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(
    sets.map(({ id, name, poseIds, createdAt }) => ({ id, name, poseIds, createdAt }))
  ));

/** Get all custom yoga sets, with `poses` resolved from their ids */
export const getCustomSets = async () => {
  const sets = await readStoredSets();
  const byId = new Map(getAllPoses().map(p => [p.id, p]));
  return sets.map(set => ({
    ...set,
    poses: set.poseIds.map(id => byId.get(id)).filter(Boolean),
  }));
};

/** Save a new custom set: { name, poseIds } */
export const saveCustomSet = async ({ name, poseIds }) => {
  const sets = await readStoredSets();
  const newSet = {
    id: `set_${Date.now()}`,
    name,
    poseIds,
    createdAt: new Date().toISOString(),
  };
  sets.push(newSet);
  await writeStoredSets(sets);
  return newSet;
};

/** Delete a custom set by id */
export const deleteCustomSet = async (id) => {
  const sets = await readStoredSets();
  await writeStoredSets(sets.filter(s => s.id !== id));
};

/** Update a custom set: updates may contain { name, poseIds } */
export const updateCustomSet = async (id, updates) => {
  const sets = await readStoredSets();
  const idx = sets.findIndex(s => s.id === id);
  if (idx >= 0) {
    sets[idx] = { ...sets[idx], ...updates };
    await writeStoredSets(sets);
  }
};

/** Get favorite pose ids */
export const getFavoriteIds = async () => {
  try {
    const json = await AsyncStorage.getItem(FAVORITES_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
};

/** Toggle a pose id in favorites; returns the new favorite state */
export const toggleFavorite = async (poseId) => {
  const ids = await getFavoriteIds();
  const isFav = ids.includes(poseId);
  const next = isFav ? ids.filter(id => id !== poseId) : [...ids, poseId];
  await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
  return !isFav;
};

/** Global voice guidance preference (default: on) */
export const getVoiceEnabled = async () => {
  try {
    const val = await AsyncStorage.getItem(VOICE_KEY);
    return val === null ? true : val === 'true';
  } catch { return true; }
};

export const setVoiceEnabled = async (enabled) => {
  await AsyncStorage.setItem(VOICE_KEY, String(enabled));
};
