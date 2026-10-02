/**
 * App <-> model contract. The app names target poses by classifier label; if
 * the model's label set changes (a class merged or dropped) and the app isn't
 * updated, "Test This Pose" asks for a pose the model can never return.
 */
import modelLabels from '../../../backend/models/pose_labels.json';
import suryaNamaskarSteps from '../suryaNamaskarData';
import { getAllPoses } from '../yogaData';
import { POSE_COMMON_NAMES, POSE_SANSKRIT_NAMES } from '../poseNames';

describe('pose corrector targets', () => {
  it('every Surya Namaskar target is a class the model outputs', () => {
    suryaNamaskarSteps
      .filter(step => step.expectedPoseId)
      .forEach(step => expect([step.step, modelLabels.includes(step.expectedPoseId)]).toEqual([step.step, true]));
  });

  it('every pose guide target (Try Pose Corrector) is a class the model outputs', () => {
    getAllPoses().forEach(pose => {
      expect([pose.id, modelLabels.includes(pose.id)]).toEqual([pose.id, true]);
    });
  });

  it('every model label has a common and a Sanskrit display name', () => {
    modelLabels.forEach(label => {
      expect([label, Boolean(POSE_COMMON_NAMES[label]), Boolean(POSE_SANSKRIT_NAMES[label])])
        .toEqual([label, true, true]);
    });
  });
});
