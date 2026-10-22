# Monster Arena Web

A Vite + React monster-raising web game with Firebase Authentication and Firestore.

- **Play:** https://hub-google.github.io/monster-arena-web/
- **Source:** https://github.com/hub-google/monster-arena-web
- **CI and deploy status:** https://github.com/hub-google/monster-arena-web/actions

## Local development

Node.js 22 is recommended.

```sh
npm install
npm run dev
npm run lint
npm run build
```

Production builds require `VITE_FIREBASE_API_KEY` — do not use any test or guessed API key. Retrieve the key from the **same** Firebase project that contains existing player accounts (`monster-arena-web-app`) under Firebase Console → Project settings → General → Your apps → Web app → SDK setup/config. The Web API key is a public Firebase app identifier, not a service-account secret.

### Fixing `auth/api-key-not-valid` on GitHub Pages

1. Open [Firebase Console](https://console.firebase.google.com/project/monster-arena-web-app/settings/general), choose the existing web app and copy the `apiKey` shown in its `firebaseConfig`. If there is no web app, register one **in that same project** (do not create a second project).
2. Open [repository Actions secrets](https://github.com/hub-google/monster-arena-web/settings/secrets/actions) and create a repository secret called **`VITE_FIREBASE_API_KEY`** with that value (no quotes). A repository Actions variable of the same name also works; secret takes priority.
3. Run [Build, check and deploy GitHub Pages](https://github.com/hub-google/monster-arena-web/actions/workflows/deploy.yml) using **Run workflow** on `master`. A successful run validates the Firebase Authentication endpoint with a read-only request, builds, runs Chromium smoke tests and publishes.
4. Make sure **Authentication → Sign-in method → Email/Password** is enabled for this Firebase project. If the validation fails due to API restrictions, allow the Identity Toolkit API and `https://hub-google.github.io` (or the project's intended referrer configuration) in Google Cloud API key settings.

The deployment **intentionally stops** if the Web API key is missing or rejected, to avoid releasing a broken login screen again. No real account or password is needed for the preflight.

Local development now uses the production Firebase configuration by default. Set `VITE_FIREBASE_API_KEY=...` in `.env.local` for non-emulator development. **Use the Firebase emulators when developing or testing changes that write game data.** Create a local `.env.local` containing `VITE_USE_FIREBASE_EMULATORS=true` and run `npx firebase emulators:start` alongside Vite. Never run the historical destructive E2E test suites against production.

## Deployment

Commits to `master` automatically run lint, build and a real Chromium browser smoke test, then publish the built `dist/` folder to the `gh-pages` branch. GitHub Pages continues to serve that branch under `/monster-arena-web/`. The build also verifies the Firebase Authentication API key with a non-destructive request. The Chromium smoke test checks that the login and registration UI renders without JavaScript exceptions; it does **not** validate actual user sign-in or every authenticated game flow.

## Important: Firebase rules must be published separately

`firestore.rules` in this repository has been changed from its original open-to-everyone policy to owner-scoped/private-data rules. **GitHub Pages does not deploy Firestore rules.** To activate these permissions on Firebase project `monster-arena-web-app`, an administrator must review and deploy them:

```sh
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project monster-arena-web-app
```

Until the Firebase console confirms a successful rules deployment, the live database may still be governed by the original permissive rules. Rules changes must be tested in the emulator with representative existing accounts first. Existing accounts publish their public username into `public_profiles` upon sign-in, so older users may not appear in friend/leader lookups until they sign in again.

**Remaining architectural limitation:** this is a client-driven prototype. Owner-only Firestore rules prevent users from modifying another player's private profile or monsters, but do not prevent a player from falsifying their own gold, stamina, quest or combat results by calling Firestore directly. For competitive or paid gameplay, move authoritative inventory/economy/raid/battle updates into authenticated Cloud Functions or another trusted backend, and test denial cases before enabling purchases.

## Tests

The new `tests/smoke.spec.js` is non-destructive and is run automatically in CI. The older `tests/run_tests.spec.js` and `tests/run_all_scenarios.spec.js` modify Firestore and are disabled unless both `FIRESTORE_EMULATOR_HOST` and `RUN_DESTRUCTIVE_E2E` are explicitly provided. The old test plans require additional updates before they can be relied upon as end-to-end regression coverage.
