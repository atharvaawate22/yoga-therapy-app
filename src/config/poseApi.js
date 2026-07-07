/**
 * Mobile pose-correction API configuration.
 *
 * IMPORTANT:
 * - The app auto-detects your Expo dev host IP and uses port 8000 by default.
 * - If auto-detection fails, update the fallback URL below.
 */

import Constants from 'expo-constants';

const expoHostUri = Constants.expoConfig?.hostUri || '';
const detectedHost = expoHostUri.split(':')[0] || '';
const fallbackHost = '192.168.1.7';

export const POSE_API_BASE_URL = `http://${detectedHost || fallbackHost}:8000`;

export const POSE_API_ENDPOINTS = {
  analyze: '/analyze-pose',
  health: '/health',
};

export const POSE_API_TIMEOUT_MS = 30000;
