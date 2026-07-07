# NeuroDirect v19 setup

## Simple setup

1. Upload all v19 files to GitHub.
2. Commit changes.
3. Enable Anonymous sign-in in Firebase.
4. Publish the v19 firestore.rules.
5. Open teen.html?v=19.
6. Save teen name.
7. Generate/save a new family code.
8. Add a calendar item.
9. Open parent.html?v=19.
10. Save parent name.
11. Enter the same family code.
12. Press refresh/check notifications.

## Why this version exists

v18 could connect but some save/sync actions could fail because Firestore rules were too strict and the app relied on cloud save first.

v19 saves locally first and syncs after.
