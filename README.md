# NeuroDirect v18 FAMILY CODE LINK FIX

This is the flat no-folder package.

## Fixed in v18

- Fixes the child app struggling to connect when the parent app created the family code first.
- The app now joins the family in the correct Firestore order:
  1. create member record
  2. create child/parent profile
  3. update family record
- Keeps family-code-only setup.
- Keeps visible Firebase email/password sign-in removed.
- Keeps calendar, check-ins and parent in-app notifications.

## Upload

Upload every file in this package directly into your GitHub repo root.

Do not upload the ZIP itself.

## Required Firebase setting

Authentication -> Sign-in method -> Anonymous -> Enabled

## Required Firestore rule step

Publish the included firestore.rules in:

Firestore Database -> Rules -> Publish

## URLs

Teen:
https://jjwall101-lgtm.github.io/teen.html

Parent:
https://jjwall101-lgtm.github.io/parent.html
