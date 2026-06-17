/**
 * useShareIntent.js
 *
 * Orchestrates the full Android Share Intent flow:
 *
 *   1. Reads expo-router search params on every render (covers cold-start,
 *      already-running, and background-wake scenarios).
 *   2. Detects a new share intent by comparing the raw URI.
 *   3. Calls shareIntentService.receiveSharedFile() to validate + stage the file.
 *   4. Writes the result into ShareIntentContext.
 *   5. Navigates to the converter screen once the file is ready.
 *
 * Usage (in the root layout or a top-level screen):
 *
 *   const { status, error, dismiss } = useShareIntent();
 */

import { useEffect, useRef, useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert } from 'react-native';
import { receiveSharedFile, parseIntentParams } from '../services/shareIntentService';
import { useShareIntentContext } from '../context/ShareIntentContext';

// Route to navigate to when a valid shared file arrives.
const CONVERTER_ROUTE = '/tabs/tools/audio-converter';

export function useShareIntent() {
  const params = useLocalSearchParams();
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

  // Track the last URI we processed so we don't handle the same intent twice
  // (expo-router keeps params in the URL while the screen is mounted).
  const lastHandledUriRef = useRef(null);

  const handleIncomingIntent = useCallback(async () => {
    // Parse params early to check if there's anything to handle
    const parsed = parseIntentParams(params);
    if (!parsed?.uri) return;

    const uri = parsed.uri;

    // Duplicate guard — same URI already handled
    if (lastHandledUriRef.current === uri) return;

    // Another share is already in flight
    if (isProcessing()) return;

    // Mark as handling
    lastHandledUriRef.current = uri;
    startReceiving();

    try {
      const sharedFile = await receiveSharedFile(params);
      setSharedFile(sharedFile);

      // Navigate to converter. Use replace if already on the converter screen,
      // push otherwise so the user can navigate back.
      router.push(CONVERTER_ROUTE);
    } catch (err) {
      const message = err?.message || 'Could not import the shared file.';
      setError(message);

      Alert.alert(
        'Could not import file',
        message,
        [{ text: 'OK', onPress: clear }],
        { cancelable: true }
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    handleIncomingIntent();
  }, [handleIncomingIntent]);

  const dismiss = useCallback(() => {
    lastHandledUriRef.current = null;
    clear();
  }, [clear]);

  return {
    status,
    error,
    hasFile,
    pendingFile,
    dismiss,
  };
}
