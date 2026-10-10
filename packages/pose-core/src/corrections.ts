/**
 * Rule-based alignment cues, ported from backend/yoga_pose_engine.py
 * (`_generate_corrections`, `_to_torso_units`, `_joint_angle`,
 * `_distance_metrics`). Golden fixtures generated from the Python
 * (fixtures/parity.json.gz) hold every branch to the server's output, so
 * the strings and thresholds below must stay identical to it.
 */
import type { Keypoint } from "./keypoints";

export type Level = "beginner" | "intermediate" | "expert";

/** What the API reports when it declines to name a pose. */
export const NO_POSE = "nopose";
/** The dataset's no-person class; never reported. */
export const UNKNOWN = "unknown";

/**
 * A rule only runs when every keypoint it measures was detected at least
 * this confidently; guessed positions produce confident nonsense.
 */
export const RULE_MIN_KEYPOINT_SCORE = 0.3;
/** Shoulder width (torso units) above which the person faces the camera. */
const FRONT_FACING_MIN_SHOULDER_WIDTH = 35;

export const NOT_VISIBLE_CUE =
  "Make sure your whole body is clearly visible so your alignment can be checked";

const [LS, RS, LW, RW, LH, RH, LK, RK, LA, RA] = [5, 6, 9, 10, 11, 12, 13, 14, 15, 16] as const;

/** Labels from classifiers saved before the label merge (label_utils.py). */
const FEEDBACK_ALIASES: Record<string, string> = {
  adho_mukha_svanasana: "downward_dog",
  bhujangasana: "cobra_pose",
  uttanasana: "forward_bend",
};

export function feedbackPoseAlias(pose: string): string {
  return FEEDBACK_ALIASES[pose] ?? pose;
}

/**
 * Rescale so 100 units = torso length (shoulder midpoint to hip midpoint),
 * which stays stable from a side view. A collapsed torso falls back to a
 * third of the keypoint bounding box.
 */
export function toTorsoUnits(keypoints: readonly Keypoint[]): Keypoint[] {
  const shoulderX = (keypoints[LS]!.x + keypoints[RS]!.x) / 2;
  const shoulderY = (keypoints[LS]!.y + keypoints[RS]!.y) / 2;
  const hipX = (keypoints[LH]!.x + keypoints[RH]!.x) / 2;
  const hipY = (keypoints[LH]!.y + keypoints[RH]!.y) / 2;
  let torso = Math.hypot(shoulderX - hipX, shoulderY - hipY);
  if (torso < 1e-6) {
    const xs = keypoints.map((k) => k.x);
    const ys = keypoints.map((k) => k.y);
    torso = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1) / 3;
  }
  return keypoints.map((k) => ({ x: (k.x / torso) * 100, y: (k.y / torso) * 100, score: k.score }));
}

/** Angle at `b` in degrees for the chain a-b-c (180 = straight). */
export function jointAngle(a: Keypoint, b: Keypoint, c: Keypoint): number {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const denom = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (denom < 1e-6) return 180;
  const cos = Math.min(1, Math.max(-1, (v1x * v2x + v1y * v2y) / denom));
  return (Math.acos(cos) * 180) / Math.PI;
}

const TOLERANCES: Record<Level, { armTol: number; shoulderTol: number; strict: boolean }> = {
  expert: { armTol: 8, shoulderTol: 10, strict: true },
  intermediate: { armTol: 15, shoulderTol: 18, strict: false },
  beginner: { armTol: 30, shoulderTol: 25, strict: false },
};

/**
 * Alignment cues for `pose`, most important first. Unknown levels get the
 * beginner tolerances (the server validates the level before this point).
 */
