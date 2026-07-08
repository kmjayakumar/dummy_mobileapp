/**
 * PlaybackBar.js
 *
 * Reusable playback control: play/pause, -10s / +10s buttons, a draggable
 * scrub bar, and current/total time labels. Drives itself off the shared
 * `useAudioPlayer` hook so it can be dropped into any row that represents
 * a playable file (converter output rows, converted-files list rows, etc).
 *
 * Usage:
 *   const player = useAudioPlayer();
 *   <PlaybackBar player={player} uri={item.fileUri} color={Colors.primary} />
 */

import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';

const SKIP_MS = 10000;

function formatTime(ms) {
  if (!ms || ms < 0 || !isFinite(ms)) return '0:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function PlaybackBar({ player, uri, color = '#3B82F6', trackColor = '#E2E8F0', disabled = false }) {
  const isActive  = player.playingUri === uri;
  const isPlaying = isActive && player.isPlaying;
  const isLoading = isActive && player.isLoading;
  const duration  = isActive ? player.durationMillis : 0;

  // While the user is actively dragging, show the drag value instead of the
  // broadcasted position so the thumb doesn't jump/fight the finger.
  const [dragValue, setDragValue] = useState(null);
  const position = dragValue != null ? dragValue : (isActive ? player.positionMillis : 0);
  const sliderMax = duration > 0 ? duration : 1;

  const handlePlayPause = useCallback(() => {
    player.play(uri);
  }, [player, uri]);

  const handleRewind = useCallback(() => {
    player.seekBy(uri, -SKIP_MS);
  }, [player, uri]);

  const handleForward = useCallback(() => {
    player.seekBy(uri, SKIP_MS);
  }, [player, uri]);

  const handleSlidingComplete = useCallback((value) => {
    setDragValue(null);
    player.seek(uri, value);
  }, [player, uri]);

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          onPress={handleRewind}
          disabled={disabled}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-back" size={16} color={color} />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handlePlayPause}
          disabled={disabled || isLoading}
          style={styles.playBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isLoading
            ? <ActivityIndicator size="small" color={color} />
            : <Ionicons name={isPlaying ? 'pause' : 'play'} size={18} color={color} />}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleForward}
          disabled={disabled}
          style={styles.iconBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="play-forward" size={16} color={color} />
        </TouchableOpacity>

        <Text style={styles.time}>{formatTime(position)}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={sliderMax}
          value={Math.min(position, sliderMax)}
          minimumTrackTintColor={color}
          maximumTrackTintColor={trackColor}
          thumbTintColor={color}
          disabled={disabled}
          onValueChange={setDragValue}
          onSlidingComplete={handleSlidingComplete}
        />
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  playBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  slider: {
    flex: 1,
    height: 32,
    marginHorizontal: 4,
  },
  time: {
    fontSize: 11,
    color: '#64748B',
    minWidth: 34,
    textAlign: 'center',
  },
});
