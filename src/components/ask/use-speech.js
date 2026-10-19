"use client";

/**
 * Browser speech for Ask StoryBoard (ask-storyboard.md (g), decision 1) — `SpeechRecognition` to
 * listen, `speechSynthesis` to speak. No vendor, no dependency; the server only ever sees text.
 *
 * Mobile/browser realities this handles (each one is a silent failure if ignored):
 *  - Recognition needs a SECURE CONTEXT (HTTPS/localhost) and a user gesture — `listen()` must be
 *    called from a tap/click handler, never on mount.
 *  - iOS Safari exposes `webkitSpeechRecognition` (Siri & Dictation must be on); Firefox has none.
 *    Unsupported ⇒ `canListen` is false and the caller hides the mic (typing still works).
 *  - iOS keeps `speechSynthesis` muted until it is first used INSIDE a gesture, but the answer
 *    arrives seconds after the tap. `listen()` (and `prime()`) therefore speak an empty utterance
 *    during the gesture, which unlocks it for the reply.
 *  - Leaving the page / locking the phone cancels speech, so a reply never talks to an empty room;
 *    the answer stays on screen as text.
 *  - Privacy (P3): an on-device voice (`localService`) is preferred so answer text is not sent to
 *    a speech service; only when none exists is the best available English voice used.
 *
 * The ElevenLabs voice (as-built 15): when an answer says `voice: "elevenlabs"`, `speak` fetches
 * its MP3 from `/api/ask/speech` and plays it through one reused <audio> element; on ANY failure it
 * falls back to the browser voice above. iOS blocks media playback that doesn't start in a gesture,
 * so `prime()` also plays a tiny silent clip on that element during the tap, unlocking it for the
 * answer that arrives seconds later. (An <audio> element, not Web Audio: iOS's silent switch mutes
 * Web Audio but not media playback.)
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

function recognitionCtor() {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

const getCanListen = () => recognitionCtor() !== null;
const getCanSpeak = () => typeof window !== "undefined" && "speechSynthesis" in window;
const getServerFalse = () => false;

let silentClip = null;
/** A 0.1 s silent 8-bit WAV as a data URI — played inside a tap to unlock media playback (iOS). */
function silentWavUri() {
  if (silentClip) return silentClip;
  const samples = 800;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const ascii = (offset, text) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true); // sample rate
  view.setUint32(28, 8000, true); // byte rate
  view.setUint16(32, 1, true); // block align
  view.setUint16(34, 8, true); // bits per sample
  ascii(36, "data");
  view.setUint32(40, samples, true);
  for (let index = 0; index < samples; index += 1) view.setUint8(44 + index, 128); // 8-bit silence
  const bytes = new Uint8Array(view.buffer);
  silentClip = `data:audio/wav;base64,${btoa(String.fromCharCode(...bytes))}`;
  return silentClip;
}

/** English recognition language: the browser's own English variant, else US English. */
function recognitionLang() {
  const lang = typeof navigator !== "undefined" ? navigator.language : "";
  return lang?.toLowerCase().startsWith("en") ? lang : "en-US";
}

/** Prefer an on-device English voice in the user's own variant, then any on-device English one. */
function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  const english = voices.filter((voice) => voice.lang?.toLowerCase().startsWith("en"));
  const wanted = recognitionLang().toLowerCase();
  const local = english.filter((voice) => voice.localService);
  return (
    local.find((voice) => voice.lang.toLowerCase() === wanted && voice.default) ??
    local.find((voice) => voice.lang.toLowerCase() === wanted) ??
    local[0] ??
    english.find((voice) => voice.lang.toLowerCase() === wanted) ??
    english[0] ??
    null
  );
}

const ERROR_MESSAGES = {
  "not-allowed": "Microphone access is blocked — allow it in the browser's site settings, or type instead.",
  "service-not-allowed": "Speech recognition is turned off on this device — type your question instead.",
  "audio-capture": "No microphone was found.",
  network: "The browser's speech service couldn't be reached — type your question instead.",
  "no-speech": "I didn't catch that — tap the mic and try again.",
};

/**
 * @param {{ onFinal: (text: string) => void, muted?: boolean }} options
 */
