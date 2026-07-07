/**
 * useAudioPlayer.js
 *
 * Shared in-app playback for converted audio files (WAV / MP3).
 *
 * Only ONE sound can play at a time across the whole app. This is done with
 * a module-level singleton (activeSound / activeUri) rather than per-component
 * state, so that pressing play on a row in one screen (e.g. audio-converter)
 * correctly stops a file that was left playing on another screen
 * (e.g. converted-files) — and every component using this hook stays in sync
 * via the `listeners` broadcast.
 *
 * Usage:
 *   const player = useAudioPlayer();
 *   <Icon name={player.playingUri === uri && player.isPlaying ? 'pause' : 'play'}
 *         onPress={() => player.play(uri)} />
 *
 * Calling play(uri) again on the currently-loaded uri toggles pause/resume.
 * Calling play(uri) with a different uri stops/unloads the previous sound
 * first, then loads and plays the new one.
 */

import { useCallback, useEffect, useState } from 'react';
import { Audio } from 'expo-av';

let activeSound = null;
let activeUri = null;
const listeners = new Set();

function broadcast(update) {
  listeners.forEach((cb) => cb(update));
}

async function unloadActive() {
  const sound = activeSound;
  const uri = activeUri;
  activeSound = null;
  activeUri = null;
  if (sound) {
    try {
      await sound.stopAsync();
    } catch {
      // ignore — sound may already be stopped/unloaded
    }
    try {
      await sound.unloadAsync();
    } catch {
      // ignore
    }
  }
  if (uri) {
    broadcast({ uri, isPlaying: false, isLoading: false, positionMillis: 0, durationMillis: 0 });
  }
}

export function useAudioPlayer() {
  const [state, setState] = useState({
    uri: null,
    isPlaying: false,
    isLoading: false,
    positionMillis: 0,
    durationMillis: 0,
  });

  useEffect(() => {
    const onUpdate = (update) => {
      setState((prev) => ({ ...prev, ...update }));
    };
    listeners.add(onUpdate);
    return () => listeners.delete(onUpdate);
  }, []);

  const play = useCallback(async (uri) => {
    if (!uri) return;

    // Toggle play/pause on the file that's already loaded.
    if (activeUri === uri && activeSound) {
      try {
        const status = await activeSound.getStatusAsync();
        if (!status.isLoaded) return;
        if (status.isPlaying) {
          await activeSound.pauseAsync();
          broadcast({ uri, isPlaying: false, isLoading: false });
        } else {
          await activeSound.playAsync();
          broadcast({ uri, isPlaying: true, isLoading: false });
        }
      } catch {
        // If the loaded sound got into a bad state, fall through and reload it.
        await unloadActive();
      }
      return;
    }

    // Switching files — stop and unload whatever was playing first.
    await unloadActive();
    broadcast({ uri, isPlaying: false, isLoading: true, positionMillis: 0, durationMillis: 0 });

    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          if (!status.isLoaded) return;
          broadcast({
            uri,
            isPlaying: status.isPlaying,
            isLoading: false,
            positionMillis: status.positionMillis || 0,
            durationMillis: status.durationMillis || 0,
          });
          if (status.didJustFinish) {
            unloadActive();
          }
        }
      );
      activeSound = sound;
      activeUri = uri;
    } catch (err) {
      broadcast({ uri, isPlaying: false, isLoading: false });
      throw err;
    }
  }, []);

  const stop = useCallback(async (uri) => {
    if (!uri || activeUri === uri) {
      await unloadActive();
    }
  }, []);

  return {
    playingUri: state.uri,
    isPlaying: state.isPlaying,
    isLoading: state.isLoading,
    positionMillis: state.positionMillis,
    durationMillis: state.durationMillis,
    play,
    stop,
  };
}
