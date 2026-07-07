# NeuroDirect v17 FAMILY CODE ONLY

This is the flat no-folder package with visible Firebase sign-in removed.

## What changed

- No email sign-in screen.
- No password sign-in screen.
- Teen app links using family code only.
- Parent app links using family code only.
- Firebase still runs silently in the background using anonymous authentication.
- Rewards and coins remain removed.
- Calendar and parent in-app notifications remain included.

## Upload

Upload every file in this package directly into your GitHub repo root.

Do not upload the ZIP itself.

## URLs

Teen:

https://jjwall101-lgtm.github.io/teen.html

Parent:

https://jjwall101-lgtm.github.io/parent.html

## Firebase setup required

In Firebase Console, enable:

Authentication -> Sign-in method -> Anonymous

Also publish the updated Firestore rules from:

firestore.rules

## How linking works

1. Teen opens teen.html.
2. Teen enters name.
3. Teen generates or enters a family code.
4. Parent opens parent.html.
5. Parent enters the same family code.
6. Parent can then see linked calendar items, check-ins and in-app notifications.

## Important

Anyone with the family code can link to that family space. Use a private code.
