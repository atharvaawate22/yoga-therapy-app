"use client";

import { useCallback, useEffect, useRef } from "react";

/** Same voice settings as the APK (expo-speech: en-IN, rate 0.9). */
const PREFERRED_LANG = "en-IN";
const RATE = 0.9;

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | undefined {
  const voices = synth.getVoices();
  return (
    voices.find((v) => v.lang === PREFERRED_LANG) ??
    voices.find((v) => v.lang.startsWith("en-") && v.default) ??
    voices.find((v) => v.lang.startsWith("en"))
  );
}

/**
 * Web Speech API wrapper. `speak` interrupts whatever is playing; an empty
 * string just stops. A no-op where speech synthesis isn't available.
 *
 * iOS only lets a page speak after a user gesture, so callers should make
 * their first `speak` from a tap handler (see `unlock`).
 */
export function useSpeech(enabled: boolean) {
  const enabledRef = useRef(enabled);

  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;

  const stop = useCallback(() => synth?.cancel(), [synth]);

  const speak = useCallback(
    (text: string) => {
      if (!synth) return;
      synth.cancel();
      if (!text || !enabledRef.current) return;
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(synth);
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang ?? PREFERRED_LANG;
      utterance.rate = RATE;
      synth.speak(utterance);
    },
    [synth],
  );

  /** Call from a tap: primes speech on iOS with a silent utterance. */
  const unlock = useCallback(() => {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance("");
    utterance.volume = 0;
    synth.speak(utterance);
  }, [synth]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) synth?.cancel();
  }, [enabled, synth]);

  useEffect(() => () => synth?.cancel(), [synth]);

  return { speak, stop, unlock, supported: Boolean(synth) };
}
