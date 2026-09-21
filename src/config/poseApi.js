/**
 * Mobile pose-correction API configuration.
 *
 * Resolution order:
 *  1. In a built APK (no Expo dev host), use HOSTED_API_URL if it is set —
 *     this is the deployed backend. See backend/README.md for redeploying it.
 *  2. In Expo dev, auto-detect the dev machine's LAN IP and use port 8000.
 *  3. Otherwise fall back to the hardcoded LAN IP below.
 */

import Constants from 'expo-constants';

// Deployed backend: AWS Lambda (container image) behind an API Gateway HTTP
// API, built from backend/Dockerfile.lambda. A bare Lambda Function URL was
// tried first but this AWS account silently blocks anonymous Function URL
// invocation (returns 403 with a correctly-configured public resource
// policy) -- API Gateway routes around that. Also available: Render
// (https://yoga-pose-engine.onrender.com, Docker web service under backend/).
const HOSTED_API_URL = 'https://vb57jykmzc.execute-api.us-east-1.amazonaws.com';

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
