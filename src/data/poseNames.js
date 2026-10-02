/**
 * Display names for the pose classifier's labels (backend/models/pose_labels.json).
 * src/data/__tests__/poseContract.test.js checks every model label has one.
 */

// Common (English) name shown first and spoken aloud -- the Sanskrit name
// alone ("Vrksasana") means nothing to most users; "Tree Pose" does.
export const POSE_COMMON_NAMES = {
  downward_dog: 'Downward-Facing Dog',
  low_lunge: 'Low Lunge',
  seated_twist: 'Seated Spinal Twist',
  butterfly_pose: 'Butterfly Pose',
  childs_pose: "Child's Pose",
  cat_cow: 'Cat-Cow Stretch',
  plow_pose: 'Plow Pose',
  garland_pose: 'Garland Pose',
  boat_pose: 'Boat Pose',
  seated_forward_bend: 'Seated Forward Bend',
  shoulder_stand: 'Shoulder Stand',
  bridge_pose: 'Bridge Pose',
  triangle_pose: 'Triangle Pose',
  upward_dog: 'Upward-Facing Dog',
  chair_pose: 'Chair Pose',
  forward_bend: 'Standing Forward Fold',
  warrior_pose: 'Warrior II',
  tree_pose: 'Tree Pose',
  pranamasana: 'Prayer Pose',
  hasta_uttanasana: 'Raised Arms Pose',
  hasta_padasana: 'Hand to Foot Pose',
  ashwa_sanchalanasana: 'Equestrian Pose',
  dandasana: 'Plank Pose',
  ashtanga_namaskara: 'Eight-Limbed Pose',
  cobra_pose: 'Cobra Pose',
  tadasana: 'Mountain Pose',
  nopose: 'No Pose',
  // Retained for a classifier trained before these labels were merged into
  // downward_dog / cobra_pose / forward_bend. A retrained model never emits them.
  adho_mukha_svanasana: 'Downward-Facing Dog',
  bhujangasana: 'Cobra Pose',
  uttanasana: 'Standing Forward Fold',
};

// Sanskrit name shown as a subtitle under the common name -- never spoken
// aloud on its own (see speakCorrection), just for reference.
export const POSE_SANSKRIT_NAMES = {
  downward_dog: 'Adho Mukha Svanasana',
  low_lunge: 'Anjaneyasana',
  seated_twist: 'Ardha Matsyendrasana',
  butterfly_pose: 'Baddha Konasana',
  childs_pose: 'Balasana',
  cat_cow: 'Bitilasana',
  plow_pose: 'Halasana',
  garland_pose: 'Malasana',
  boat_pose: 'Navasana',
  seated_forward_bend: 'Paschimottanasana',
  shoulder_stand: 'Salamba Sarvangasana',
  bridge_pose: 'Setu Bandha Sarvangasana',
  triangle_pose: 'Trikonasana',
  upward_dog: 'Urdhva Mukha Svanasana',
  chair_pose: 'Utkatasana',
  forward_bend: 'Uttanasana',
  warrior_pose: 'Virabhadrasana Two',
  tree_pose: 'Vrksasana',
  pranamasana: 'Pranamasana',
  hasta_uttanasana: 'Hasta Uttanasana',
  hasta_padasana: 'Hasta Padasana',
  ashwa_sanchalanasana: 'Ashwa Sanchalanasana',
  dandasana: 'Kumbhakasana', // model label for plank; see suryaNamaskarData
  ashtanga_namaskara: 'Ashtanga Namaskara',
  cobra_pose: 'Bhujangasana',
  tadasana: 'Tadasana',
  adho_mukha_svanasana: 'Adho Mukha Svanasana',
  bhujangasana: 'Bhujangasana',
  uttanasana: 'Uttanasana',
};

// Backward-compatible alias: existing lookups (POSE_DISPLAY_NAMES[id]) keep
// working and now resolve to the common name.
export const POSE_DISPLAY_NAMES = POSE_COMMON_NAMES;
