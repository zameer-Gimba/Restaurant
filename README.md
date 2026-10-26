# E.M Restaurant

Online ordering site and staff dashboard for E.M Restaurant, running on Firebase (project `quickzu-app`).

| Page | File | Live address |
|---|---|---|
| Customer ordering site | `public/index.html` | https://quickzu-app.web.app |
| Staff dashboard | `public/admin/index.html` | https://quickzu-app.web.app/admin |

There is no server code. Both pages talk directly to Firebase:

- **Firestore** (the database): `products`, `categories`, `orders`, `settings/restaurant`.
- **Firebase Authentication**: the dashboard login (email + password).
- **Firestore Rules** (`firestore.rules`): who can read or change what.
- **Firebase Hosting**: serves the `public/` folder.

## One-time setup on your computer

1. Install [Node.js](https://nodejs.org) (the LTS version).
2. In this folder, run:
   ```
   npm install
   npx firebase login
   ```
   Sign in with the Google account that has access to the `quickzu-app` project.

## Everyday commands

| What | Command |
|---|---|
| Preview the site locally (http://localhost:5000) | `npm run serve` |
| Put the website live | `npm run deploy` |
| Test the security rules | `npm run test:rules` |
| Put the security rules live | `npm run deploy:rules` |

`npm run serve` uses the **live** database, so orders placed while previewing are real orders.

## Automatic publishing

Every change pushed to the `main` branch on GitHub is published to the live site automatically
(see `.github/workflows/deploy.yml`, which runs `scripts/deploy-hosting.mjs`; progress is shown in the
repo's **Actions** tab).
This needs a one-time GitHub secret named `FIREBASE_SERVICE_ACCOUNT` containing a Firebase
service account key (Firebase console → Project settings → Service accounts → Generate new private key).

## Security rules

`firestore.rules` allows:

- anyone to read the menu (`products`, `categories`) and `settings`;
- anyone to place an order, which must be well-formed and must start as `pending`;
- anyone to read a single order by its ID (the customer's order tracker);
- only the admin to list, change or delete orders, and to edit the menu and settings.

The admin is identified by a user ID that appears in **two places**, `firestore.rules` and
`ADMIN_UID` in `public/admin/index.html`. If the admin account changes, update both, then run
`npm run deploy:rules` and `npm run deploy`.

Before changing the rules, run `npm run test:rules` (needs Java installed).

## Payments

There is no payment gateway. When a customer picks "Paid Online", the order still arrives as
**pending**. Staff check that the money has actually arrived, then press **Mark paid** on the dashboard.
