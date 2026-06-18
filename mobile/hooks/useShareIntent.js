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
 * Navigation timing fix
 * ─────────────────────
 * On cold start the React navigation stack is not mounted when the native
 * event fires.  Calling router.push() before the navigator is ready silently
 * drops the navigation.  We solve this with two cooperating pieces:
 *
 *   1. The file is always staged and stored in ShareIntentContext first,
 *      regardless of navigator state.
 *
 *   2. Navigation is attempted via a retry loop that waits until the router
 *      reports it can accept pushes.  On foreground/background intents the
 *      navigator is already ready so the push fires on the first attempt.
 *      On cold start it retries every 100 ms for up to 3 seconds.
 */

import { useEffect, useRef, useCallback } from 'react';
import { DeviceEventEmitter, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useShareIntentContext } from '../context/ShareIntentContext';
import {
  validateSharedFile,
  copySharedFileToStaging,
  ensureAudioExtensionFromMime,
  extractFileName,
} from '../services/shareIntentService';

// ─── constants ────────────────────────────────────────────────────────────────

const CONVERTER_ROUTE   = '/tabs/tools/audio-converter';
const SHARE_INTENT_EVENT = 'ShareIntentReceived';

// Navigation retry config for cold-start timing
const NAV_RETRY_INTERVAL_MS = 100;   // check every 100 ms
const NAV_RETRY_MAX_ATTEMPTS = 30;   // give up after 3 seconds

// ─── hook ─────────────────────────────────────────────────────────────────────

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

  // Tracks a pending navigate-after-ready interval so we can cancel it on unmount
  const navRetryTimerRef = useRef(null);

  // ── navigation helper ──────────────────────────────────────────────────────
  /**
   * Push to the converter screen.
   *
   * On cold start expo-router's navigator may not be ready to accept pushes
   * yet — calling router.push() on an unmounted navigator is silently dropped.
   * We poll until router.canGoBack() is defined (navigator mounted) or fall
   * back to router.replace() if push keeps failing.
   *
   * router.navigate() is used instead of router.push() because:
   *   - If the user is already on the converter screen it replaces in-place
   *     rather than stacking a duplicate.
   *   - If they are elsewhere it pushes correctly.
   */
  const navigateToConverter = useCallback(() => {
    // Clear any existing retry timer
    if (navRetryTimerRef.current) {
      clearInterval(navRetryTimerRef.current);
      navRetryTimerRef.current = null;
    }

    let attempts = 0;

    navRetryTimerRef.current = setInterval(() => {
      attempts++;

      try {
        // expo-router exposes router.navigate() which works as push/replace
        // depending on whether the target is already on the stack.
        router.navigate(CONVERTER_ROUTE);
        // If we get here without throwing, navigation was accepted.
        clearInterval(navRetryTimerRef.current);
        navRetryTimerRef.current = null;
      } catch {
        // Navigator not ready yet — will retry
      }

      if (attempts >= NAV_RETRY_MAX_ATTEMPTS) {
        // Give up gracefully — the file is still in context so the converter
        // screen will pick it up if the user navigates there manually.
        clearInterval(navRetryTimerRef.current);
        navRetryTimerRef.current = null;
      }
    }, NAV_RETRY_INTERVAL_MS);
  }, [router]);

  // ── event handler ──────────────────────────────────────────────────────────
  const handleShareEvent = useCallback(async (event) => {
    if (Platform.OS !== 'android') return;

    const rawUri  = event?.uri      || null;
    const rawMime = event?.mimeType || '';

    if (!rawUri) return;

    // Dedup: same URI already in flight or already processed
    if (lastHandledUriRef.current === rawUri) return;
    if (isProcessing()) return;

    lastHandledUriRef.current = rawUri;
    startReceiving();

    try {
      // 1. Validate MIME before doing any file I/O
      const validationError = validateSharedFile({ uri: rawUri, mimeType: rawMime });
      if (validationError) throw new Error(validationError);

      // 2. Derive a safe filename
      const rawName     = extractFileName(rawUri);
      const nameWithExt = ensureAudioExtensionFromMime(rawName, rawMime);

      // 3. Copy content:// → local file:// in app-private staging dir
      const { localUri, size } = await copySharedFileToStaging(rawUri, nameWithExt);

      // 4. Resolve final MIME (some apps send an empty type)
      const mimeType = rawMime || guessMimeFromName(nameWithExt);

      const sharedFile = {
        uri:      localUri,
        name:     nameWithExt,
        mimeType: mimeType || 'application/octet-stream',
        size,
        source:   'share',
      };

      // 5. Store in context — converter screen will auto-import when it mounts
      setSharedFile(sharedFile);

      // 6. Navigate — retries until the navigator is ready (cold-start safe)
      navigateToConverter();

    } catch (err) {
      const message = err?.message || 'Could not import the shared file.';
      setError(message);
      Alert.alert(
        'Could not import file',
        message,
        [{
          text: 'OK',
          onPress: () => {
            lastHandledUriRef.current = null;
            clear();
          },
        }],
        { cancelable: true },
      );
    }
  }, [isProcessing, startReceiving, setSharedFile, setError, clear, navigateToConverter]);

  // ── listener registration ──────────────────────────────────────────────────
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = DeviceEventEmitter.addListener(
      SHARE_INTENT_EVENT,
      handleShareEvent,
    );

    return () => {
      subscription.remove();
      // Cancel any pending navigation retry on unmount
      if (navRetryTimerRef.current) {
        clearInterval(navRetryTimerRef.current);
        navRetryTimerRef.current = null;
      }
    };
  }, [handleShareEvent]);

  // ── public API ─────────────────────────────────────────────────────────────
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
