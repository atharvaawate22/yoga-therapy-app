/**
 * Simulated pose-analysis results, used when the Python backend
 * (yoga_pose_engine.py) isn't reachable so the corrector screen still
 * has something meaningful to show (e.g. for demos without a backend).
 */

const DEMO_SEQUENCE = [
  {
    pose: 'tree_pose',
    corrections: ['Engage your core for balance', 'Keep your standing leg straight'],
  },
  {
    pose: 'warrior_pose',
    corrections: ['Bend your front knee more', 'Keep shoulders relaxed away from ears'],
  },
  {
    pose: 'downward_dog',
    corrections: ['Push your hips higher', 'Press heels toward the floor'],
  },
  {
    pose: 'childs_pose',
    corrections: ['Relax your shoulders down', 'Breathe deeply and hold'],
  },
];

let cursor = 0;

/** Returns the next simulated result, cycling through a small set of poses. */
export const getNextDemoResult = () => {
  const entry = DEMO_SEQUENCE[cursor % DEMO_SEQUENCE.length];
  cursor += 1;
  const confidence = 0.78 + Math.random() * 0.18;
  return {
    pose: entry.pose,
    confidence: Number(confidence.toFixed(2)),
    corrections: entry.corrections,
    distances: {},
  };
};

export const resetDemoSequence = () => { cursor = 0; };
