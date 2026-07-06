# Firebase setup for NeuroDirect user profiles

This package adds Firebase Authentication and Firestore user profiles.

## 1. Create or open your Firebase project

Go to Firebase Console and create a project for NeuroDirect.

## 2. Add a Web App

In Firebase:

1. Open **Project settings**
2. Under **Your apps**, choose the web icon `</>`
3. Register the app
4. Copy the Firebase config object

## 3. Paste the config into the app

Open:

`firebase-config.js`

Replace the placeholder values with your Firebase config.

Then change:

```js
export const firebaseEnabled = false;
```

to:

```js
export const firebaseEnabled = true;
```

## 4. Enable Email/Password sign-in

In Firebase:

1. Go to **Authentication**
2. Open **Sign-in method**
3. Enable **Email/Password**

## 5. Create Firestore database

In Firebase:

1. Go to **Firestore Database**
2. Create database
3. Start in production mode
4. Choose a nearby region

## 6. Add Firestore rules

Use the included file:

`firestore.rules`

These rules allow each signed-in user to read and write only their own profile:

`users/{uid}`

## 7. Upload to GitHub

Upload every file from this package to the root of your GitHub Pages repo.

## 8. Test

Open the app:

1. Go to **Settings**
2. Find **Firebase user profiles**
3. Create a profile
4. Sign out
5. Sign back in
6. Save/load cloud profile

## What is synced in this version

This version syncs the user profile summary only:

- display name
- email
- role
- coin count summary
- check-in count
- task count

The full app data remains local for now. Full multi-device sync can be added next once profile login works.
