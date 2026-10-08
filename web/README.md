# Yoga Therapy — web app

The installable web version (PWA) of the Yoga Therapy app. Next.js 16 (App
Router), TypeScript, Tailwind, built as a fully static export. Pose logic lives
in [`../packages/pose-core`](../packages/pose-core) and is shared with the
Python backend's contract through parity tests.

Status and roadmap: [`docs/web-app-plan.md`](../docs/web-app-plan.md). This
folder is milestone M0 (scaffold): a landing page, CI and deployment.

## Develop

```bash
cd web
npm install          # also links ../packages/pose-core
npm run dev          # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules) |
| `npm run typecheck` | Generates Next route types, then `tsc --noEmit` |
| `npm test` | Vitest + Testing Library (jsdom) |
| `npm run build` | Static export to `out/` |
| `npm run preview` | Serves `out/` locally |

CI: [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml) runs
all of the above for `web/` and `packages/` on every PR and on pushes to
`main`. Changes here don't trigger the Android APK build.

## Layout notes

- `pose-core` is a `file:` dependency that ships TypeScript source, so
  `next.config.ts` lists it in `transpilePackages` and points `turbopack.root`
  at the repo root (Turbopack won't resolve files outside its root).
- `output: "export"`: there is no server. Inference will run in the browser.

## Deploy (Vercel)

One-time setup in the Vercel dashboard:

1. **Add New → Project**, import `atharvaawate22/yoga-therapy-app`.
2. **Root Directory:** `web`. Leave "Include files outside the root
   directory in the Build Step" **on**: the build needs `../packages`.
3. Framework preset **Next.js**; the defaults for build and output are right
   for a static export.
4. **Settings → Domains:** add `yoga.atharvaawate.me`, then create the DNS
   record Vercel shows (a `CNAME` for `yoga`) at the domain's DNS provider.

After that, pushes to `main` deploy production and every PR gets a preview URL.
