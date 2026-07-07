# NeuroDirect v20 setup

## Simple setup

1. Upload all v20 files to GitHub.
2. Commit changes.
3. Enable Anonymous sign-in in Firebase.
4. Publish the v20 firestore.rules.
5. Open teen.html?v=20.
6. Save teen name.
7. Generate/save a new family code.
8. Add a calendar item and check-in.
9. Open parent.html?v=20.
10. Save parent name.
11. Enter exactly the same family code.
12. Press refresh/check notifications.

## Why v20 exists

The previous version saved child data under the child profile. The parent then had to discover that child profile before it could show data.

v20 writes the child data directly into the shared family-code collections, which is much more reliable.
