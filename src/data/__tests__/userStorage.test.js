import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllPoses } from '../yogaData';
import { getCustomSets, saveCustomSet, updateCustomSet, deleteCustomSet } from '../userStorage';

const KEY = '@yoga_custom_sets';

beforeEach(() => AsyncStorage.clear());

describe('custom sets', () => {
  it('stores pose ids only and resolves poses on read', async () => {
    await saveCustomSet({ name: 'Morning', poseIds: ['tree_pose', 'cat_cow'] });

    const stored = JSON.parse(await AsyncStorage.getItem(KEY));
    expect(stored[0]).toEqual(expect.objectContaining({ name: 'Morning', poseIds: ['tree_pose', 'cat_cow'] }));
    expect(stored[0].poses).toBeUndefined();

    const [set] = await getCustomSets();
    expect(set.poses.map(p => p.id)).toEqual(['tree_pose', 'cat_cow']);
    expect(set.poses[0].name).toBe(getAllPoses().find(p => p.id === 'tree_pose').name);
  });

  it('migrates sets saved by older builds with full pose objects', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify([{
      id: 'set_1', name: 'Old', createdAt: '2026-01-01T00:00:00.000Z',
      // Stale text and a bundle-specific image handle, as older builds saved.
      poses: [{ id: 'cat_cow', name: 'Old name', image: 42 }, { id: 'tree_pose', image: 7 }],
    }]));

    const [set] = await getCustomSets();

    expect(set.poseIds).toEqual(['cat_cow', 'tree_pose']);
    expect(set.poses[0].name).toBe('Cat-Cow Stretch');
    expect(set.poses[0].image).not.toBe(42);
  });

  it('drops ids for poses that no longer exist', async () => {
    await saveCustomSet({ name: 'S', poseIds: ['tree_pose', 'removed_pose'] });
    const [set] = await getCustomSets();
    expect(set.poses.map(p => p.id)).toEqual(['tree_pose']);
  });

  it('updates and deletes', async () => {
    const created = await saveCustomSet({ name: 'A', poseIds: ['tree_pose'] });
    await updateCustomSet(created.id, { name: 'B', poseIds: ['cat_cow'] });
    let [set] = await getCustomSets();
    expect(set.name).toBe('B');
    expect(set.poseIds).toEqual(['cat_cow']);

    await deleteCustomSet(created.id);
    expect(await getCustomSets()).toEqual([]);
  });
});
