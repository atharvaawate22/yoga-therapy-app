# App Assets

## `poses/`

Local pose reference images bundled into the app. These six are `require()`d by
[`src/data/poseImages.js`](../src/data/poseImages.js); every other pose falls
back to a curated remote image, so only add a file here if you also register it
in `poseImages.js`.

| File | Pose |
|------|------|
| `downward_dog.png` | Adho Mukha Svanasana |
| `low_lunge.png` | Anjaneyasana |
| `seated_twist.png` | Ardha Matsyendrasana |
| `butterfly_pose.png` | Baddha Konasana |
| `childs_pose.png` | Balasana |
| `cat_cow.png` | Bitilasana–Marjaryasana |

**Format:** must be genuine PNG files (real PNG signature, not JPEG data renamed
to `.png`) — the Android release build's resource compiler (AAPT2) rejects
mislabeled images, even though the Metro bundler tolerates them.

## App icon & splash

No custom icon/splash image files are committed yet; the app currently uses
Expo defaults with the theme background color set in
[`app.config.js`](../app.config.js). To brand the app, add `icon.png` (1024×1024)
and an adaptive icon, then reference them under `android.adaptiveIcon` / `ios` in
`app.config.js`.
