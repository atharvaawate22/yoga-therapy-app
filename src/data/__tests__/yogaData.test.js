import yogaData, { getAllPoses, posesForExperience } from '../yogaData';
import { getPoseImage } from '../poseImages';

const poses = [
  { id: 'a', difficulty: 'beginner' },
  { id: 'b', difficulty: 'intermediate' },
  { id: 'c', difficulty: 'advanced' },
];

describe('posesForExperience', () => {
  it.each([
    ['beginner', ['a']],
    ['intermediate', ['a', 'b']],
    ['expert', ['a', 'b', 'c']],
    [undefined, ['a', 'b', 'c']],
  ])('%p sees %p', (level, ids) => {
    expect(posesForExperience(poses, level).map(p => p.id)).toEqual(ids);
  });

  it('leaves every condition with at least one pose for beginners', () => {
    Object.entries(yogaData).forEach(([condition, list]) => {
      expect([condition, posesForExperience(list, 'beginner').length > 0]).toEqual([condition, true]);
    });
  });
});

describe('pose data', () => {
  it('has unique ids across conditions in getAllPoses', () => {
    const ids = getAllPoses().map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only uses bundled images (no network needed)', () => {
    getAllPoses().forEach(p => {
      expect(p.image).toBe(getPoseImage(p.id));
      // require()d assets only (a number in Metro, a stub object in Jest),
      // never a { uri: 'https://...' } remote source.
      expect(typeof p.image === 'string' || /^https?:/.test(p.image?.uri ?? '')).toBe(false);
    });
  });
});
