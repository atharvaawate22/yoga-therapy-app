import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { colors, typography, spacing, borderRadius, screenStyles, shadows } from '../theme/theme';
import { POSE_API_BASE_URL, POSE_API_ENDPOINTS, POSE_API_TIMEOUT_MS } from '../config/poseApi';
import { getUserProfile, getVoiceEnabled } from '../data/userStorage';
import { getNextDemoResult } from '../data/demoPoseData';
import { savePracticeSession, formatDuration } from '../data/sessionStorage';
import ExperienceBadge from '../components/ExperienceBadge';

const defaultResult = {
  pose: 'nopose',
  confidence: 0,
  corrections: ['No clear pose detected'],
  distances: {},
};

// Common (English) name shown first and spoken aloud -- the Sanskrit name
// alone ("Vrksasana") means nothing to most users; "Tree Pose" does.
const POSE_COMMON_NAMES = {
  downward_dog: 'Downward-Facing Dog',
  low_lunge: 'Low Lunge',
  seated_twist: 'Seated Spinal Twist',
  butterfly_pose: 'Butterfly Pose',
  childs_pose: "Child's Pose",
  cat_cow: 'Cat-Cow Stretch',
  plow_pose: 'Plow Pose',
  garland_pose: 'Garland Pose',
  boat_pose: 'Boat Pose',
  seated_forward_bend: 'Seated Forward Bend',
  shoulder_stand: 'Shoulder Stand',
  bridge_pose: 'Bridge Pose',
  triangle_pose: 'Triangle Pose',
  upward_dog: 'Upward-Facing Dog',
  chair_pose: 'Chair Pose',
  forward_bend: 'Standing Forward Fold',
  warrior_pose: 'Warrior II',
  tree_pose: 'Tree Pose',
  pranamasana: 'Prayer Pose',
  hasta_uttanasana: 'Raised Arms Pose',
  hasta_padasana: 'Hand to Foot Pose',
  ashwa_sanchalanasana: 'Equestrian Pose',
  dandasana: 'Plank Pose',
  ashtanga_namaskara: 'Eight-Limbed Pose',
  cobra_pose: 'Cobra Pose',
  tadasana: 'Mountain Pose',
  nopose: 'No Pose',
  // Retained for a classifier trained before these labels were merged into
  // downward_dog / cobra_pose / forward_bend. A retrained model never emits them.
  adho_mukha_svanasana: 'Downward-Facing Dog',
  bhujangasana: 'Cobra Pose',
  uttanasana: 'Standing Forward Fold',
};

// Sanskrit name shown as a subtitle under the common name -- never spoken
// aloud on its own (see speakCorrection), just for reference.
const POSE_SANSKRIT_NAMES = {
  downward_dog: 'Adho Mukha Svanasana',
  low_lunge: 'Anjaneyasana',
  seated_twist: 'Ardha Matsyendrasana',
  butterfly_pose: 'Baddha Konasana',
  childs_pose: 'Balasana',
  cat_cow: 'Bitilasana',
  plow_pose: 'Halasana',
  garland_pose: 'Malasana',
  boat_pose: 'Navasana',
  seated_forward_bend: 'Paschimottanasana',
  shoulder_stand: 'Salamba Sarvangasana',
  bridge_pose: 'Setu Bandha Sarvangasana',
  triangle_pose: 'Trikonasana',
  upward_dog: 'Urdhva Mukha Svanasana',
  chair_pose: 'Utkatasana',
  forward_bend: 'Uttanasana',
  warrior_pose: 'Virabhadrasana Two',
  tree_pose: 'Vrksasana',
  pranamasana: 'Pranamasana',
  hasta_uttanasana: 'Hasta Uttanasana',
  hasta_padasana: 'Hasta Padasana',
  ashwa_sanchalanasana: 'Ashwa Sanchalanasana',
  dandasana: 'Dandasana',
  ashtanga_namaskara: 'Ashtanga Namaskara',
  cobra_pose: 'Bhujangasana',
  tadasana: 'Tadasana',
  adho_mukha_svanasana: 'Adho Mukha Svanasana',
  bhujangasana: 'Bhujangasana',
  uttanasana: 'Uttanasana',
};

