# NeuroDirect (v11 — Firebase configured)

This version has your Firebase config already inserted and Firebase enabled.

## Firebase project

Project ID:

`neurodirect-d62be`

## Included

- Firebase Authentication user profiles
- Email/password sign-up
- Email/password sign-in
- Sign-out
- Firestore user profile document at `users/{uid}`
- Save profile summary to cloud
- Load profile name from cloud
- Firebase config already added
- Firestore rules included

## Still required in Firebase Console

You still need to make sure these are enabled in Firebase:

1. Authentication → Sign-in method → Email/Password → Enabled
2. Firestore Database → Created
3. Firestore Rules → Published using `firestore.rules`

## Upload

Upload every file in this ZIP to the root of your GitHub Pages repo.
