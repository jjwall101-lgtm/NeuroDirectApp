# NeuroDirect

NeuroDirect is a clean, premium, installable web app for teenagers aged 13–17. It is designed for focus support, wellbeing check-ins, planning, rewards and parent/carer overview.

## What is included

- `index.html` — main app file
- `style.css` — full responsive premium styling with light/dark mode
- `script.js` — local saving, check-ins, planner, focus timer, rewards, reports, import/export
- `manifest.json` — installable PWA setup
- `sw.js` — offline cache/service worker
- `logo.svg` — NeuroDirect logo
- `icon-192.png` and `icon-512.png` — app icons
- `UPLOAD_NOTES.txt` — simple upload instructions

## Features

- Teen dashboard
- Daily mood, energy, stress, focus, sleep and pressure check-ins
- Local-only saving using browser storage
- Task planner with coins for completed tasks
- Focus timer with coin rewards
- Reset toolkit: breathing, grounding, task shrinker and help script
- Rewards screen
- Parent/carer view protected by a simple PIN
- Copyable report
- Export/import JSON backup
- Light/dark mode
- Accent colour themes
- Fully responsive mobile layout
- PWA install support

## Default parent PIN

The default parent PIN is `1234` until changed in Settings.

## Important safety note

This app is a personal support and tracking tool. It is not a medical device, diagnostic tool, safeguarding system, or emergency support service. If a young person is unsafe or at risk, contact a trusted adult or emergency services immediately.

## GitHub Pages deployment

1. Create a new GitHub repository.
2. Upload every file from this package into the repository root.
3. Go to **Settings → Pages**.
4. Under **Build and deployment**, choose **Deploy from a branch**.
5. Choose the `main` branch and `/root` folder.
6. Save.
7. Wait for GitHub to publish the app.

## Cache/update note

The service worker cache is versioned as `neurodirect-cache-v1.0.0`. If you make future changes and the phone keeps showing an old version, update the cache name in `sw.js` to a newer version such as `neurodirect-cache-v1.0.1`.
