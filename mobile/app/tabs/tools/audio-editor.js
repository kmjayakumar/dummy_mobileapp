/**
 * audio-editor.js
 *
 * Segment-based editor for a single converted file (WAV or MP3), reached via
 * the "Edit" button on Converted Files.
 *
 * Model: the file starts as ONE segment. Tapping "Split" cuts the selected
 * segment into two at a chosen point. Each segment can then be muted
 * (silenced but kept in place) or deleted (removed, closing the gap).
 * Trimming the start/end is just splitting near that edge and deleting the
 * small leftover piece — no separate trim tool needed.
 *
 * "Save" sends only the kept segments (with their mute flags) to the server,
 * which renders them into ONE new file, downloaded locally with an
 * "edited_" filename prefix and added to conversion history.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import Slider from '@react-native-community/slider';
import Button from '../../../components/Button';
import Card from '../../../components/Card';
import ErrorMessage from '../../../components/ErrorMessage';
import PlaybackBar from '../../../components/PlaybackBar';
import Colors from '../../../constants/colors';
import { useAudioPlayer } from '../../../hooks/useAudioPlayer';
import { editAudioSegments } from '../../../services/audioConverterService';
import { saveConversion } from '../../../services/conversionHistoryService';

const MIN_SEGMENT_SEC = 0.5;

let segCounter = 0;
function makeSegId() {
  segCounter += 1;
  return `seg-${Date.now()}-${segCounter}`;
}

function formatTime(sec) {
  if (!sec || sec < 0 || !isFinite(sec)) return '0:00';
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function AudioEditorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const fileUri  = params.fileUri;
  const fileName = params.fileName || 'audio';
  const format   = (params.format || '').toLowerCase() === 'mp3' ? 'mp3' : 'wav';

  const player = useAudioPlayer();

  const [duration, setDuration]     = useState(0);
  const [probing, setProbing]       = useState(true);
  const [probeError, setProbeError] = useState('');

  const [segments, setSegments]     = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [splitAt, setSplitAt]       = useState(0);

  const [saving, setSaving]         = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);
  const [saveError, setSaveError]   = useState('');

  // ── probe duration on mount ─────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!fileUri) {
        setProbeError('No file was passed to the editor.');
        setProbing(false);
        return;
      }
      let sound = null;
      try {
        const result = await Audio.Sound.createAsync({ uri: fileUri }, { shouldPlay: false });
        sound = result.sound;
        const dur = (result.status?.durationMillis || 0) / 1000;
        if (!mounted) return;
        if (!dur) {
          setProbeError('Could not read the audio duration.');
        } else {
          setDuration(dur);
          const initial = { id: makeSegId(), start: 0, end: dur, muted: false, deleted: false };
          setSegments([initial]);
          setSelectedId(initial.id);
          setSplitAt(dur / 2);
        }
      } catch (err) {
        if (mounted) setProbeError(err?.message || 'Could not open this audio file.');
      } finally {
        if (sound) {
          try { await sound.unloadAsync(); } catch { /* ignore */ }
        }
        if (mounted) setProbing(false);
      }
    })();
    return () => { mounted = false; };
  }, [fileUri]);

  // ── derived state ────────────────────────────────────────────────────────────

  const orderedSegments = useMemo(
    () => [...segments].sort((a, b) => a.start - b.start),
    [segments]
  );

  const selectedSegment = useMemo(
    () => segments.find((s) => s.id === selectedId) || null,
    [segments, selectedId]
  );

  const canSplit = !!selectedSegment
    && !selectedSegment.deleted
    && (selectedSegment.end - selectedSegment.start) > MIN_SEGMENT_SEC * 2;

  const keptSegments = useMemo(
    () => orderedSegments.filter((s) => !s.deleted),
    [orderedSegments]
  );

  const keptDuration = useMemo(
    () => keptSegments.reduce((sum, s) => sum + (s.end - s.start), 0),
    [keptSegments]
  );

  // Keep the split slider's value sensible whenever the selected segment changes.
  useEffect(() => {
    if (!selectedSegment) return;
    const mid = (selectedSegment.start + selectedSegment.end) / 2;
    setSplitAt(mid);
  }, [selectedSegment?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── actions ──────────────────────────────────────────────────────────────────

  const selectSegment = useCallback((seg) => {
    if (seg.deleted) return;
    setSelectedId(seg.id);
  }, []);

  const handleSplit = useCallback(() => {
    if (!selectedSegment || !canSplit) return;
    const point = Math.min(
      Math.max(splitAt, selectedSegment.start + MIN_SEGMENT_SEC),
      selectedSegment.end - MIN_SEGMENT_SEC
    );
    const left  = { id: makeSegId(), start: selectedSegment.start, end: point, muted: selectedSegment.muted, deleted: false };
    const right = { id: makeSegId(), start: point, end: selectedSegment.end, muted: selectedSegment.muted, deleted: false };

    setSegments((prev) => prev.flatMap((s) => (s.id === selectedSegment.id ? [left, right] : [s])));
    setSelectedId(left.id);
  }, [selectedSegment, canSplit, splitAt]);

  const toggleMute = useCallback((id) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, muted: !s.muted } : s)));
  }, []);

  const toggleDelete = useCallback((id) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, deleted: !s.deleted } : s)));
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  const handleReset = useCallback(() => {
    if (!duration) return;
    Alert.alert('Start over?', 'This discards every split, mute, and delete you made.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          const initial = { id: makeSegId(), start: 0, end: duration, muted: false, deleted: false };
          setSegments([initial]);
          setSelectedId(initial.id);
        },
      },
    ]);
  }, [duration]);

  const handleSave = useCallback(async () => {
    if (keptSegments.length === 0) {
      setSaveError('Keep at least one part before saving — everything is currently deleted.');
      return;
    }

    setSaving(true);
    setSaveError('');
    setSaveProgress(0);

    try {
      await player.stop(fileUri);

      const payloadSegments = keptSegments.map((s) => ({
        start: s.start,
        end: s.end,
        muted: s.muted,
      }));

      const result = await editAudioSegments(fileUri, fileName, format, payloadSegments, setSaveProgress);
      await saveConversion({ fileName: result.fileName, fileUri: result.uri, format, size: result.size });

      Alert.alert('Saved', `Saved as a new file: ${result.fileName}`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setSaveError(err?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  }, [keptSegments, player, fileUri, fileName, format, router]);

  // ── render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* File info */}
        <Card style={styles.section}>
          <View style={styles.fileHeader}>
            <Ionicons name="musical-notes" size={20} color={Colors.primary} />
            <Text style={styles.fileName} numberOfLines={1}>{fileName}</Text>
          </View>
          <Text style={styles.sectionHint}>
            {format.toUpperCase()} · {probing ? 'reading duration…' : formatTime(duration)} total
          </Text>
        </Card>

        {probing ? (
          <Card style={styles.section}>
            <View style={styles.centeredRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.sectionHint}>Reading audio…</Text>
            </View>
          </Card>
        ) : probeError ? (
          <Card style={styles.section}>
            <ErrorMessage message={probeError} />
          </Card>
        ) : (
          <>
            {/* Preview */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Preview original</Text>
              <PlaybackBar player={player} uri={fileUri} color={Colors.primary} />
            </Card>

            {/* Split control */}
            <Card style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>Split</Text>
                <TouchableOpacity onPress={handleReset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.resetLink}>Reset all</Text>
                </TouchableOpacity>
              </View>

              {selectedSegment ? (
                <>
                  <Text style={styles.sectionHint}>
                    Selected part: {formatTime(selectedSegment.start)} – {formatTime(selectedSegment.end)}
                  </Text>
                  <View style={styles.sliderRow}>
                    <Text style={styles.timeLabel}>{formatTime(selectedSegment.start)}</Text>
                    <Slider
                      style={styles.slider}
                      minimumValue={selectedSegment.start + MIN_SEGMENT_SEC}
                      maximumValue={Math.max(selectedSegment.end - MIN_SEGMENT_SEC, selectedSegment.start + MIN_SEGMENT_SEC)}
                      value={splitAt}
                      minimumTrackTintColor={Colors.primary}
                      maximumTrackTintColor={Colors.border}
                      thumbTintColor={Colors.primary}
                      disabled={!canSplit}
                      onValueChange={setSplitAt}
                    />
                    <Text style={styles.timeLabel}>{formatTime(selectedSegment.end)}</Text>
                  </View>
                  <Text style={styles.splitPreview}>Split at {formatTime(splitAt)}</Text>
                  <Button
                    title="Split here"
                    onPress={handleSplit}
                    disabled={!canSplit}
                    size="sm"
                  />
                  {!canSplit && selectedSegment ? (
                    <Text style={styles.tinyHint}>This part is too short to split further.</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.sectionHint}>Tap a part below to select it for splitting.</Text>
              )}

              <Text style={styles.tinyHint}>
                Tip: to trim the start or end, split near that edge, then delete the small piece.
              </Text>
            </Card>

            {/* Segments list */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Parts ({orderedSegments.length})</Text>
              {orderedSegments.map((seg, idx) => {
                const isSelected = seg.id === selectedId;
                return (
                  <TouchableOpacity
                    key={seg.id}
                    style={[
                      styles.segmentRow,
                      isSelected && styles.segmentRowSelected,
                      seg.deleted && styles.segmentRowDeleted,
                    ]}
                    onPress={() => selectSegment(seg)}
                    activeOpacity={seg.deleted ? 1 : 0.7}
                  >
                    <View style={styles.segmentInfo}>
                      <Text style={styles.segmentTitle}>
                        Part {idx + 1} · {formatTime(seg.start)} – {formatTime(seg.end)}
                      </Text>
                      <View style={styles.badgeRow}>
                        {seg.deleted ? (
                          <View style={[styles.badge, styles.badgeDeleted]}>
                            <Text style={styles.badgeTextDeleted}>Deleted</Text>
                          </View>
                        ) : seg.muted ? (
                          <View style={[styles.badge, styles.badgeMuted]}>
                            <Text style={styles.badgeTextMuted}>Muted</Text>
                          </View>
                        ) : (
                          <View style={[styles.badge, styles.badgeKept]}>
                            <Text style={styles.badgeTextKept}>Kept</Text>
                          </View>
                        )}
                        <Text style={styles.segmentDuration}>
                          {formatTime(seg.end - seg.start)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.segmentActions}>
                      <TouchableOpacity
                        onPress={() => toggleMute(seg.id)}
                        disabled={seg.deleted}
                        style={styles.segIconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={seg.muted ? 'volume-mute' : 'volume-high-outline'}
                          size={18}
                          color={seg.deleted ? Colors.textMuted : (seg.muted ? Colors.warning : Colors.textSecondary)}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleDelete(seg.id)}
                        style={styles.segIconBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons
                          name={seg.deleted ? 'arrow-undo-outline' : 'trash-outline'}
                          size={18}
                          color={seg.deleted ? Colors.primary : Colors.error}
                        />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Card>

            {/* Save */}
            <Card style={styles.section}>
              <Text style={styles.sectionTitle}>Save</Text>
              <Text style={styles.sectionHint}>
                Result will be {formatTime(keptDuration)} long, saved as a new "edited_" file.
              </Text>

              {saveError ? <ErrorMessage message={saveError} /> : null}

              {saving ? (
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${saveProgress}%` }]} />
                </View>
              ) : null}

              <Button
                title={saving ? `Saving… ${saveProgress}%` : 'Save as edited copy'}
                onPress={handleSave}
                loading={saving}
                disabled={saving || keptSegments.length === 0}
              />
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: 16, gap: 14, paddingBottom: 40 },

  section: { gap: 8 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  sectionHint: { fontSize: 12, color: Colors.textMuted, lineHeight: 17 },

  fileHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fileName: { flex: 1, fontSize: 15, fontWeight: '700', color: Colors.text },

  centeredRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resetLink: { fontSize: 12, fontWeight: '600', color: Colors.error },

  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  slider: { flex: 1, height: 32 },
  timeLabel: { fontSize: 11, color: Colors.textMuted, minWidth: 34, textAlign: 'center' },
  splitPreview: { fontSize: 13, fontWeight: '600', color: Colors.primary, textAlign: 'center' },
  tinyHint: { fontSize: 11, color: Colors.textMuted, lineHeight: 15, marginTop: 4 },

  segmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  segmentRowSelected: { borderColor: Colors.primary },
  segmentRowDeleted: { opacity: 0.5, borderStyle: 'dashed' },
  segmentInfo: { flex: 1, gap: 4 },
  segmentTitle: { fontSize: 13, fontWeight: '600', color: Colors.text },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  badgeKept: { backgroundColor: Colors.success + '20' },
  badgeTextKept: { fontSize: 10, fontWeight: '700', color: Colors.success },
  badgeMuted: { backgroundColor: Colors.warning + '20' },
  badgeTextMuted: { fontSize: 10, fontWeight: '700', color: Colors.warning },
  badgeDeleted: { backgroundColor: Colors.error + '20' },
  badgeTextDeleted: { fontSize: 10, fontWeight: '700', color: Colors.error },
  segmentDuration: { fontSize: 11, color: Colors.textMuted },
  segmentActions: { flexDirection: 'row', gap: 10, marginLeft: 8 },
  segIconBtn: { padding: 4 },

  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
});
