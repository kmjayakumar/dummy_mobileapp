/**
 * useShareIntent.js
 *
 * Listens for the "ShareIntentReceived" event emitted by MainActivity.kt
 * whenever the user shares an audio file into the app.
 *
 * Covers all three lifecycle cases:
 *   - Cold start   : MainActivity.onCreate  → emits after bridge is ready
 *   - Foreground   : MainActivity.onNewIntent → emits immediately
 *   - Background   : same as foreground (singleTask launch mode)
 *
 * The hook is mounted once at the root layout via ShareIntentHandler.
 * All state is stored in ShareIntentContext so any screen can read it.
 */

import { useEffect, useRef, useCallback } from 'react';
import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import { DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { useShareIntentContext } from '../context/ShareIntentContext';
import {
  validateSharedFile,
  copySharedFileToStaging,
  ensureAudioExtensionFromMime,
  extractFileName,
} from '../services/shareIntentService';

// Route to navigate to when a valid shared file arrives.
const CONVERTER_ROUTE = '/tabs/tools/audio-converter';

// Event name — must match the string emitted in MainActivity.kt
const SHARE_INTENT_EVENT = 'ShareIntentReceived';

export function useShareIntent() {
  const router = useRouter();
  const {
    status,
    error,
    hasFile,
    pendingFile,
    startReceiving,
    setSharedFile,
    setError,
    clear,
    isProcessing,
  } = useShareIntentContext();

  // Dedup guard — tracks the last URI we started processing
  const lastHandledUriRef = useRef(null);

  /**
   * Core handler — called every time a ShareIntentReceived event fires.
   * @param {{ uri: string, mimeType: string }} event
   */
  const handleShareEvent = useCallback(async (event) => {
    if (Platform.OS !== 'android') return;

    const rawUri  = event?.uri   || null;
    const rawMime = event?.mimeType || '';

    if (!rawUri) return;

    // Dedup: same URI already in flight or already processed
    if (lastHandledUriRef.current === rawUri) return;
    if (isProcessing()) return;

    lastHandledUriRef.current = rawUri;
    startReceiving();

    try {
      // Validate MIME type before doing any file I/O
      const validationError = validateSharedFile({ uri: rawUri, mimeType: rawMime });
      if (validationError) throw new Error(validationError);

      // Derive a safe filename from the URI + MIME
      const rawName    = extractFileName(rawUri);
      const nameWithExt = ensureAudioExtensionFromMime(rawName, rawMime);

      // Copy content:// → local file:// in staging
      const { localUri, size } = await copySharedFileToStaging(rawUri, nameWithExt);

      // Resolve the final MIME (may be empty from some apps)
      const mimeType = rawMime || guessMimeFromName(nameWithExt);

      const sharedFile = {
        uri:      localUri,
        name:     nameWithExt,
        mimeType: mimeType || 'application/octet-stream',
        size,
        source:   'share',
      };

      setSharedFile(sharedFile);

      // Navigate to the converter screen
      router.push(CONVERTER_ROUTE);

    } catch (err) {
      const message = err?.message || 'Could not import the shared file.';
      setError(message);
      Alert.alert(
        'Could not import file',
        message,
        [{ text: 'OK', onPress: () => { lastHandledUriRef.current = null; clear(); } }],
        { cancelable: true },
      );
    }
  }, [isProcessing, startReceiving, setSharedFile, setError, clear, router]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // DeviceEventEmitter is the correct emitter for events sent from
    // native Android code via RCTDeviceEventEmitter in Kotlin/Java.
    const subscription = DeviceEventEmitter.addListener(
      SHARE_INTENT_EVENT,
      handleShareEvent,
    );

    return () => {
      subscription.remove();
    };
  }, [handleShareEvent]);

  const dismiss = useCallback(() => {
    lastHandledUriRef.current = null;
    clear();
  }, [clear]);

  return { status, error, hasFile, pendingFile, dismiss };
}

// ─── local helper ─────────────────────────────────────────────────────────────

function guessMimeFromName(fileName) {
  const ext = (fileName || '').toLowerCase().split('.').pop();
  const map = {
    opus: 'audio/opus',
    ogg:  'audio/ogg',
    aac:  'audio/aac',
    mp3:  'audio/mpeg',
    mp4:  'audio/mp4',
    m4a:  'audio/mp4',
    wav:  'audio/wav',
  };
  return map[ext] || null;
}
