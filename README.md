# NeuroDirect v23 PARENT CREATES CODE

Flat no-folder package.

## Built from stable sync baseline

This version keeps the working Firebase/family-code sync structure from v20/v22.

## What changed in v23

- Parent app can now create the family code first.
- Parent Settings now has:
  - Save family code
  - Generate code
  - Copy code
- Teen app can join the code created by Parent.
- Teen Settings wording now explains that the teen can join a parent-created code.
- Generated codes are copied automatically where supported.
- Parent dashboard sync stats fixed so the v22 mock-up dashboard cards update properly.
- Red/default theme and all Settings theme options remain.
- No Firestore structure change.

## Recommended setup flow

1. Open Parent app.
2. Settings -> Generate code.
3. Copy/share the generated code.
4. Open Teen app.
5. Settings -> paste the same code -> Save family code.
6. Sync starts.

## Test links

Teen:
https://jjwall101-lgtm.github.io/teen.html?v=23

Parent:
https://jjwall101-lgtm.github.io/parent.html?v=23

## Upload

Upload every file directly into your GitHub repo root.

Do not upload the ZIP itself.
