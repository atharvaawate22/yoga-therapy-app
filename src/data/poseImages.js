/**
 * Pose Images Registry — 18 Allowed Yoga Poses Only
 * Local AI-generated images for 6 poses; curated Unsplash URLs for the rest.
 */

// Local high-quality AI-generated images
const localImages = {
  downward_dog:      require('../../assets/poses/downward_dog.png'),
  low_lunge:         require('../../assets/poses/low_lunge.png'),
  seated_twist:      require('../../assets/poses/seated_twist.png'),
  butterfly_pose:    require('../../assets/poses/butterfly_pose.png'),
  childs_pose:       require('../../assets/poses/childs_pose.png'),
  cat_cow:           require('../../assets/poses/cat_cow.png'),
};

/**
 * Remote images — each URL specifically chosen to match the exact pose.
 * Curated Unsplash photos showing the correct asana.
 */
const remoteImages = {
  // Halasana — Plow Pose
  plow_pose:
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=600&h=400&fit=crop&crop=center',

  // Malasana — Garland / Yogi Squat
  garland_pose:
    'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=600&h=400&fit=crop&crop=center',

  // Navasana — Boat Pose
  boat_pose:
    'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=400&fit=crop&crop=top',

  // Paschimottanasana — Seated Forward Bend
  seated_forward_bend:
    'https://images.unsplash.com/photo-1510894347713-fc3ed6fdf539?w=600&h=400&fit=crop&crop=center',

  // Salamba Sarvangasana — Shoulder Stand
  shoulder_stand:
    'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=600&h=400&fit=crop&crop=center',

  // Setu Bandha Sarvangasana — Bridge Pose
  bridge_pose:
    'https://images.unsplash.com/photo-1573590330530-0ee87e5a8609?w=600&h=400&fit=crop&crop=center',

  // Trikonasana — Triangle Pose
  triangle_pose:
    'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=600&h=400&fit=crop&crop=center',

  // Urdhva Mukha Svanasana — Upward-Facing Dog
  upward_dog:
    'https://images.unsplash.com/photo-1601925228689-f5a5bdc76f89?w=600&h=400&fit=crop&crop=center',

  // Utkatasana — Chair Pose
  chair_pose:
    'https://images.unsplash.com/photo-1599901860904-17e6ed7083a0?w=600&h=400&fit=crop&crop=top',

  // Uttanasana — Standing Forward Fold
  forward_bend:
    'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop&crop=top',

  // Virabhadrasana II — Warrior II
  warrior_pose:
    'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=600&h=400&fit=crop&crop=center',

  // Vrksasana — Tree Pose
  tree_pose:
    'https://images.unsplash.com/photo-1545389336-cf090694435e?w=600&h=400&fit=crop&crop=center',
};

// Fallback image
const FALLBACK = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=600&h=400&fit=crop&crop=center';

export const getPoseImage = (poseId) => {
  if (localImages[poseId]) return localImages[poseId];
  if (remoteImages[poseId]) return { uri: remoteImages[poseId] };
  return { uri: FALLBACK };
};

export default getPoseImage;
