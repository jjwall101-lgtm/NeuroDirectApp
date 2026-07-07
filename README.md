# NeuroDirect v20 DIRECT FAMILY SYNC

Flat no-folder package.

## Fixed in v20

- Child data now writes directly to the shared family-code space.
- Parent app now reads directly from that same family-code space.
- No more relying on the parent discovering a child profile first.
- Calendar, check-ins, tasks and notifications use:
  - families/{familyCode}/calendar
  - families/{familyCode}/checkins
  - families/{familyCode}/tasks
  - families/{familyCode}/notifications
- Saves still happen locally first.
- Firebase sync then mirrors the data to the shared family code.

## Required Firebase steps

1. Authentication -> Sign-in method -> Anonymous -> Enabled
2. Firestore Database -> Rules -> paste firestore.rules -> Publish

## Test links

Teen:
https://jjwall101-lgtm.github.io/teen.html?v=20

Parent:
https://jjwall101-lgtm.github.io/parent.html?v=20

## Important

After uploading v20, use a brand new family code for testing.