// Backward-compatible alias: existing lookups (POSE_DISPLAY_NAMES[id]) keep
// working and now resolve to the common name.
const POSE_DISPLAY_NAMES = POSE_COMMON_NAMES;

const PoseCorrectorScreen = ({ route }) => {
  const expectedPoseId = route?.params?.expectedPoseId || null;
  const expectedPoseName = route?.params?.expectedPoseName || null;
  const cameraRef = useRef(null);
  const liveDetectionTimerRef = useRef(null);
  const liveDetectingRef = useRef(false);
  const lastSpokenCorrectionRef = useRef('');

  const [permission, requestPermission] = useCameraPermissions();
  // Rear camera by default: fitting a standing full-body pose into frame
  // with the front (selfie) camera needs an awkward arm's-length distance
  // and a narrower field of view, which was making the body-presence gate
  // fail even with a correctly working pipeline. Users can still flip back.
  const [cameraFacing, setCameraFacing] = useState('back');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLiveDetection, setIsLiveDetection] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState('live');
  const [result, setResult] = useState(defaultResult);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [experienceLevel, setExperienceLevel] = useState('beginner');
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState(null); // null = checking
  const [liveSummary, setLiveSummary] = useState(null);
  const liveStartTsRef = useRef(null);
  const livePoseCountsRef = useRef({});

  const sessionId = useMemo(() => `session-${Date.now()}-${Math.floor(Math.random() * 1000000)}`, []);
  const apiUrl = useMemo(() => `${POSE_API_BASE_URL}${POSE_API_ENDPOINTS.analyze}`, []);
  const healthUrl = useMemo(() => `${POSE_API_BASE_URL}${POSE_API_ENDPOINTS.health}`, []);

  useEffect(() => { requestPermission(); }, [requestPermission]);

  // Ping the backend once on mount so users see upfront if analysis is unavailable
  const checkBackend = useCallback(async () => {
    setIsBackendOnline(null);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      setIsBackendOnline(response.ok);
    } catch {
      setIsBackendOnline(false);
    }
  }, [healthUrl]);

  useEffect(() => { checkBackend(); }, [checkBackend]);

  useEffect(() => {
    ImagePicker.requestMediaLibraryPermissionsAsync();
    getUserProfile().then(p => { if (p?.experience) setExperienceLevel(p.experience); });
    getVoiceEnabled().then(setIsVoiceEnabled);
  }, []);

  // Cleanup speech and timer on unmount; save any in-progress live session
  useEffect(() => {
    return () => {
      liveDetectingRef.current = false;
      if (liveDetectionTimerRef.current) clearTimeout(liveDetectionTimerRef.current);
      Speech.stop();
      finalizeLiveSession(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const speakCorrection = (corrections, pose) => {
    if (!isVoiceEnabled || !corrections?.length) return;
    const correction = corrections[0];
    if (!correction || correction === lastSpokenCorrectionRef.current) return;
    lastSpokenCorrectionRef.current = correction;
    const poseName = POSE_DISPLAY_NAMES[pose] || pose;
    const message = pose && pose !== 'nopose'
      ? `${poseName}. ${correction}`
      : correction;
    Speech.stop();
    Speech.speak(message, {
      language: 'en-IN',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const analyzeBase64Image = async (imageBase64, source = 'image', showAlerts = true) => {
    if (!imageBase64 || isAnalyzing) return;
    const controller = new AbortController();
    let timeoutId;
    try {
      setIsAnalyzing(true);
      timeoutId = setTimeout(() => controller.abort(), POSE_API_TIMEOUT_MS);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          session_id: sessionId,
          source,
          experience_level: experienceLevel,
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const text = await response.text();
        const error = new Error(text || 'Pose API request failed.');
        // A gateway/service-unavailable status (502/503/504) means the
        // backend infra itself didn't respond in time -- e.g. a cold
        // serverless container taking longer to start than the gateway's
        // own timeout allows -- not a real application error, so it's
        // handled the same as an unreachable backend below.
        error.isGatewayUnavailable = [502, 503, 504].includes(response.status);
        throw error;
      }
      const payload = await response.json();
      const newResult = {
        pose: payload.pose ?? 'nopose',
        confidence: payload.confidence ?? 0,
        corrections: payload.corrections?.length ? payload.corrections : ['No clear pose detected'],
        distances: payload.distances ?? {},
      };
      setIsDemoMode(false);
      setResult(newResult);
      setLastUpdated(new Date());
      setIsBackendOnline(true);
      // Track detections + speak correction in live mode
      if (source === 'live') {
        if (newResult.pose && newResult.pose !== 'nopose') {
          livePoseCountsRef.current[newResult.pose] =
            (livePoseCountsRef.current[newResult.pose] || 0) + 1;
        }
        speakCorrection(newResult.corrections, newResult.pose);
      }
    } catch (error) {
      const isUnreachable = error?.name === 'AbortError'
        || error?.message === 'Network request failed'
        || error?.isGatewayUnavailable;
      if (isUnreachable) {
        // Show the offline banner (with Retry), then fall back to a simulated
        // result so the corrector still demonstrates the feature end-to-end.
        // Demo results are never counted toward a saved practice session.
        setIsBackendOnline(false);
        const demoResult = getNextDemoResult();
        setIsDemoMode(true);
        setResult(demoResult);
        setLastUpdated(new Date());
        setLiveError(null);
        if (source === 'live') speakCorrection(demoResult.corrections, demoResult.pose);
      } else {
        const message = error?.message || 'Failed to analyze pose.';
        if (showAlerts) Alert.alert('Pose Analysis Error', message);
        else setLiveError(message);
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const analyzeCurrentFrame = async (source = 'live', showAlerts = true) => {
    if (!cameraRef.current || isAnalyzing) return;
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: source === 'live' ? 0.3 : 0.5,
        // skipProcessing returns the raw, un-rotated sensor frame (only an
        // EXIF orientation tag notes the correction), which the backend's
        // OpenCV decode doesn't reliably honor -- it then center-crops a
        // square from the wrong orientation, cutting off most of the body
        // before MoveNet ever sees it. Letting the camera normalize
        // orientation costs a little capture speed but is required for
        // the body-presence gate to actually see a full body.
        shutterSound: false,
      });
      if (!photo?.base64) throw new Error('Unable to capture frame from camera.');
      setSelectedImageUri(null);
      await analyzeBase64Image(photo.base64, source, showAlerts);
    } catch (error) {
      if (!showAlerts) {
        // Live mode: camera not ready/available yet — show a simulated
        // result rather than a raw error, same as an unreachable backend.
        const demoResult = getNextDemoResult();
        setIsDemoMode(true);
        setResult(demoResult);
        setLastUpdated(new Date());
        speakCorrection(demoResult.corrections, demoResult.pose);
        return;
      }
      const message = error?.message || 'Failed to analyze pose.';
      Alert.alert('Pose Analysis Error', message);
    }
  };

  // Save a live session to history if it was long enough to be meaningful
  const finalizeLiveSession = (showSummary = true) => {
    const startTs = liveStartTsRef.current;
    liveStartTsRef.current = null;
    if (!startTs) return;
    const durationSec = Math.round((Date.now() - startTs) / 1000);
    const counts = livePoseCountsRef.current || {};
    const detected = Object.keys(counts);
    if (durationSec < 15 || detected.length === 0) return;
    const topPoseId = detected.sort((a, b) => counts[b] - counts[a])[0];
    savePracticeSession({
      type: 'corrector',
      title: 'Pose Corrector',
      posesCompleted: detected.length,
      poseCount: detected.length,
      durationSec,
    });
    if (showSummary) {
      setLiveSummary({
        durationSec,
        poseCount: detected.length,
        topPose: POSE_DISPLAY_NAMES[topPoseId] || topPoseId,
      });
    }
  };

  const stopLiveDetection = () => {
    liveDetectingRef.current = false;
    if (liveDetectionTimerRef.current) {
      clearTimeout(liveDetectionTimerRef.current);
      liveDetectionTimerRef.current = null;
    }
    Speech.stop();
    lastSpokenCorrectionRef.current = '';
    setIsLiveDetection(false);
    finalizeLiveSession();
  };

  const runLiveLoop = () => {
    if (!liveDetectingRef.current) return;
    analyzeCurrentFrame('live', false).finally(() => {
      if (!liveDetectingRef.current) return;
      liveDetectionTimerRef.current = setTimeout(runLiveLoop, 850);
    });
  };

  const startLiveDetection = async () => {
    if (isLiveDetection || !cameraRef.current || !isCameraReady) return;
    setLiveError(null);
    setSelectedImageUri(null);
    setLiveSummary(null);
    lastSpokenCorrectionRef.current = '';
    liveStartTsRef.current = Date.now();
    livePoseCountsRef.current = {};
    liveDetectingRef.current = true;
    setIsLiveDetection(true);
    runLiveLoop();
  };

  const toggleLiveDetection = async () => {
    if (isLiveDetection) { stopLiveDetection(); return; }
    await startLiveDetection();
  };

  const toggleVoice = () => {
    if (isVoiceEnabled) {
      Speech.stop();
      lastSpokenCorrectionRef.current = '';
    }
    setIsVoiceEnabled(v => !v);
  };

  const openFeedbackMode = (mode) => {
    if (mode === feedbackMode) return;
    stopLiveDetection();
    setLiveError(null);
    if (mode === 'live') setSelectedImageUri(null);
    setFeedbackMode(mode);
  };

  useEffect(() => {
    if (!permission?.granted || feedbackMode !== 'live' || !isCameraReady || selectedImageUri || isLiveDetection) return;
    startLiveDetection();
  }, [permission?.granted, feedbackMode, isCameraReady, selectedImageUri, isLiveDetection]);

  const analyzeFromGallery = async () => {
    if (isAnalyzing) return;
    stopLiveDetection();
    const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!mediaPermission.granted) {
      Alert.alert('Permission needed', 'Please allow gallery access to pick an image.');
      return;
    }
    // allowsEditing opens a manual crop step with no aspect ratio enforced --
    // its initial crop box is not the full image, so a user who taps confirm
    // without dragging it out to the edges silently sends a cropped photo
    // that's already missing body parts, no matter what the backend does
    // with it. Send the original full photo instead.
    const picked = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false, quality: 0.45, base64: true, mediaTypes: ['images'],
    });
    if (picked.canceled || !picked.assets?.length) return;
    const asset = picked.assets[0];
    if (!asset.base64) { Alert.alert('Invalid image', 'Unable to read selected image.'); return; }
    setSelectedImageUri(asset.uri ?? null);
    await analyzeBase64Image(asset.base64, 'image');
  };

  const toggleCamera = () => {
    stopLiveDetection();
    setIsCameraReady(false);
    setCameraFacing(prev => prev === 'front' ? 'back' : 'front');
  };

  const testBackendConnection = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(healthUrl, { method: 'GET', signal: controller.signal });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Backend returned status ${response.status}`);
      Alert.alert('Backend OK', `Connected successfully to ${healthUrl}`);
    } catch {
      Alert.alert('Backend Unreachable',
        `Cannot reach ${healthUrl}.\n\n1. Start backend API on laptop.\n2. Keep phone + laptop on same Wi-Fi.\n3. Allow Python/port 8000 in Windows Firewall.`);
    }
  };

  const poseDisplayName = POSE_DISPLAY_NAMES[result.pose] || result.pose?.toUpperCase();
  const poseSanskritName = POSE_SANSKRIT_NAMES[result.pose] || null;
  const expectedDisplay = expectedPoseId
    ? (POSE_DISPLAY_NAMES[expectedPoseId] || expectedPoseName || expectedPoseId)
    : null;
  const isExpectedMatch = expectedPoseId ? result.pose === expectedPoseId : false;

  if (!permission) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.helperText}>Requesting camera permission...</Text>
      </SafeAreaView>
    );
  }
  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.centeredContainer}>
        <Text style={styles.permissionTitle}>Camera access is required</Text>
        <Text style={styles.helperText}>Enable camera permission in settings to use live pose correction.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Live Pose Corrector</Text>
        <Text style={styles.subtitle}>Real-time AI pose detection with instant voice + visual corrections.</Text>

        {/* Backend offline banner */}
        {isBackendOnline === false && (
          <View style={styles.offlineBanner}>
            <Text style={styles.offlineTitle}>⚠️ Analysis server unreachable</Text>
            <Text style={styles.offlineText}>
              Pose detection needs the backend running. Start it on your laptop and keep both devices on the same Wi-Fi.
            </Text>
            <TouchableOpacity style={styles.offlineRetryBtn} onPress={checkBackend} activeOpacity={0.8}>
              <Text style={styles.offlineRetryText}>↻ Retry Connection</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode Toggle */}
        <View style={styles.featureSwitchCard}>
          <Text style={styles.featureSwitchTitle}>Feedback Mode</Text>
          <View style={styles.featureSwitchRow}>
            {['live', 'image'].map(mode => (
              <TouchableOpacity
                key={mode}
                style={[styles.featureSwitchButton, feedbackMode === mode ? styles.featureSwitchButtonActive : styles.featureSwitchButtonIdle]}
                onPress={() => openFeedbackMode(mode)}
                activeOpacity={0.85}
              >
                <Text style={[styles.featureSwitchButtonText, feedbackMode === mode && styles.featureSwitchButtonTextActive]}>
                  {mode === 'live' ? '📹 Live' : '🖼️ Image'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Section heading */}
        <View style={styles.liveFeedbackSection}>
          <Text style={styles.liveFeedbackTitle}>
            {feedbackMode === 'live' ? 'Live Feedback' : 'Image Feedback'}
          </Text>
          <Text style={styles.liveFeedbackSubtitle}>
            {feedbackMode === 'live'
              ? 'Camera detects your pose and speaks corrections aloud.'
              : 'Upload a photo to get pose correction feedback.'}
          </Text>
        </View>

        {expectedDisplay ? (
          <View style={styles.targetPoseCard}>
            <Text style={styles.targetPoseLabel}>Target pose</Text>
            <Text style={styles.targetPoseName}>{expectedDisplay}</Text>
            <Text style={[styles.targetPoseStatus, isExpectedMatch && styles.targetPoseStatusMatch]}>
              {isExpectedMatch ? 'Matched ✅' : 'Not matched yet'}
            </Text>
          </View>
        ) : null}

        {/* Camera Card */}
        <View style={styles.cameraCard}>
          {feedbackMode === 'image' && selectedImageUri ? (
            <Image source={{ uri: selectedImageUri }} style={styles.camera} resizeMode="cover" />
          ) : (
            <View style={styles.camera}>
              <CameraView
                ref={cameraRef}
                style={StyleSheet.absoluteFillObject}
                facing={cameraFacing}
                animateShutter={false}
                onCameraReady={() => setIsCameraReady(true)}
              />
            </View>
          )}

          {/* Live overlay */}
          {feedbackMode === 'live' && (
            <View style={styles.liveOverlay}>
              <View style={styles.liveOverlayTop}>
                <View style={[styles.liveStatusDot, { backgroundColor: isLiveDetection ? '#69F0AE' : '#FF5252' }]} />
                <Text style={styles.liveOverlayTitle}>
                  {isLiveDetection ? 'LIVE DETECTION ON' : 'LIVE DETECTION OFF'}
                </Text>
              </View>
              <Text style={styles.liveOverlayPose}>{poseDisplayName}</Text>
              {poseSanskritName && (
                <Text style={styles.liveOverlaySanskrit}>{poseSanskritName}</Text>
              )}
              <Text style={styles.liveOverlayConf}>Confidence: {(Number(result.confidence) * 100).toFixed(0)}%</Text>
              <Text style={styles.liveOverlayHint}>{result.corrections?.[0] || 'No correction available'}</Text>
            </View>
          )}

          {/* Live controls */}
          {feedbackMode === 'live' ? (
            <View style={styles.liveControlsRow}>
              <View style={styles.cameraActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={toggleCamera} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>⇄ Flip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.liveToggleButton, isLiveDetection ? styles.liveToggleButtonStop : styles.liveToggleButtonStart]}
                  onPress={toggleLiveDetection}
                  activeOpacity={0.85}
                >
                  <Text style={styles.liveToggleText}>
                    {isLiveDetection ? '⏹ Stop Live' : '▶ Start Live'}
                  </Text>
                </TouchableOpacity>
                {/* Voice Toggle Button */}
                <TouchableOpacity
                  style={[styles.voiceToggleButton, isVoiceEnabled ? styles.voiceToggleOn : styles.voiceToggleOff]}
                  onPress={toggleVoice}
                  activeOpacity={0.85}
                >
                  <Text style={styles.voiceToggleText}>{isVoiceEnabled ? '🔊' : '🔇'}</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.liveStatusText}>
                {isLiveDetection
                  ? `Live active · Voice ${isVoiceEnabled ? 'ON 🔊' : 'OFF 🔇'}`
                  : 'Tap ▶ Start Live for continuous feedback'}
              </Text>
              {liveError ? <Text style={styles.liveErrorText}>⚠ {liveError}</Text> : null}
            </View>
          ) : (
            <>
              <View style={styles.cameraActions}>
                <TouchableOpacity style={styles.secondaryButton} onPress={toggleCamera} activeOpacity={0.8}>
                  <Text style={styles.secondaryButtonText}>⇄ Flip</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, isAnalyzing && styles.buttonDisabled]}
                  onPress={() => analyzeCurrentFrame('image')}
                  disabled={isAnalyzing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.primaryButtonText}>{isAnalyzing ? 'Analyzing...' : '📸 Capture & Analyze'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.galleryRow}>
                <TouchableOpacity
                  style={[styles.galleryButton, isAnalyzing && styles.buttonDisabled]}
                  onPress={analyzeFromGallery}
                  disabled={isAnalyzing}
                  activeOpacity={0.8}
                >
                  <Text style={styles.galleryButtonText}>🖼️ Upload from Gallery</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* Live session summary */}
        {liveSummary && feedbackMode === 'live' && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>✅ Session saved to your progress</Text>
            <Text style={styles.summaryText}>
              {formatDuration(liveSummary.durationSec)} practiced · {liveSummary.poseCount} pose
              {liveSummary.poseCount !== 1 ? 's' : ''} detected · Most held: {liveSummary.topPose}
            </Text>
          </View>
        )}

        {/* Result Card */}
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.sectionTitle}>Latest Result</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {isDemoMode && (
                <View style={styles.demoBadge}>
                  <Text style={styles.demoBadgeText}>DEMO</Text>
                </View>
              )}
              <ExperienceBadge level={experienceLevel} small />
            </View>
          </View>
          {isDemoMode && (
            <Text style={styles.demoNoticeText}>⚠ Backend not detected — showing simulated demo analysis.</Text>
          )}
          <Text style={styles.resultPose}>{poseDisplayName}</Text>
          {poseSanskritName && (
            <Text style={styles.resultSanskrit}>{poseSanskritName}</Text>
          )}
          <Text style={styles.resultText}>Confidence: {(Number(result.confidence) * 100).toFixed(0)}%</Text>
          <Text style={styles.lastUpdatedText}>
            Last updated: {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Not analyzed yet'}
          </Text>

          <Text style={styles.subSectionTitle}>🗣️ Corrections</Text>
          {result.corrections.slice(0, 3).map((item, index) => (
            <View key={`${item}-${index}`} style={styles.correctionRow}>
              <View style={styles.correctionBullet}>
                <Text style={styles.correctionBulletText}>{index + 1}</Text>
              </View>
              <Text style={styles.correctionText}>{item}</Text>
            </View>
          ))}

          {/* Voice status indicator */}
          <View style={styles.voiceStatusRow}>
            <Text style={styles.voiceStatusText}>
              {isVoiceEnabled
                ? '🔊 Voice corrections active — corrections spoken during live detection'
                : '🔇 Voice off — tap the speaker icon to enable voice corrections'}
            </Text>
          </View>
        </View>

        {/* Backend Connection */}
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>Backend Connection</Text>
          <Text style={styles.noteBody}>API: {apiUrl}</Text>
          <Text style={styles.noteBody}>Ensure phone + laptop are on the same Wi-Fi network.</Text>
          <TouchableOpacity style={styles.healthButton} onPress={testBackendConnection} activeOpacity={0.8}>
            <Text style={styles.healthButtonText}>Test Backend Connection</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { ...screenStyles.container },
  scrollContent: { padding: spacing.md, paddingBottom: spacing.xl },
  centeredContainer: { ...screenStyles.container, justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  title: { ...typography.headerMedium, color: colors.primary, marginBottom: 2 },
  subtitle: { ...typography.bodySmall, color: colors.textLight, marginBottom: spacing.md },
  offlineBanner: {
    backgroundColor: '#FFF8E1', borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  offlineTitle: { ...typography.bodySmall, fontWeight: '700', color: '#795548' },
  offlineText: { ...typography.caption, color: '#795548', marginTop: 4, lineHeight: 17 },
  offlineRetryBtn: {
    alignSelf: 'flex-start', backgroundColor: colors.warning, borderRadius: borderRadius.md,
    paddingVertical: 8, paddingHorizontal: spacing.md, marginTop: spacing.sm,
  },
  offlineRetryText: { ...typography.caption, fontWeight: '700', color: colors.textWhite },
  summaryCard: {
    backgroundColor: colors.cardAlt, borderRadius: borderRadius.lg, padding: spacing.md,
    marginBottom: spacing.md, borderLeftWidth: 4, borderLeftColor: colors.success,
  },
  summaryTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.primary },
  summaryText: { ...typography.caption, color: colors.textLight, marginTop: 4, lineHeight: 17 },
  liveFeedbackSection: { marginBottom: spacing.sm },
  featureSwitchCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.card,
  },
  featureSwitchTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  featureSwitchRow: { flexDirection: 'row', gap: spacing.sm },
  featureSwitchButton: { flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center' },
  featureSwitchButtonIdle: { backgroundColor: '#EEF4ED', borderWidth: 1, borderColor: '#D7E6D4' },
  featureSwitchButtonActive: { backgroundColor: colors.primary },
  featureSwitchButtonText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  featureSwitchButtonTextActive: { color: '#FFFFFF' },
  liveFeedbackTitle: { ...typography.headerSmall, color: colors.primary, marginBottom: 2 },
  liveFeedbackSubtitle: { ...typography.caption, color: colors.textLight },
  targetPoseCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.md, marginBottom: spacing.md, ...shadows.card,
  },
  targetPoseLabel: { ...typography.caption, color: colors.textMuted, fontWeight: '700' },
  targetPoseName: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginTop: 4 },
  targetPoseStatus: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  targetPoseStatusMatch: { color: '#1B5E20', fontWeight: '700' },
  cameraCard: { backgroundColor: colors.card, borderRadius: borderRadius.lg, overflow: 'hidden', ...shadows.card },
  camera: { width: '100%', height: 300, backgroundColor: '#000' },
  liveOverlay: {
    position: 'absolute', top: spacing.sm, left: spacing.sm, right: spacing.sm,
    backgroundColor: 'rgba(10,10,10,0.62)', borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm,
  },
  liveOverlayTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  liveStatusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  liveOverlayTitle: { ...typography.caption, color: '#B4FFB0', fontWeight: '700' },
  liveOverlayPose: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700', marginTop: 2 },
  liveOverlaySanskrit: { ...typography.caption, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize: 11 },
  liveOverlayConf: { ...typography.caption, color: '#FFFFFF', marginTop: 2 },
  liveOverlayHint: { ...typography.caption, color: '#D6EDFF', marginTop: 2 },
  cameraActions: { flexDirection: 'row', padding: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  galleryRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  galleryButton: {
    backgroundColor: '#E9F5E8', borderWidth: 1, borderColor: '#CDE8C9',
    borderRadius: borderRadius.md, paddingVertical: spacing.sm, alignItems: 'center',
  },
  galleryButtonText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  liveControlsRow: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  liveToggleButton: {
    flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  liveToggleButtonStart: { backgroundColor: colors.primary },
  liveToggleButtonStop: { backgroundColor: '#D1242F' },
  liveToggleText: { ...typography.bodySmall, color: '#FFFFFF', fontWeight: '700' },
  voiceToggleButton: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },
  voiceToggleOn: { backgroundColor: '#00BFA5' },
  voiceToggleOff: { backgroundColor: '#B0BEC5' },
  voiceToggleText: { fontSize: 20 },
  liveStatusText: { ...typography.caption, color: colors.textMuted, marginTop: 4 },
  liveErrorText: { ...typography.caption, color: '#B71C1C', marginTop: 4 },
  primaryButton: {
    flex: 1, backgroundColor: colors.primary, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, justifyContent: 'center', alignItems: 'center',
  },
  secondaryButton: {
    borderWidth: 1, borderColor: colors.border, borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
    justifyContent: 'center', alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.7 },
  primaryButtonText: { ...typography.bodySmall, color: colors.card, fontWeight: '600' },
  secondaryButtonText: { ...typography.bodySmall, color: colors.text, fontWeight: '600' },
  resultCard: {
    backgroundColor: colors.card, borderRadius: borderRadius.lg,
    padding: spacing.md, marginTop: spacing.md, ...shadows.card,
  },
  resultHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  demoBadge: {
    backgroundColor: '#FFF3CD', borderWidth: 1, borderColor: '#FFE29A',
    borderRadius: borderRadius.sm ?? 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  demoBadgeText: { fontSize: 10, fontWeight: '800', color: '#946200', letterSpacing: 0.5 },
  demoNoticeText: { ...typography.caption, color: '#946200', marginBottom: spacing.xs },
  sectionTitle: { ...typography.headerSmall, color: colors.primary },
  resultPose: { ...typography.headerSmall, color: colors.text, fontWeight: '800' },
  resultSanskrit: { ...typography.caption, color: colors.textLight, fontStyle: 'italic', marginBottom: 4 },
  resultText: { ...typography.bodySmall, color: colors.textLight },
  lastUpdatedText: { ...typography.caption, color: colors.textMuted, marginTop: 2, marginBottom: spacing.sm },
  subSectionTitle: { ...typography.bodySmall, color: colors.text, fontWeight: '700', marginBottom: spacing.sm },
  correctionRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.xs },
  correctionBullet: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm, marginTop: 1,
  },
  correctionBulletText: { ...typography.caption, color: '#fff', fontWeight: '800', fontSize: 10 },
  correctionText: { ...typography.bodySmall, color: colors.textLight, flex: 1, lineHeight: 20 },
  voiceStatusRow: {
    marginTop: spacing.sm, padding: spacing.sm, backgroundColor: '#F1F8E9',
    borderRadius: borderRadius.md, borderLeftWidth: 3, borderLeftColor: '#00BFA5',
  },
  voiceStatusText: { ...typography.caption, color: colors.textLight, lineHeight: 16 },
  noteCard: {
    marginTop: spacing.md, padding: spacing.md, borderRadius: borderRadius.lg,
    backgroundColor: '#E9F5E8', borderWidth: 1, borderColor: '#CDE8C9',
  },
  noteTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  noteBody: { ...typography.caption, color: colors.textLight, marginBottom: spacing.xs },
  healthButton: {
    marginTop: spacing.sm, borderRadius: borderRadius.md, borderWidth: 1,
    borderColor: '#A8CFA3', backgroundColor: '#F4FBF3',
    paddingVertical: spacing.sm, alignItems: 'center',
  },
  healthButtonText: { ...typography.bodySmall, color: colors.primary, fontWeight: '700' },
  permissionTitle: { ...typography.headerSmall, color: colors.text, marginBottom: spacing.sm },
  helperText: { ...typography.bodySmall, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm },
});

export default PoseCorrectorScreen;
