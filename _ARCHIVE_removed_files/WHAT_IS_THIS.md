# Archived / removed files

These files were removed from the project during a cleanup, but preserved here so
nothing is lost. **This folder is not tracked by git and not listed in
`.gitignore`** — it shows up as "untracked" on purpose. Move it out of the repo
wherever you like; deleting it loses these copies permanently.

Everything here was extracted byte-for-byte from the last git commit (`HEAD`),
except `CLAUDE.md`, which was reconstructed from its contents (it was never
committed).

## Contents

| File | What it was | Why removed |
|------|-------------|-------------|
| `yoga_corrector_model.pkl` | 5.1 MB pickle | Not referenced anywhere. The backend loads only `backend/models/*.tflite` / `*.keras` / `*.json`. Leftover from an older model format. |
| `yoga_pose_model.pkl` | 8.9 MB pickle | Same as above — dead binary, referenced nowhere. |
| `app.json` | Old Expo config | Redundant. Its 3 values (name/slug/version) were already overridden in `app.config.js`, which is now the single config source. |
| `CLAUDE.md` | Auto-generated toolbox note | Junk with stale paths (`d:\...`, `C:\Users\Lenovo`). It regenerates automatically on the next Cloude Code ToolBox scan, so this copy is only for reference. |
| `poses/cobra_pose.png` | Pose image (Bhujangasana) | Not wired into the app — see below. |
| `poses/mountain_pose.png` | Pose image (Tadasana) | Not wired into the app — see below. |
| `poses/tree_pose.png` | Pose image (Vrksasana) | Not wired into the app — see below. |
| `poses/warrior_pose.png` | Pose image (Virabhadrasana II) | Not wired into the app — see below. |

## About the 4 pose images

All four are correctly named and depict their pose in the same clean silhouette
style as the app's 6 bundled images. They were removed because
`src/data/poseImages.js` never `require()`d them, so they were not part of the
app bundle:

- **cobra / tree / warrior** — these poses *are* used by the app, but currently
  load from remote Unsplash URLs (tree, warrior) or a generic fallback (cobra).
  Wiring these local would be an upgrade: faster, offline-capable, consistent art.
- **mountain (Tadasana)** — not referenced by any pose in the current data; only
  useful if you add a Mountain/Tadasana pose.

### To actually use one of these images in the app

1. Re-encode it to a **real PNG** first. These files are JPEG data with a `.png`
   name, which the Metro bundler tolerates but the Android release build (AAPT2)
   rejects. (The 6 bundled images were already re-encoded.)
2. Copy it into `assets/poses/`.
3. Register it in `src/data/poseImages.js` under `localImages`, e.g.
   `tree_pose: require('../../assets/poses/tree_pose.png'),`
   (removing that id from `remoteImages` if present).
