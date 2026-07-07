# NeuroDirect v19 SAVE BUTTON + SYNC FIX

Flat no-folder package.

## Fixed in v19

- Save buttons now save locally first.
- Firebase sync happens in the background.
- Teen and parent use separate hidden anonymous Firebase identities, even on the same phone/browser.
- Firestore rules are simplified for family-code linking.
- Calendar, tasks and check-ins should no longer disappear if Firebase sync fails.
- Parent app reads calendar, check-ins and notifications from the shared family code.

## Upload

Upload every file directly into your GitHub repo root.

Do not upload the ZIP itself.

## Firebase required

1. Authentication -> Sign-in method -> Anonymous -> Enabled
2. Firestore Database -> Rules -> paste firestore.rules -> Publish

## Test links

Teen:
https://jjwall101-lgtm.github.io/teen.html?v=19

Parent:
https://jjwall101-lgtm.github.io/parent.html?v=19

## Important

After uploading v19, use a new family code for testing.
