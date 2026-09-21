/**
 * Mobile pose-correction API configuration.
 *
 * Resolution order:
 *  1. In a built APK (no Expo dev host), use HOSTED_API_URL if it is set —
 *     this is your deployed backend (e.g. a Hugging Face Space). See
 *     backend/README.md for how to deploy and get this URL.
 *  2. In Expo dev, auto-detect the dev machine's LAN IP and use port 8000.
 *  3. Otherwise fall back to the hardcoded LAN IP below.
 */

import Constants from 'expo-constants';

// Set this to your deployed backend base URL to make the installed APK work
// without a laptop on the same Wi-Fi, e.g.
//   'https://your-user-yoga-pose-engine.hf.space'
// Leave '' to always use dev auto-detection / the LAN fallback.
const HOSTED_API_URL = '';

const expoHostUri = Constants.expoConfig?.hostUri || '';
const detectedHost = expoHostUri.split(':')[0] || '';
const fallbackHost = '192.168.1.7';
const isExpoDev = Boolean(expoHostUri); // empty in a standalone/APK build

export const POSE_API_BASE_URL =
  !isExpoDev && HOSTED_API_URL
    ? HOSTED_API_URL.replace(/\/+$/, '')
    : `http://${detectedHost || fallbackHost}:8000`;

export const POSE_API_ENDPOINTS = {
  analyze: '/analyze-pose',
  health: '/health',
};

// Generous timeout: a hosted free-tier backend can cold-start on the first
// request (~30–60s) before responses become fast.
export const POSE_API_TIMEOUT_MS = 60000;
