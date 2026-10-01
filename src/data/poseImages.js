/**
 * Pose images: bundled photos only.
 *
 * Poses without a bundled photo get an icon placeholder (see PoseImage)
 * instead of a stock photo. The remote Unsplash URLs used before were checked
 * and none showed the pose it was labelled as (two were also 404s), and they
 * needed a network connection to show anything at all.
 */

const localImages = {
  downward_dog:      require('../../assets/poses/downward_dog.png'),
  low_lunge:         require('../../assets/poses/low_lunge.png'),
  seated_twist:      require('../../assets/poses/seated_twist.png'),
  butterfly_pose:    require('../../assets/poses/butterfly_pose.png'),
  childs_pose:       require('../../assets/poses/childs_pose.png'),
  cat_cow:           require('../../assets/poses/cat_cow.png'),
  cobra_pose:        require('../../assets/poses/cobra_pose.png'),
  tree_pose:         require('../../assets/poses/tree_pose.png'),
  warrior_pose:      require('../../assets/poses/warrior_pose.png'),
  // Ashwa Sanchalanasana (Equestrian Pose, Surya Namaskar steps 4 & 9) is
  // visually the same lunge shape as Anjaneyasana, so reuse that photo.
  equestrian_pose:   require('../../assets/poses/low_lunge.png'),
};

// Placeholder icons for poses without a photo: { family: 'ion' | 'mci', name }
const POSE_ICONS = {
  prayer_pose: { family: 'mci', name: 'hands-pray' },
  raised_arms: { family: 'mci', name: 'human-handsup' },
  plank_pose: { family: 'mci', name: 'yoga' },
  eight_limbed: { family: 'mci', name: 'human-handsdown' },
};
const DEFAULT_ICON = { family: 'mci', name: 'yoga' };

/** Bundled photo for a pose (a require() handle), or null if there isn't one. */
export const getPoseImage = (poseId) => localImages[poseId] || null;

/** Placeholder icon for a pose without a photo. */
export const getPoseIcon = (poseId) => POSE_ICONS[poseId] || DEFAULT_ICON;

export default getPoseImage;
