/**
 * Non-destructive Firebase Authentication preflight.
 * Verify that the configured API key belongs to a usable Firebase web app.
 * This makes no account changes and never prints the API key.
 */
const key = process.env.VITE_FIREBASE_API_KEY?.trim();

if (!key) {
  console.error('Firebase authentication is NOT configured.');
  console.error('Set Actions secret VITE_FIREBASE_API_KEY to the Web API Key in');
  console.error('Firebase Console > Project settings > Your apps > Web app.');
  process.exit(1);
}

if (!/^AIza[\w-]{35}$/.test(key)) {
  console.error('Firebase authentication key has an invalid format.');
  process.exit(1);
}

try {
  // Verify the API key maps to the *existing* game project rather than a new one.
  const projectResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects?key=${encodeURIComponent(key)}`,
    {
      headers: { referer: 'https://hub-google.github.io/monster-arena-web/' },
      signal: AbortSignal.timeout(15000)
    }
  );
  const publicProject = await projectResponse.json();
  if (!projectResponse.ok) {
    throw new Error(`Firebase project lookup failed: ${publicProject.error?.message || projectResponse.status}`);
  }
  if (publicProject.projectId !== 'monster-arena-web-app') {
    throw new Error('The supplied API key points to the wrong Firebase project. Existing player data was not migrated.');
  }
  console.log('Firebase API key matches the expected monster-arena-web-app project.');

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'referer': 'https://hub-google.github.io/monster-arena-web/'
      },
      body: JSON.stringify({
        identifier: 'monster-arena-check@example.invalid',
        continueUri: 'https://hub-google.github.io/monster-arena-web/'
      }),
      signal: AbortSignal.timeout(15000)
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const serverMessage = data.error?.message || `HTTP ${response.status}`;
    console.error(`Firebase authentication preflight failed: ${serverMessage}`);
    console.error('Check that the API key matches the Firebase web app, and that Identity Toolkit API');
    console.error('and HTTP referrer restrictions allow hub-google.github.io.');
    process.exit(1);
  }
  console.log('Firebase Authentication preflight passed: the web API accepted the configuration.');
} catch (err) {
  console.error(`Firebase Authentication preflight could not connect: ${err.message}`);
  process.exit(1);
}