export function useSpeech({ onFinal, muted = false }) {
  const canListen = useSyncExternalStore(noopSubscribe, getCanListen, getServerFalse);
  const canSpeak = useSyncExternalStore(noopSubscribe, getCanSpeak, getServerFalse);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interim, setInterim] = useState("");
  const [speechError, setSpeechError] = useState("");
  const recognitionRef = useRef(null);
  const primedRef = useRef(false);
  const audioRef = useRef(null); // the one reused <audio> element for ElevenLabs answers
  const audioUrlRef = useRef(null);
  const fetchRef = useRef(null); // AbortController of the in-flight /api/ask/speech request
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const getAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new Audio();
    return audioRef.current;
  }, []);

  /** Stop and release any ElevenLabs audio — playing or still downloading. */
  const stopAudio = useCallback(() => {
    fetchRef.current?.abort();
    fetchRef.current = null;
    audioRef.current?.pause();
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    stopAudio();
    if (getCanSpeak()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [stopAudio]);

  /** Unlock synthesis and media playback for later replies — must run inside a user gesture (iOS). */
  const prime = useCallback(() => {
    if (primedRef.current) return;
    primedRef.current = true;
    if (getCanSpeak()) {
      const unlock = new SpeechSynthesisUtterance("");
      unlock.volume = 0;
      window.speechSynthesis.speak(unlock);
    }
    if (typeof Audio !== "undefined") {
      const audio = getAudio();
      audio.src = silentWavUri();
      audio.play().catch(() => {});
    }
  }, [getAudio]);

  const speakWithBrowser = useCallback(
    (text) => {
      if (!getCanSpeak()) {
        setSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = pickVoice();
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 1.03;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [],
  );

  /** Speak an answer — in the ElevenLabs voice when the server has one, else the browser's. */
  const speak = useCallback(
    (text, { voice = "browser" } = {}) => {
      if (muted || !text) return;
      stopSpeaking();
      if (voice !== "elevenlabs" || typeof Audio === "undefined") {
        speakWithBrowser(text);
        return;
      }
      const controller = new AbortController();
      fetchRef.current = controller;
      setSpeaking(true);
      fetch("/api/ask/speech", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
        signal: controller.signal,
      })
        .then((response) => {
          if (!response.ok) throw new Error(`speech ${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          if (controller.signal.aborted) return undefined;
          const url = URL.createObjectURL(blob);
          audioUrlRef.current = url;
          const audio = getAudio();
          audio.onended = () => {
            setSpeaking(false);
            stopAudio();
          };
          audio.src = url;
          return audio.play();
        })
        .catch(() => {
          // Aborted = stopped on purpose. Anything else (no voice configured, ElevenLabs down,
          // playback blocked) still gets the answer spoken, in the browser's voice.
          if (!controller.signal.aborted) speakWithBrowser(text);
        });
    },
    [muted, stopSpeaking, speakWithBrowser, getAudio, stopAudio],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  /** Start one push-to-talk capture. Call from a click/tap handler. */
  const listen = useCallback(() => {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    prime();
    stopSpeaking(); // barge-in: talking over the answer stops it
    recognitionRef.current?.abort();
    setSpeechError("");
    setInterim("");

    const recognition = new Ctor();
    recognition.lang = recognitionLang();
    recognition.interimResults = true;
    recognition.continuous = false; // ends on silence; the final transcript is submitted
    recognition.maxAlternatives = 1;
    let finalText = "";

    recognition.onresult = (event) => {
      let heard = "";
      for (let index = 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        heard += result[0].transcript;
        if (result.isFinal) finalText = heard;
      }
      setInterim(heard);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") {
        setSpeechError(ERROR_MESSAGES[event.error] ?? "Voice input stopped unexpectedly — try again or type.");
      }
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setListening(false);
      setInterim("");
      const text = finalText.trim();
      if (text) onFinalRef.current?.(text);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
      setListening(true);
    } catch {
      recognitionRef.current = null;
      setSpeechError("Voice input couldn't start — try again or type.");
    }
  }, [prime, stopSpeaking]);

  // Muting mid-sentence stops the sentence.
  useEffect(() => {
    if (!muted) return;
    stopAudio();
    if (getCanSpeak()) window.speechSynthesis.cancel();
  }, [muted, stopAudio]);

  // Leaving the page (tab switch, phone lock) cancels speech and capture; unmount does too.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState !== "hidden") return;
      recognitionRef.current?.abort();
      stopAudio();
      if (getCanSpeak()) window.speechSynthesis.cancel();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      recognitionRef.current?.abort();
      stopAudio();
      if (getCanSpeak()) window.speechSynthesis.cancel();
    };
  }, [stopAudio]);

  return {
    canListen,
    canSpeak,
    listening,
    speaking,
    interim,
    speechError,
    listen,
    stopListening,
    speak,
    stopSpeaking,
    prime,
  };
}
