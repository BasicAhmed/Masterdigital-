/** Firebase web config keys. The browser only receives env vars that start
 *  with NEXT_PUBLIC_, so if they were saved in Vercel under another name
 *  (NEXT_FIREBASE_API_KEY or FIREBASE_API_KEY), map them across here at build
 *  time. These values are Firebase's public web config — safe in the browser;
 *  access is controlled by Firestore rules and Auth, not by hiding them. */
const FIREBASE_KEYS = [
  "API_KEY",
  "AUTH_DOMAIN",
  "PROJECT_ID",
  "STORAGE_BUCKET",
  "MESSAGING_SENDER_ID",
  "APP_ID",
];

const env = {};
for (const key of FIREBASE_KEYS) {
  const value =
    process.env[`NEXT_PUBLIC_FIREBASE_${key}`] ||
    process.env[`NEXT_FIREBASE_${key}`] ||
    process.env[`FIREBASE_${key}`];
  if (value) env[`NEXT_PUBLIC_FIREBASE_${key}`] = value.trim();
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env,
};

module.exports = nextConfig;
