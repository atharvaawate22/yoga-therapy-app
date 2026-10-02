# Help train the Yoga Therapy pose corrector

Thanks for helping! The app's Pose Corrector uses a camera to recognise yoga
poses, and it struggles with a few of them because it hasn't seen enough real
people doing them. A few short phone videos of you fixes that.

**Your privacy:** your videos stay on Atharva's computer. They are never
uploaded to GitHub or anywhere public, and the trained model contains no
images of you. Ask him to delete them any time.

## What to record

For each pose below, record **two clips of about 10 seconds**: one from the
**side** and one from a **front-diagonal** angle. Get into the pose, hold it,
and shift a little (breathe, adjust) so the clip isn't completely still. For
poses done on one side (twist, lunge), do both sides in the same clip.

Don't worry about perfect form. Normal, slightly imperfect poses are exactly
what the app sees in real life.

| Priority | Pose | Name in the file | How it looks |
|---|---|---|---|
| 1 | Upward-Facing Dog | `updog` | Lying face down, push up on straight arms, hips and thighs lifted off the floor |
| 1 | Seated Spinal Twist | `seatedtwist` | Seated, one knee bent over the other leg, torso twisted toward the bent knee |
| 1 | Cobra | `cobra` | Lying face down, chest lifted, elbows bent, hips stay on the floor |
| 1 | Butterfly | `butterfly` | Seated, soles of the feet together, knees out to the sides |
| 2 | Prayer Pose | `prayer` | Standing tall, palms together at the chest |
| 2 | Raised Arms Pose | `raisedarms` | Standing, arms stretched overhead, slight backbend |
| 2 | Equestrian Pose | `equestrian` | Deep lunge, back knee down, hands on the floor beside the front foot |
| 2 | Eight-Limbed Pose | `eightlimbed` | Knees, chest and chin on the floor, hips slightly raised |

If you only have a few minutes, do the priority-1 poses. The app's Pose
Guide (Home → a condition → a pose) has pictures and steps for each one.

## How to set up

- **Phone propped up, not handheld**, at about waist height.
- **2–3 metres away, whole body in frame** — head to feet, with a little
  space around you. This matters most: if a hand or foot is cut off, the clip
  can't be used.
- **Portrait or landscape both fine**; normal room lighting (avoid standing
  in front of a bright window).
- Wear anything you like. Different rooms and clothes on different days help.

## Naming and sending

Name each clip `yourname_pose_angle.mp4`, using the names from the table:

```
riya_seatedtwist_side.mp4
riya_seatedtwist_front.mp4
riya_updog_side.mp4
```

Send them through **Google Drive or a similar file-sharing link**, not
WhatsApp. WhatsApp compresses video heavily, which makes the clips less
useful.

---

## For Atharva: processing the clips

1. Put all clips in `backend/videos/` (git-ignored, any subfolders are fine).
2. Pick one or two people whose clips will be the **test set**. They are never
   trained on, so their score shows how the app does for someone new:
   ```bash
   cd backend
   python extract_video_frames.py --test-people riya --dry-run   # check the plan
   python extract_video_frames.py --test-people riya
   ```
   This writes one frame every 0.5 s (max 24 per clip) to `dataset/<pose>/`
   (training) and `dataset_test/<pose>/` (held-out people). Both are
   git-ignored. Clips with a name it can't parse are listed as `SKIP`.
3. Retrain and evaluate:
   ```bash
   python train_movenet_classifier.py --rebuild-cache --augment-mirror
   python train_movenet_classifier.py --cv 5 --augment-mirror     # all classes
   python eval_pose_metrics.py                                    # original test set
   python eval_pose_metrics.py --test-root dataset_test           # unseen people
   ```
4. Ship only if cross-validation and the unseen-people score beat the
   numbers in `backend/README.md`.
