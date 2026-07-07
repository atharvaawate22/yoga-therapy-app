/**
 * User Storage - AsyncStorage helpers for profile & custom sets
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_KEY = '@yoga_user_profile';
const CUSTOM_SETS_KEY = '@yoga_custom_sets';
const ONBOARDED_KEY = '@yoga_onboarded';

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

/** Get all custom yoga sets */
export const getCustomSets = async () => {
  try {
    const json = await AsyncStorage.getItem(CUSTOM_SETS_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
};

/** Save a new custom set */
export const saveCustomSet = async (set) => {
  const sets = await getCustomSets();
  const newSet = {
    ...set,
    id: `set_${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  sets.push(newSet);
  await AsyncStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(sets));
  return newSet;
};

/** Delete a custom set by id */
export const deleteCustomSet = async (id) => {
  const sets = await getCustomSets();
  const filtered = sets.filter(s => s.id !== id);
  await AsyncStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(filtered));
};

/** Update a custom set */
export const updateCustomSet = async (id, updates) => {
  const sets = await getCustomSets();
  const idx = sets.findIndex(s => s.id === id);
  if (idx >= 0) {
    sets[idx] = { ...sets[idx], ...updates };
    await AsyncStorage.setItem(CUSTOM_SETS_KEY, JSON.stringify(sets));
  }
};
