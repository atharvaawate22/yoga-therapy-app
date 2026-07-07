/**
 * Surya Namaskar (Sun Salutation) Data
 * Complete 12-step sequence with images and instructions
 */

import { getPoseImage } from './poseImages';

const suryaNamaskarSteps = [
  {
    step: 1,
    name: "Prayer Pose",
    sanskritName: "Pranamasana",
    description: "Stand at the front of the mat with feet together. Bring palms together at heart center.",
    duration: 5,
    image: getPoseImage("prayer_pose"),
    expectedPoseId: "pranamasana",
    breathing: "Exhale",
    steps: ["Stand with feet together", "Bring palms together at chest", "Close eyes briefly", "Set intention for practice"]
  },
  {
    step: 2,
    name: "Raised Arms Pose",
    sanskritName: "Hasta Uttanasana",
    description: "Stretch arms up and arch back gently, opening the chest.",
    duration: 5,
    image: getPoseImage("raised_arms"),
    expectedPoseId: "hasta_uttanasana",
    breathing: "Inhale",
    steps: ["Inhale and raise arms overhead", "Arch back gently", "Stretch the whole body upward", "Look up toward hands"]
  },
  {
    step: 3,
    name: "Standing Forward Bend",
    sanskritName: "Uttanasana",
    description: "Fold forward from the hips, bringing hands to the floor beside feet.",
    duration: 5,
    image: getPoseImage("forward_bend"),
    expectedPoseId: "uttanasana",
    breathing: "Exhale",
    steps: ["Exhale and bend forward", "Keep spine long as you fold", "Bring hands to floor beside feet", "Bring nose close to knees"]
  },
  {
    step: 4,
    name: "Equestrian Pose",
    sanskritName: "Ashwa Sanchalanasana",
    description: "Step right leg back into a lunge, keeping left foot between hands.",
    duration: 5,
    image: getPoseImage("equestrian_pose"),
    expectedPoseId: "ashwa_sanchalanasana",
    breathing: "Inhale",
    steps: ["Step right leg far back", "Keep left foot between hands", "Lower right knee to floor", "Look up and open chest"]
  },
  {
    step: 5,
    name: "Plank Pose",
    sanskritName: "Dandasana",
    description: "Step left foot back to plank, body in a straight line from head to heels.",
    duration: 5,
    image: getPoseImage("plank_pose"),
    expectedPoseId: "dandasana",
    breathing: "Hold breath",
    steps: ["Step left foot back to meet right", "Body forms straight line", "Arms perpendicular to floor", "Engage core and hold"]
  },
  {
    step: 6,
    name: "Eight Limbed Pose",
    sanskritName: "Ashtanga Namaskara",
    description: "Lower knees, chest, and chin to the floor with hips slightly raised.",
    duration: 3,
    image: getPoseImage("eight_limbed"),
    expectedPoseId: "ashtanga_namaskara",
    breathing: "Exhale",
    steps: ["Lower knees to floor", "Lower chest and chin to floor", "Keep hips slightly raised", "Eight points touch the ground"]
  },
  {
    step: 7,
    name: "Cobra Pose",
    sanskritName: "Bhujangasana",
    description: "Slide forward, lift chest into cobra. Keep elbows slightly bent.",
    duration: 5,
    image: getPoseImage("cobra_pose"),
    expectedPoseId: "bhujangasana",
    breathing: "Inhale",
    steps: ["Slide forward on the mat", "Lift chest off the floor", "Keep elbows close to body", "Look upward, open chest"]
  },
  {
    step: 8,
    name: "Downward Dog",
    sanskritName: "Adho Mukha Svanasana",
    description: "Lift hips up and back to form an inverted V shape.",
    duration: 8,
    image: getPoseImage("downward_dog"),
    expectedPoseId: "adho_mukha_svanasana",
    breathing: "Exhale",
    steps: ["Tuck toes and lift hips up", "Form inverted V shape", "Press heels toward floor", "Hold for several breaths"]
  },
  {
    step: 9,
    name: "Equestrian Pose",
    sanskritName: "Ashwa Sanchalanasana",
    description: "Step right foot forward between hands, left knee down.",
    duration: 5,
    image: getPoseImage("equestrian_pose"),
    expectedPoseId: "ashwa_sanchalanasana",
    breathing: "Inhale",
    steps: ["Step right foot forward", "Place between hands", "Lower left knee to floor", "Look up and open chest"]
  },
  {
    step: 10,
    name: "Standing Forward Bend",
    sanskritName: "Uttanasana",
    description: "Bring left foot forward to meet right, fold forward.",
    duration: 5,
    image: getPoseImage("forward_bend"),
    expectedPoseId: "uttanasana",
    breathing: "Exhale",
    steps: ["Step left foot forward", "Feet together, fold forward", "Keep legs straight if possible", "Relax head and neck"]
  },
  {
    step: 11,
    name: "Raised Arms Pose",
    sanskritName: "Hasta Uttanasana",
    description: "Rise up with arms overhead, arch back gently.",
    duration: 5,
    image: getPoseImage("raised_arms"),
    expectedPoseId: "hasta_uttanasana",
    breathing: "Inhale",
    steps: ["Inhale and rise up slowly", "Raise arms overhead", "Arch back gently", "Stretch the full body"]
  },
  {
    step: 12,
    name: "Prayer Pose",
    sanskritName: "Pranamasana",
    description: "Return to standing with palms at heart center. One round complete.",
    duration: 5,
    image: getPoseImage("prayer_pose"),
    expectedPoseId: "pranamasana",
    breathing: "Exhale",
    steps: ["Bring arms down", "Join palms at heart center", "Stand tall and centered", "One round is complete"]
  }
];

export default suryaNamaskarSteps;