export function generateCorrections(
  poseLabel: string,
  rawKeypoints: readonly Keypoint[],
  level: string = "beginner",
): string[] {
  const pose = feedbackPoseAlias(poseLabel);
  if (pose === NO_POSE) {
    return ["No stable pose detected", "Keep your full body visible and hold still for 1 to 2 seconds"];
  }

  // All distances below are in percent of torso length.
  const kp = toTorsoUnits(rawKeypoints);
  const { armTol, shoulderTol, strict } =
    TOLERANCES[(level in TOLERANCES ? level : "beginner") as Level];

  let checksRun = 0;
  const seen = (...indices: number[]): boolean => {
    const ok = indices.every((i) => kp[i]!.score >= RULE_MIN_KEYPOINT_SCORE);
    if (ok) checksRun++;
    return ok;
  };

  const lShoulder = kp[LS]!;
  const rShoulder = kp[RS]!;
  const lWrist = kp[LW]!;
  const rWrist = kp[RW]!;
  const lHip = kp[LH]!;
  const rHip = kp[RH]!;
  const lKnee = kp[LK]!;
  const rKnee = kp[RK]!;
  const lAnkle = kp[LA]!;
  const rAnkle = kp[RA]!;

  const shoulderY = (lShoulder.y + rShoulder.y) / 2;
  const hipY = (lHip.y + rHip.y) / 2;
  const wristY = (lWrist.y + rWrist.y) / 2;
  const kneeY = (lKnee.y + rKnee.y) / 2;
  const shouldersLevel = Math.abs(lShoulder.y - rShoulder.y) <= shoulderTol;
  const facingCamera =
    kp[LS]!.score >= RULE_MIN_KEYPOINT_SCORE &&
    kp[RS]!.score >= RULE_MIN_KEYPOINT_SCORE &&
    Math.abs(lShoulder.x - rShoulder.x) > FRONT_FACING_MIN_SHOULDER_WIDTH;

  const corrections: string[] = [];
  let praise: string | null = null;
  const add = (cue: string) => corrections.push(cue);

  switch (pose) {
    case "downward_dog":
      if (seen(LS, RS) && !shouldersLevel) add("Level your shoulders — they should be at equal height");
      if (seen(LS, RS, LH, RH) && hipY >= shoulderY) add("Lift your hips higher to form a proper inverted V shape");
      if (facingCamera && seen(LW, RW) && Math.abs(lWrist.x - rWrist.x) < 20) {
        add("Spread your hands wider, shoulder-width apart");
      }
      praise = "Great Downward Dog! Press heels toward the floor and breathe.";
      break;

    case "low_lunge":
      if (seen(LW, RW, LS, RS) && wristY > shoulderY + armTol) {
        add("Raise your arms fully overhead, reaching toward the sky");
      }
      if (seen(LS, RS) && !shouldersLevel) add("Square your shoulders forward — keep them level");
      praise = "Good Low Lunge! Sink the hips forward and lift your chest.";
      break;

    case "ashwa_sanchalanasana":
      if (seen(LS, RS) && !shouldersLevel) add("Keep your shoulders level and open the chest");
      // Hands stay on the floor beside the front foot, below the hips.
      if (seen(LW, RW, LH, RH) && wristY < hipY) add("Place both hands on the floor beside your front foot");
      praise = "Good Equestrian Pose! Lift the chest and look up.";
      break;

    case "seated_twist":
      if (seen(LS, RS) && Math.abs(lShoulder.x - rShoulder.x) < 15) {
        add("Rotate your torso more — twist from the ribcage, not the neck");
      }
      if (seen(LH, RH) && Math.abs(lHip.y - rHip.y) > armTol) add("Keep both sit bones grounded evenly on the floor");
      praise = "Nice twist! Lengthen the spine upward on every inhale.";
      break;

    case "butterfly_pose":
      if (seen(LS, RS) && !shouldersLevel) add("Keep shoulders level and relaxed away from ears");
      // Upright, the shoulders sit a full torso length above the hips.
      if (seen(LS, RS, LH, RH) && hipY - shoulderY < 80) add("Sit tall — lengthen your spine upward out of your hips");
      praise = "Great Butterfly Pose! Let gravity gently open your hips.";
      break;

    case "childs_pose":
      if (seen(LW, RW) && Math.abs(lWrist.y - rWrist.y) > shoulderTol) {
        add("Keep arms extended evenly, parallel to each other");
      }
      if (seen(LH, RH) && Math.abs(lHip.y - rHip.y) > armTol) add("Sink hips back evenly toward both heels");
      praise = "Perfect Child's Pose! Breathe deeply into the back of the body.";
      break;

    case "cat_cow":
      if (seen(LS, RS) && !shouldersLevel) add("Keep your shoulders level — press evenly through both hands");
      if (seen(LH, RH) && Math.abs(lHip.y - rHip.y) > armTol) {
        add("Keep your hips level over both knees — don't let them sway");
      }
      praise = "Good Cat-Cow! Sync your breath with each movement.";
      break;

    case "plow_pose":
      if (seen(LS, RS) && !shouldersLevel) add("Press both shoulders evenly into the floor");
      if (seen(LA, RA) && Math.abs(lAnkle.x - rAnkle.x) > armTol) {
        add("Bring feet together behind your head, toes pointing down");
      }
      praise = "Good Plow Pose! Never turn your head — breathe steadily.";
      break;

    case "garland_pose":
      if (seen(LS, RS) && !shouldersLevel) add("Keep your chest lifted and shoulders level");
      // In a full squat the hips drop to around knee height.
      if (seen(LH, RH, LK, RK) && kneeY - hipY > 30) add("Squat deeper — lower your hips toward the floor");
      praise = "Great Garland Pose! Press elbows into knees and lengthen spine.";
      break;

    case "boat_pose":
      if (seen(LW, RW) && Math.abs(lWrist.y - rWrist.y) > armTol) {
        add("Keep both arms at equal height, parallel to the floor");
      }
      if (seen(LS, RS, LH, RH) && shoulderY > hipY) add("Lean back slightly more — lift your chest above your hips");
      if (strict && seen(LK, RK) && Math.abs(lKnee.y - rKnee.y) > armTol) add("Keep both legs at equal height");
      praise = "Strong Boat Pose! Keep the spine long, not rounded.";
      break;

    case "seated_forward_bend":
      if (seen(LS, RS) && !shouldersLevel) add("Keep shoulders level as you fold forward");
      if (seen(LS, RS, LH, RH) && shoulderY < hipY - 20) {
        add("Fold forward more — hinge from your hips, not your waist");
      }
      praise = "Good Seated Forward Bend! Breathe into the back of the legs.";
      break;

    case "shoulder_stand":
      if (seen(LS, RS) && !shouldersLevel) add("Press both shoulders evenly into the mat");
      if (seen(LA, RA) && Math.abs(lAnkle.x - rAnkle.x) > armTol) {
        add("Keep both feet together directly above your hips");
      }
      praise = "Great Shoulder Stand! Never turn your head — breathe slowly.";
      break;

    case "bridge_pose":
      if (seen(LK, RK) && Math.abs(lKnee.x - rKnee.x) > armTol * 1.5) {
        add("Keep knees hip-width apart — don't let them fall outward");
      }
      if (seen(LS, RS, LH, RH) && hipY >= shoulderY) add("Lift your hips higher — squeeze your glutes at the top");
      if (seen(LS, RS) && !shouldersLevel) add("Keep both shoulders flat on the mat");
      praise = "Great Bridge Pose! Keep squeezing the glutes and breathe.";
      break;

    case "triangle_pose":
      if (
        seen(LW, RW) &&
        Math.abs(lWrist.y - rWrist.y) < armTol &&
        Math.abs(lWrist.x - rWrist.x) < 20
      ) {
        add("Extend the top arm straight up toward the ceiling");
      }
      if (seen(LS, RS) && Math.abs(lShoulder.y - rShoulder.y) < 15) {
        add("Stack your shoulders vertically — open the chest to the sky");
      }
      praise = "Good Triangle Pose! Keep both legs straight and breathe.";
      break;

    case "upward_dog":
      if (seen(LS, RS) && !shouldersLevel) add("Keep shoulders level — draw them down away from ears");
      if (facingCamera && seen(LW, RW) && Math.abs(lWrist.x - rWrist.x) < 20) {
        add("Place hands wider, directly under your shoulders");
      }
      praise = "Nice Upward Dog! Lift the chest high and draw shoulder blades together.";
      break;

    case "chair_pose":
      if (seen(LW, RW, LS, RS) && wristY > shoulderY + armTol) {
        add("Raise both arms fully overhead alongside your ears");
      }
      if (seen(LK, RK) && Math.abs(lKnee.x - rKnee.x) > armTol * 1.5) {
        add("Keep knees together — don't let them splay outward");
      }
      praise = "Strong Chair Pose! Sit lower and keep chest lifted.";
      break;

    case "forward_bend":
      if (seen(LS, RS) && !shouldersLevel) add("Keep shoulders level as you fold — don't twist the torso");
      if (seen(LH, RH) && Math.abs(lHip.x - rHip.x) > armTol) add("Square both hips evenly over both feet");
      praise = "Good Forward Fold! Let the neck fully relax and breathe deeply.";
      break;

    case "warrior_pose":
      if (seen(LW, RW) && Math.abs(lWrist.y - rWrist.y) > armTol) {
        add("Keep both arms level — extend equally left and right");
      }
      if (seen(LS, RS) && !shouldersLevel) add("Keep shoulders relaxed and level — don't shrug");
      if (strict && seen(LH, RH, LK, RK, LA, RA)) {
        // The front leg is the bent one; it may be either side.
        const leftBend = jointAngle(lHip, lKnee, lAnkle);
        const rightBend = jointAngle(rHip, rKnee, rAnkle);
        const [frontKnee, frontAnkle] = leftBend <= rightBend ? [lKnee, lAnkle] : [rKnee, rAnkle];
        if (Math.abs(frontKnee.x - frontAnkle.x) > armTol) add("Align front knee directly over the ankle");
      }
      praise = "Powerful Warrior Two! Sink the front knee deeper and gaze forward.";
      break;

    case "tree_pose":
      if (seen(LS, RS) && !shouldersLevel) add("Level your shoulders — open the chest and broaden it");
      if (seen(LH, RH) && Math.abs(lHip.y - rHip.y) > armTol) {
        add("Keep hips level — don't let the standing-leg hip push out");
      }
      // Hands overhead or together at the chest are both correct; only arms
      // hanging apart below the shoulders get a cue.
      if (seen(LW, RW, LS, RS)) {
        const handsApart = Math.abs(lWrist.x - rWrist.x) > 40;
        if (wristY > shoulderY + armTol && handsApart) add("Raise arms overhead or keep hands at heart center");
      }
      praise = "Beautiful Tree Pose! Fix your gaze on a still point and breathe.";
      break;

    default:
      // Poses without specific rules (e.g. the Surya Namaskar steps).
      if (level === "expert") add("Excellent form! Maintain precise alignment and steady breath.");
      else if (level === "intermediate") add("Good alignment. Focus on deepening the pose with each exhale.");
      else add("Great job! Keep breathing steadily and hold the pose.");
  }

  if (corrections.length === 0) {
    // Only praise form that was actually checked.
    corrections.push(praise !== null && checksRun > 0 ? praise : NOT_VISIBLE_CUE);
  }
  if (corrections.length > 1 && level === "expert" && strict) {
    return corrections.slice(0, 2); // experts get at most 2 precise cues
  }
  return corrections;
}

/**
 * Python's round(x, 1). toFixed rounds from the exact binary value, as
 * Python does; they differ only on exact decimal ties (k/20), which the
 * parity fixtures exclude.
 */
const round1 = (x: number) => Number(x.toFixed(1));

/**
 * Warrior II arm geometry in percent of torso length, rounded to 0.1 like
 * the API response; empty for other poses.
 */
export function distanceMetrics(keypoints: readonly Keypoint[], poseLabel: string): Record<string, number> {
  const pose = feedbackPoseAlias(poseLabel);
  if (pose !== "warrior" && pose !== "warrior_pose") return {};
  const kp = toTorsoUnits(keypoints);
  const lWrist = kp[LW]!;
  const rWrist = kp[RW]!;
  const wristMidY = (lWrist.y + rWrist.y) / 2;
  const shoulderMidY = (kp[LS]!.y + kp[RS]!.y) / 2;
  return {
    warrior_arm_span: round1(Math.abs(lWrist.x - rWrist.x)),
    warrior_arm_height_offset: round1(Math.abs(wristMidY - shoulderMidY)),
    warrior_wrist_height_diff: round1(Math.abs(lWrist.y - rWrist.y)),
  };
}
