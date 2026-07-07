import { getPoseImage } from './poseImages';

// Helper shorthand
const p = (id, name, skt, desc, dur, diff, ben, prec, steps) => ({
  id, name, sanskritName: skt, description: desc, duration: dur, difficulty: diff,
  image: getPoseImage(id), benefits: ben, precautions: prec, steps,
});

const yogaData = {

  // ────────────────────────────────────────────────────
  "Back Pain": [
    p("cat_cow","Cat-Cow Stretch","Bitilasana-Marjaryasana",
      "Gently warms the spine and relieves lower back tension through rhythmic movement.",
      "30 sec","beginner",
      ["Increases spinal flexibility","Relieves lower back tension","Massages spinal discs"],
      ["Keep wrists under shoulders","Move slowly with breath"],
      ["Start on all fours in tabletop","Inhale — drop belly, lift chest (Cow)","Exhale — round spine, tuck chin (Cat)","Repeat 8–10 slow cycles"]),
    p("childs_pose","Child's Pose","Balasana",
      "Deeply relaxes the lower back and gently stretches the entire spine.",
      "1 min","beginner",
      ["Relaxes lower back","Stretches hips and thighs","Decompresses lumbar spine"],
      ["Place cushion under knees if needed","Avoid if knees are injured"],
      ["Kneel, toes together, knees wide","Sit back onto heels","Extend arms forward on mat","Rest forehead down, breathe deeply"]),
    p("downward_dog","Downward-Facing Dog","Adho Mukha Svanasana",
      "Lengthens and decompresses the entire spine, relieving chronic back pain.",
      "30 sec","beginner",
      ["Decompresses spine","Stretches hamstrings and calves","Strengthens arms"],
      ["Bend knees if hamstrings are tight","Avoid with wrist injuries"],
      ["From tabletop, tuck toes and lift hips","Form inverted V shape","Press heels toward floor","Keep head between arms, hold"]),
    p("bridge_pose","Bridge Pose","Setu Bandha Sarvangasana",
      "Strengthens the lower back, glutes and core to support a healthy spine.",
      "30 sec","beginner",
      ["Strengthens lower back","Builds glute strength","Relieves disc pressure"],
      ["Keep knees over ankles","Lower spine slowly"],
      ["Lie on back, knees bent, feet flat","Press feet into floor, lift hips","Clasp hands under back","Hold 30 sec, lower slowly"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "Stretches the entire posterior chain and relieves tension in the lumbar spine.",
      "1 min","beginner",
      ["Stretches lower back","Lengthens hamstrings","Calms the nervous system"],
      ["Bend knees if needed","Fold from hips not waist"],
      ["Sit with legs extended","Inhale to lengthen spine","Exhale and fold forward gently","Hold ankles or feet, relax deeper"]),
  ],

  // ────────────────────────────────────────────────────
  "Hip Alignment Issue": [
    p("butterfly_pose","Butterfly Pose","Baddha Konasana",
      "Opens the inner groin and hips, improving symmetrical hip alignment.",
      "60 sec","beginner",
      ["Opens inner thighs","Improves hip flexibility","Stimulates pelvic organs"],
      ["Sit on folded blanket if hips are tight","Never push knees forcefully down"],
      ["Sit with soles of feet together","Hold feet or ankles","Gently press knees toward floor","Keep spine tall, breathe"]),
    p("low_lunge","Low Lunge","Anjaneyasana",
      "Stretches hip flexors and corrects anterior pelvic tilt and hip misalignment.",
      "30 sec each","beginner",
      ["Stretches hip flexors","Corrects pelvic tilt","Strengthens front thigh"],
      ["Cushion the back knee","Ensure front knee is over ankle"],
      ["Step right foot forward between hands","Lower left knee gently to mat","Lift torso and raise arms overhead","Sink hips forward slowly, then switch"]),
    p("garland_pose","Garland Pose","Malasana",
      "Deep squat that opens hips and aligns the pelvis naturally.",
      "45 sec","beginner",
      ["Opens hips deeply","Aligns pelvis","Strengthens ankles and core"],
      ["Use a folded blanket under heels if needed","Keep chest lifted"],
      ["Stand feet shoulder-width apart","Lower into deep squat","Bring palms together at chest","Press elbows into inner knees, breathe"]),
    p("bridge_pose","Bridge Pose","Setu Bandha Sarvangasana",
      "Activates glutes and stabilizers that maintain proper hip alignment.",
      "30 sec","beginner",
      ["Activates glute medius","Stabilizes hips","Strengthens legs"],
      ["Press feet evenly into floor","Avoid if SI joint pain"],
      ["Lie on back, knees bent","Feet hip-width apart","Press into feet and lift hips","Hold, squeeze glutes, lower slowly"]),
    p("seated_twist","Seated Spinal Twist","Ardha Matsyendrasana",
      "Releases the IT band and outer hip muscles that cause misalignment.",
      "1 min each","beginner",
      ["Releases IT band","Frees outer hip","Realigns pelvis"],
      ["Keep both sit bones grounded","Twist on exhale only"],
      ["Sit with legs extended","Bend right knee, place foot outside left thigh","Twist right, left elbow on right knee","Hold, breathe, then switch sides"]),
  ],

  // ────────────────────────────────────────────────────
  "Scapula Winging": [
    p("downward_dog","Downward-Facing Dog","Adho Mukha Svanasana",
      "Teaches proper scapular depression and protraction in a loaded position.",
      "30 sec","beginner",
      ["Teaches scapular control","Strengthens upper back","Improves posture"],
      ["Externally rotate arms","Don't shrug shoulders"],
      ["Hands and feet on mat","Lift hips to inverted V","Roll shoulders away from ears","Press index fingers into mat"]),
    p("upward_dog","Upward-Facing Dog","Urdhva Mukha Svanasana",
      "Activates the lower trapezius and rhomboids that stabilize the scapula.",
      "20 sec","beginner",
      ["Activates lower trapezius","Draws scapulae together","Strengthens upper back"],
      ["Don't overextend the neck","Keep thighs lifted off mat"],
      ["Lie face down, hands under shoulders","Inhale and lift chest and thighs","Draw shoulder blades down and back","Hold and breathe steadily"]),
    p("boat_pose","Boat Pose","Navasana",
      "Engages the core and shoulder girdle stabilizers that prevent scapula winging.",
      "20 sec","intermediate",
      ["Stabilizes shoulder girdle","Strengthens serratus anterior","Builds core support"],
      ["Keep back straight, not rounded","Modify with bent knees if needed"],
      ["Sit with knees bent, feet flat","Lean back slightly, lift feet","Extend arms forward parallel to floor","Straighten legs if possible, hold"]),
    p("bridge_pose","Bridge Pose","Setu Bandha Sarvangasana",
      "Strengthens the posterior chain and scapular retractors.",
      "30 sec","beginner",
      ["Retracts scapulae","Strengthens rhomboids","Opens chest"],
      ["Clasp hands under back","Press shoulders into mat"],
      ["Lie on back, knees bent","Lift hips high","Clasp hands under back","Roll shoulders inward, hold"]),
    p("warrior_pose","Warrior II","Virabhadrasana Two",
      "Wide arm extension in Warrior II actively trains scapular stabilization.",
      "30 sec each","beginner",
      ["Trains scapular stability","Strengthens upper back","Improves shoulder alignment"],
      ["Keep shoulders relaxed down","Don't shrug ears toward shoulders"],
      ["Stand legs wide apart","Turn right foot out 90°","Bend right knee","Extend arms parallel, gaze forward"]),
  ],

  // ────────────────────────────────────────────────────
  "Headache": [
    p("forward_bend","Standing Forward Fold","Uttanasana",
      "Reverses blood flow to the brain and releases neck/shoulder tension causing headaches.",
      "30–60 sec","beginner",
      ["Increases blood flow to brain","Releases neck and shoulder tension","Calms the nervous system"],
      ["Bend knees if hamstrings are tight","Rise very slowly to avoid dizziness"],
      ["Stand feet hip-width apart","Exhale and fold forward from hips","Let head and arms hang heavy","Relax neck completely, breathe"]),
    p("childs_pose","Child's Pose","Balasana",
      "Relieves sinus pressure and releases the neck and shoulders that cause headaches.",
      "2 min","beginner",
      ["Relieves sinus pressure","Relaxes neck and shoulders","Calms the nervous system"],
      ["Use folded blanket under forehead","Breathe through nose only"],
      ["Kneel, knees wide, toes together","Walk hands forward on mat","Rest forehead on mat","Breathe deeply into the back"]),
    p("plow_pose","Plow Pose","Halasana",
      "Reduces pressure in the head and neck by gently inverting blood flow.",
      "30 sec","intermediate",
      ["Reduces head tension","Soothes the nervous system","Stretches cervical spine"],
      ["Never turn head while in pose","Avoid with neck injuries"],
      ["Lie on back, arms at sides","Lift legs over head slowly","Lower feet to floor behind head","Breathe steadily, hold 30 sec"]),
    p("shoulder_stand","Shoulder Stand","Salamba Sarvangasana",
      "Full inversion calms the brain and reduces intracranial pressure for headache relief.",
      "1 min","intermediate",
      ["Calms the brain","Reduces intracranial pressure","Relieves migraine symptoms"],
      ["Never turn head in this pose","Avoid with high blood pressure"],
      ["Lie on back","Lift legs and hips overhead","Support lower back with hands","Hold steadily, breathe slowly"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "Folding forward draws energy inward and calms the nervous system for headache relief.",
      "2 min","beginner",
      ["Calms nervous system","Reduces tension headache","Stretches posterior chain"],
      ["Don't strain the neck","Use a strap if hamstrings are tight"],
      ["Sit with legs extended","Inhale lengthen spine","Exhale fold forward","Rest head on legs or hands, breathe"]),
  ],

  // ────────────────────────────────────────────────────
  "Stress": [
    p("childs_pose","Child's Pose","Balasana",
      "The ultimate surrender pose — signals safety to the nervous system.",
      "2 min","beginner",
      ["Signals safety to nervous system","Relieves chest tightness","Promotes deep exhalation"],
      ["Keep forehead on mat","Arms can be extended or by sides"],
      ["Kneel on mat, knees apart","Sit back on heels","Fold forward, arms extended","Rest and breathe deeply"]),
    p("forward_bend","Standing Forward Fold","Uttanasana",
      "Inversions calm the nervous system and the downward fold releases mental load.",
      "1 min","beginner",
      ["Calms the nervous system","Releases tension in neck","Reduces stress markers"],
      ["Bend knees generously","Rise up slowly"],
      ["Stand feet hip-width","Exhale and fold forward","Hold opposite elbows or let arms hang","Breathe slowly, stay 1 minute"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "The folding action physically signals the nervous system that it is time to rest.",
      "2 min","beginner",
      ["Signals rest to nervous system","Stretches posterior chain","Calms busy mind"],
      ["Fold from hips not waist","Bend knees if hamstrings are tight"],
      ["Sit with legs extended","Inhale and lengthen spine","Exhale and fold forward","Hold shins or feet, relax"]),
    p("butterfly_pose","Butterfly Pose","Baddha Konasana",
      "Passive hip opening releases stored physical stress and tension from the pelvis.",
      "90 sec","beginner",
      ["Releases pelvic tension","Opens inner thighs","Promotes deep breathing"],
      ["Never force the knees down","Sit on a blanket if hips are tight"],
      ["Sit with soles of feet together","Hold feet with both hands","Close eyes and breathe slowly","Let gravity open hips naturally"]),
    p("shoulder_stand","Shoulder Stand","Salamba Sarvangasana",
      "Full inversion stimulates the thyroid and activates the parasympathetic system.",
      "1 min","intermediate",
      ["Activates parasympathetic system","Reduces cortisol","Calms the mind"],
      ["Never twist neck in this pose","Avoid with neck or shoulder injuries"],
      ["Lie on back, arms at sides","Swing legs up and overhead","Support back with palms","Hold steadily and breathe"]),
  ],

  // ────────────────────────────────────────────────────
  "Anxiety": [
    p("tree_pose","Tree Pose","Vrksasana",
      "Balance poses require intense present-moment focus, pulling attention away from anxious thoughts.",
      "30 sec each side","beginner",
      ["Forces present-moment focus","Reduces repetitive anxious thoughts","Builds confidence and calm"],
      ["Use wall for support if needed","Place foot on calf, not on knee"],
      ["Stand tall on left foot","Place right sole on left inner thigh","Bring hands to prayer at chest","Fix gaze on a still point, breathe"]),
    p("forward_bend","Standing Forward Fold","Uttanasana",
      "Instantly activates the parasympathetic system — the body's natural anti-anxiety mechanism.",
      "1 min","beginner",
      ["Activates parasympathetic system","Quiets racing thoughts","Restores calm within minutes"],
      ["Bend knees generously","Rise up very slowly"],
      ["Stand feet hip-width apart","Exhale and fold completely forward","Hold elbows or let arms hang","Breathe slowly for 1 minute"]),
    p("childs_pose","Child's Pose","Balasana",
      "Grounding pose that soothes the nervous system and interrupts the anxiety spiral.",
      "2 min","beginner",
      ["Grounds and soothes nervous system","Slows breathing naturally","Interrupts anxiety spiral"],
      ["Rest forehead on mat","Breathe deeply through the nose"],
      ["Kneel and sit back on heels","Fold forward with arms extended","Rest forehead on mat","Close eyes, breathe for 2 min"]),
    p("seated_twist","Seated Spinal Twist","Ardha Matsyendrasana",
      "Twisting wrings out tension from the spine and stimulates the vagus nerve to reduce anxiety.",
      "1 min each","beginner",
      ["Stimulates vagus nerve","Releases spinal tension","Reduces anxiety hormones"],
      ["Keep spine tall as you twist","Twist on the exhale only"],
      ["Sit tall, legs extended","Bend one knee and cross foot over","Place opposite elbow on knee","Twist and breathe deeply, switch sides"]),
    p("butterfly_pose","Butterfly Pose","Baddha Konasana",
      "Extended exhale breathing in this restful pose activates the vagus nerve to reduce anxiety.",
      "2 min","beginner",
      ["Activates vagus nerve","Reduces anxiety hormones","Promotes calm focus"],
      ["Don't force the breath","Sit comfortably"],
      ["Sit with soles of feet together","Hold feet gently","Inhale for 4 counts","Exhale slowly for 6–8 counts"]),
  ],

  // ────────────────────────────────────────────────────
  "Poor Posture": [
    p("downward_dog","Downward-Facing Dog","Adho Mukha Svanasana",
      "Lengthens tight chest muscles and strengthens back muscles for better posture.",
      "30 sec","beginner",
      ["Lengthens chest","Strengthens back","Improves shoulder alignment"],
      ["Roll shoulders externally","Don't shrug toward ears"],
      ["Hands and feet on mat","Lift hips up to inverted V","Roll shoulders away from ears","Press chest toward thighs"]),
    p("bridge_pose","Bridge Pose","Setu Bandha Sarvangasana",
      "Strengthens the entire posterior chain — the muscles responsible for upright posture.",
      "30 sec","beginner",
      ["Strengthens posterior chain","Opens chest and hip flexors","Improves spinal extension"],
      ["Keep knees over ankles","Avoid turning head while holding"],
      ["Lie on back, knees bent","Feet hip-width flat on floor","Press up, lift hips high","Clasp hands under back, hold"]),
    p("triangle_pose","Triangle Pose","Trikonasana",
      "Builds lateral stability in the spine and opens the chest to correct postural imbalances.",
      "30 sec each","beginner",
      ["Builds spinal stability","Opens chest","Corrects postural imbalances"],
      ["Keep both legs straight","Don't lock knees"],
      ["Stand legs wide apart","Turn right foot out","Extend right hand to shin or floor","Lift left arm up, gaze upward"]),
    p("warrior_pose","Warrior II","Virabhadrasana Two",
      "Builds the core and spinal stabilizers that maintain upright, aligned posture.",
      "30 sec each","beginner",
      ["Builds core stability","Strengthens spinal stabilizers","Improves body awareness"],
      ["Keep front knee over ankle","Don't lean torso forward"],
      ["Stand legs wide","Turn right foot out 90°","Bend right knee to 90°","Extend arms parallel, gaze right"]),
    p("chair_pose","Chair Pose","Utkatasana",
      "Strengthens the entire lower body and forces the spine into natural alignment.",
      "30 sec","beginner",
      ["Strengthens lower body","Forces natural spinal alignment","Builds postural endurance"],
      ["Keep knees behind toes","Don't let lower back arch excessively"],
      ["Stand feet together","Bend knees as if sitting in a chair","Raise arms overhead","Hold with chest lifted, breathe"]),
  ],

  // ────────────────────────────────────────────────────
  "Insomnia": [
    p("childs_pose","Child's Pose","Balasana",
      "A surrender pose that mimics the fetal sleeping position to ease into sleep.",
      "3 min","beginner",
      ["Mimics fetal sleep position","Calms racing thoughts","Slows breathing naturally"],
      ["Use blanket under knees","Arms by sides to deepen release"],
      ["Kneel with knees wide","Sit back on heels","Fold forward completely","Rest and breathe slowly"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "The folding action physically signals the nervous system that it is time to rest.",
      "2 min","beginner",
      ["Signals rest to nervous system","Stretches posterior chain","Calms busy mind"],
      ["Fold from hips not waist","Bend knees if hamstrings are tight"],
      ["Sit with legs extended","Inhale and lengthen spine","Exhale and fold forward","Hold shins or feet, relax"]),
    p("butterfly_pose","Butterfly Pose","Baddha Konasana",
      "Deeply passive and relaxing — allows the nervous system to fully wind down.",
      "5 min","beginner",
      ["Deeply relaxes nervous system","Opens hips passively","Promotes slow breathing"],
      ["Prop knees with pillows","Stay warm with a blanket"],
      ["Lie on back (supta version)","Bring soles of feet together","Knees fall open to sides","Arms at sides, breathe slowly"]),
    p("plow_pose","Plow Pose","Halasana",
      "Calms the brain and soothes the nervous system preparing the body for deep sleep.",
      "1 min","intermediate",
      ["Calms the brain deeply","Soothes nervous system","Prepares body for sleep"],
      ["Use a blanket under shoulders","Never turn head in this pose"],
      ["Lie on back, arms flat","Lift legs overhead slowly","Lower feet behind head","Breathe slowly, hold 1 minute"]),
    p("forward_bend","Standing Forward Fold","Uttanasana",
      "Drains tension from legs and calms the mind as a pre-sleep ritual.",
      "1 min","beginner",
      ["Drains leg tension","Calms the mind","Eases into sleep"],
      ["Bend knees generously","Rise up very slowly"],
      ["Stand and exhale fold forward","Hold opposite elbows","Let neck and head fully relax","Breathe slowly for 1 minute"]),
  ],

  // ────────────────────────────────────────────────────
  "Knee Pain": [
    p("bridge_pose","Bridge Pose","Setu Bandha Sarvangasana",
      "Strengthens quadriceps and glutes — the muscles that absorb force through the knee joint.",
      "30 sec","beginner",
      ["Strengthens quads and glutes","Reduces knee joint stress","Improves knee stability"],
      ["Feet parallel, knees over ankles","Lower slowly, don't let knees collapse"],
      ["Lie on back, knees bent","Feet flat, hip-width apart","Press feet down, lift hips slowly","Hold, then lower with control"]),
    p("chair_pose","Chair Pose","Utkatasana",
      "Builds quadriceps strength safely to support and protect the knee joint.",
      "20 sec","beginner",
      ["Builds quadriceps strength","Protects knee joint","Improves knee tracking"],
      ["Ensure knees track over toes","Stop if sharp knee pain occurs"],
      ["Stand feet together","Bend knees slowly, sit back","Raise arms overhead","Hold for 20 sec, keep breathing"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "Gently stretches the hamstrings that, when tight, create excess tension in the knee.",
      "1 min","beginner",
      ["Stretches hamstrings","Reduces hamstring-induced knee tension","Improves knee flexibility"],
      ["Keep a significant bend in knees","Use strap around feet if tight"],
      ["Sit with legs extended","Bend knees significantly","Fold forward gently","Hold and relax deeper with each exhale"]),
    p("tree_pose","Tree Pose","Vrksasana",
      "Improves single-leg balance and activates stabilizing muscles around the knee.",
      "30 sec each","beginner",
      ["Improves knee stability","Activates stabilizing muscles","Trains proprioception"],
      ["Place foot on calf not knee","Use wall for support"],
      ["Stand on one leg","Place other foot on inner calf","Bring hands to prayer","Hold steady, switch sides"]),
    p("warrior_pose","Warrior II","Virabhadrasana Two",
      "Strengthens the entire lower body chain to take pressure off the knee joint.",
      "20 sec each","beginner",
      ["Strengthens lower body","Takes pressure off knee","Builds leg endurance"],
      ["Front knee must track over ankle","Don't let knee collapse inward"],
      ["Stand legs wide apart","Turn right foot out","Bend right knee to 90°","Extend arms, hold, then switch"]),
  ],

  // ────────────────────────────────────────────────────
  "Digestion Issues": [
    p("seated_twist","Seated Spinal Twist","Ardha Matsyendrasana",
      "The twisting action wrings out abdominal organs and stimulates digestive juices.",
      "1 min each","beginner",
      ["Wrings out digestive organs","Stimulates digestive enzymes","Relieves constipation"],
      ["Keep shoulders flat on floor","Twist gently without forcing"],
      ["Sit tall, legs extended","Bend right knee, foot outside left thigh","Twist right, left elbow on right knee","Hold 1 min, switch sides"]),
    p("seated_forward_bend","Seated Forward Bend","Paschimottanasana",
      "Compresses the entire abdominal cavity, stimulating all digestive organs simultaneously.",
      "1 min","beginner",
      ["Compresses digestive organs","Stimulates liver and kidneys","Relieves bloating"],
      ["Never practice on a full stomach","Fold gradually from hips"],
      ["Sit with legs extended","Inhale and lengthen spine","Exhale and fold forward deeply","Hold ankles or feet, breathe"]),
    p("childs_pose","Child's Pose","Balasana",
      "Gentle abdominal compression that soothes digestive discomfort and cramping.",
      "2 min","beginner",
      ["Soothes abdominal cramping","Massages intestines gently","Relieves digestive discomfort"],
      ["Avoid immediately after eating","Knees wide to reduce belly compression"],
      ["Kneel on mat, knees wide","Walk hands forward, fold body","Press belly into thighs gently","Breathe slowly and deeply"]),
    p("boat_pose","Boat Pose","Navasana",
      "Strengthens abdominal muscles and stimulates digestive fire (Agni).",
      "20 sec","intermediate",
      ["Stimulates digestive fire","Strengthens abdominal muscles","Boosts metabolism"],
      ["Practice on empty stomach only","Keep back straight, not rounded"],
      ["Sit with knees bent, feet flat","Lean back slightly, lift feet","Extend arms forward","Straighten legs if possible, hold"]),
    p("garland_pose","Garland Pose","Malasana",
      "Deep squat position naturally compresses the colon to promote elimination and digestion.",
      "1 min","beginner",
      ["Promotes bowel regularity","Compresses the colon","Relieves gas and bloating"],
      ["Use blanket under heels if needed","Keep chest lifted, spine long"],
      ["Stand feet shoulder-width apart","Squat deeply, heels flat if possible","Hands in prayer at chest","Elbows press inner knees open, breathe"]),
  ],

  // ────────────────────────────────────────────────────
  "Weight Loss": [
    p("warrior_pose","Warrior II","Virabhadrasana Two",
      "High-intensity standing pose that burns significant calories and builds lean muscle mass.",
      "45 sec each side","intermediate",
      ["Burns calories","Builds lean leg muscle","Increases metabolic rate"],
      ["Front knee must not collapse inward","Don't lean torso forward"],
      ["Stand with legs 3–4 feet apart","Turn right foot out 90°","Bend right knee to 90°","Extend arms parallel to floor, hold"]),
    p("boat_pose","Boat Pose","Navasana",
      "Intense core engagement that targets the deep abdominal muscles and burns belly fat.",
      "20–30 sec","intermediate",
      ["Targets deep core muscles","Burns abdominal fat","Strengthens hip flexors"],
      ["Keep back straight, not rounded","Modify with bent knees if needed"],
      ["Sit with knees bent, feet flat","Lean back slightly, lift feet","Extend arms forward, parallel to floor","Straighten legs if possible, hold"]),
    p("chair_pose","Chair Pose","Utkatasana",
      "Engages the largest muscle groups in the body for maximum calorie burn.",
      "30 sec","beginner",
      ["Engages largest muscle groups","Burns calories efficiently","Boosts metabolism"],
      ["Keep knees behind toes","Lift chest, don't round forward"],
      ["Stand feet together","Sit back into an invisible chair","Raise arms overhead","Hold as long as possible with good form"]),
    p("triangle_pose","Triangle Pose","Trikonasana",
      "Full body engagement from ankles to fingertips burns calories and improves body composition.",
      "30 sec each","beginner",
      ["Full body engagement","Burns calories","Tones obliques and legs"],
      ["Keep both legs straight","Stack shoulders vertically"],
      ["Stand legs wide apart","Turn right foot out 90°","Extend right hand to shin or floor","Lift left arm skyward, hold"]),
    p("downward_dog","Downward-Facing Dog","Adho Mukha Svanasana",
      "Full body engagement that builds strength and flexibility while burning calories.",
      "30 sec","beginner",
      ["Full body strengthening","Burns calories","Improves flexibility"],
      ["Externally rotate upper arms","Press all fingers into mat"],
      ["Hands and feet on mat","Lift hips to inverted V","Press heels toward floor","Hold actively, don't rest"]),
  ],

};

// Restrict the available poses to the user's approved set.
// Only these pose IDs will remain in every problem category.
const ALLOWED_POSE_IDS = [
  'downward_dog', // Adho Mukha Svanasana
  'low_lunge', // Anjaneyasana
  'seated_twist', // Ardha Matsyendrasana
  'butterfly_pose', // Baddha Konasana
  'childs_pose', // Balasana
  'cat_cow', // Bitilasana
  'plow_pose', // Halasana
  'garland_pose', // Malasana
  'boat_pose', // Navasana
  'seated_forward_bend', // Paschimottanasana
  'shoulder_stand', // Salamba Sarvangasana
  'bridge_pose', // Setu Bandha Sarvangasana
  'triangle_pose', // Trikonasana
  'upward_dog', // Urdhva Mukha Svanasana
  'chair_pose', // Utkatasana
  'forward_bend', // Uttanasana
  'warrior_pose', // Virabhadrasana Two
  'tree_pose', // Vrksasana
];

Object.keys(yogaData).forEach(cat => {
  yogaData[cat] = (yogaData[cat] || []).filter(pose => ALLOWED_POSE_IDS.includes(pose.id));
});

export default yogaData;

export const getAllPoses = () => {
  const seen = new Set();
  const all = [];
  Object.entries(yogaData).forEach(([cat, poses]) => {
    poses.forEach(pose => {
      if (!seen.has(pose.id)) {
        seen.add(pose.id);
        all.push({ ...pose, category: cat });
      }
    });
  });
  return all;
};
