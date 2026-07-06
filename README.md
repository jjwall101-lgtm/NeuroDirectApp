# NeuroDirect (v10 — Firebase user profiles)

This version adds Firebase-ready user profiles while keeping the existing local app features.

## Added

- Firebase Authentication panel in Settings
- Email/password sign-up
- Email/password sign-in
- Sign-out
- Firestore user profile document at `users/{uid}`
- Save profile summary to cloud
- Load profile name from cloud
- Firebase config placeholder file
- Firestore security rules
- Firebase setup guide

## Important

Firebase is disabled until you paste your real Firebase config into:

`firebase-config.js`

Then change:

`firebaseEnabled = false`

to:

`firebaseEnabled = true`

## Files to upload

Upload everything in this ZIP to your GitHub Pages repo root.

## Default parent PIN

`1234`
