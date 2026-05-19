import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import Button from '../../components/Button';
import Card from '../../components/Card';
import ErrorMessage from '../../components/ErrorMessage';
import Colors from '../../constants/colors';
import {
  convertOpusToWav,
  convertWavToMp3,
} from '../../services/audioConverterService';

const STAGE = {
  IDLE: 'idle',
  WAV: 'wav',
  MP3: 'mp3',
};

export default function ConverterScreen() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [wavPath, setWavPath] = useState(null);
  const [wavFfmpegPath, setWavFfmpegPath] = useState(null);
  const [outputBaseName, setOutputBaseName] = useState(null);
  const [mp3Path, setMp3Path] = useState(null);
  const [activeStage, setActiveStage] = useState(STAGE.IDLE);
  const [progress, setProgress] = useState(0);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState('');

  const isBusy = activeStage !== STAGE.IDLE;
  const hasFile = Boolean(selectedFile?.uri);

  const resetOutputs = useCallback(() => {
    setWavPath(null);
    setWavFfmpegPath(null);
    setOutputBaseName(null);
    setMp3Path(null);
    setSuccessMessage('');
  }, []);

  const pickOpusFile = async () => {
    setError('');
    setSuccessMessage('');

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'application/octet-stream'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setError('Could not read the selected file.');
        return;
      }

      const name = asset.name || asset.uri.split('/').pop() || 'unknown';
      const isOpus =
        name.toLowerCase().endsWith('.opus') ||
        asset.mimeType === 'audio/opus' ||
        asset.mimeType === 'audio/ogg';

      if (!isOpus) {
        setError('Please select a .opus file.');
        return;
      }

      setSelectedFile({
        uri: asset.uri,
        name,
        size: asset.size,
        mimeType: asset.mimeType,
      });
      resetOutputs();
    } catch (err) {
      setError(err.message || 'Failed to pick file.');
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    resetOutputs();
    setError('');
    setProgress(0);
    setActiveStage(STAGE.IDLE);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const convertToWav = async () => {
    if (!hasFile || isBusy) return;

    setError('');
    setSuccessMessage('');
    setActiveStage(STAGE.WAV);
    setProgress(0);

    try {
      const result = await convertOpusToWav(
        selectedFile.uri,
        selectedFile.name,
        setProgress,
      );
      setWavPath(result.displayPath);
      setWavFfmpegPath(result.path);
      setOutputBaseName(result.baseName);
      setMp3Path(null);
      setSuccessMessage('WAV saved locally. Ready for KineMaster.');
    } catch (err) {
      const msg = err.message || 'WAV conversion failed.';
      if (msg.includes('native module') || msg.includes('FFmpegKit')) {
        setError(
          'FFmpeg native module not found. Build a dev client: npx expo run:android (Expo Go will not work).',
        );
      } else {
        setError(msg);
      }
    } finally {
      setActiveStage(STAGE.IDLE);
      setProgress(0);
    }
  };

  const convertToMp3 = async () => {
    if (!wavFfmpegPath || isBusy) {
      if (!wavFfmpegPath) setError('Convert to WAV first.');
      return;
    }

    setError('');
    setSuccessMessage('');
    setActiveStage(STAGE.MP3);
    setProgress(0);

    try {
      const result = await convertWavToMp3(wavFfmpegPath, outputBaseName, setProgress);
      setMp3Path(result.displayPath);
      setSuccessMessage('MP3 saved locally at 192 kbps. Ready to share.');
    } catch (err) {
      const msg = err.message || 'MP3 conversion failed.';
      if (msg.includes('native module') || msg.includes('FFmpegKit')) {
        setError(
          'FFmpeg native module not found. Build a dev client: npx expo run:android (Expo Go will not work).',
        );
      } else {
        setError(msg);
      }
    } finally {
      setActiveStage(STAGE.IDLE);
      setProgress(0);
    }
  };

  const convertingLabel =
    activeStage === STAGE.WAV
      ? 'Converting Opus → WAV…'
      : activeStage === STAGE.MP3
        ? 'Converting WAV → MP3…'
        : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Ionicons name="musical-notes" size={26} color={Colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.pageTitle}>Audio Converter</Text>
            <Text style={styles.subtitle}>Opus → WAV → MP3 · offline on device</Text>
          </View>
        </View>

        <View style={styles.stepBanner}>
          <Ionicons name="hardware-chip-outline" size={18} color={Colors.info} />
          <Text style={styles.stepBannerText}>
            FFmpeg runs on-device (libopus @ 48 kHz, MP3 192k). Use a dev build — not Expo Go.
          </Text>
        </View>

        <ErrorMessage message={error} />

        {successMessage ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Source file</Text>
          <Text style={styles.sectionHint}>Select a .opus file from your device</Text>

          {selectedFile ? (
            <View style={styles.fileCard}>
              <View style={styles.fileIconWrap}>
                <Ionicons name="document-text" size={22} color={Colors.primary} />
              </View>
              <View style={styles.fileMeta}>
                <Text style={styles.fileName} numberOfLines={2}>
                  {selectedFile.name}
                </Text>
                <Text style={styles.fileSize}>{formatFileSize(selectedFile.size)}</Text>
              </View>
              <TouchableOpacity
                onPress={clearSelection}
                style={styles.clearBtn}
                disabled={isBusy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.pickArea}
              onPress={pickOpusFile}
              activeOpacity={0.8}
              disabled={isBusy}
            >
              <Ionicons name="folder-open-outline" size={32} color={Colors.primary} />
              <Text style={styles.pickTitle}>Tap to pick .opus file</Text>
              <Text style={styles.pickHint}>Works fully offline on your phone</Text>
            </TouchableOpacity>
          )}

          {selectedFile ? (
            <Button
              title="Choose different file"
              onPress={pickOpusFile}
              variant="outline"
              size="sm"
              disabled={isBusy}
              style={styles.secondaryPickBtn}
            />
          ) : null}
        </Card>

        {isBusy ? (
          <Card style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.progressLabel}>{convertingLabel}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </Card>
        ) : null}

        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Convert</Text>
          <Text style={styles.sectionHint}>
            WAV for KineMaster · MP3 at 192 kbps for sharing
          </Text>

          <View style={styles.actions}>
            <Button
              title="Convert to WAV"
              onPress={convertToWav}
              loading={activeStage === STAGE.WAV}
              disabled={!hasFile || isBusy}
              style={styles.actionBtn}
            />
            <Button
              title="Convert to MP3"
              onPress={convertToMp3}
              variant="secondary"
              loading={activeStage === STAGE.MP3}
              disabled={!wavFfmpegPath || isBusy}
              style={styles.actionBtn}
            />
          </View>
        </Card>

        {(wavPath || mp3Path) ? (
          <Card style={styles.section} elevated>
            <Text style={styles.sectionTitle}>Saved files</Text>
            <Text style={styles.sectionHint}>Stored in app documents/converted/</Text>

            {wavPath ? (
              <OutputRow
                icon="waveform"
                label="WAV (KineMaster)"
                path={wavPath}
                color={Colors.info}
              />
            ) : null}
            {mp3Path ? (
              <OutputRow
                icon="share-social-outline"
                label="MP3 (share)"
                path={mp3Path}
                color={Colors.success}
                last
              />
            ) : null}
          </Card>
        ) : null}

        <Card style={styles.pipelineCard}>
          <Text style={styles.pipelineTitle}>Pipeline</Text>
          <PipelineStep step="1" label="Opus → WAV" detail="libopus + aresample=async=1 @ 48 kHz" done={Boolean(wavPath)} />
          <PipelineStep step="2" label="WAV → MP3" detail="192 kbps" done={Boolean(mp3Path)} last />
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function OutputRow({ icon, label, path, color, last }) {
  return (
    <View style={[styles.outputRow, !last && styles.outputRowBorder]}>
      <View style={styles.outputHeader}>
        <Ionicons name={icon} size={16} color={color} />
        <Text style={styles.outputLabel}>{label}</Text>
      </View>
      <Text style={styles.outputPath} selectable>
        {path}
      </Text>
    </View>
  );
}

function PipelineStep({ step, label, detail, done, last }) {
  return (
    <View style={[styles.pipelineStep, !last && styles.pipelineStepBorder]}>
      <View style={[styles.pipelineBadge, done && styles.pipelineBadgeDone]}>
        <Text style={styles.pipelineBadgeText}>{step}</Text>
      </View>
      <View style={styles.pipelineContent}>
        <Text style={styles.pipelineLabel}>{label}</Text>
        <Text style={styles.pipelineDetail}>{detail}</Text>
      </View>
      {done ? (
        <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
      ) : (
        <Ionicons name="ellipse-outline" size={20} color={Colors.textMuted} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  headerIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  pageTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  stepBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.info + '18',
    borderWidth: 1,
    borderColor: Colors.info + '40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  stepBannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.info,
    lineHeight: 19,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: Colors.success + '18',
    borderWidth: 1,
    borderColor: Colors.success + '40',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    flex: 1,
    fontSize: 13,
    color: Colors.success,
    lineHeight: 19,
  },
  section: {
    marginBottom: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  sectionHint: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  pickArea: {
    borderWidth: 1.5,
    borderColor: Colors.primary + '55',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary + '0D',
  },
  pickTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
  },
  pickHint: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surfaceElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: Colors.primary + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileMeta: { flex: 1 },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  fileSize: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
  },
  clearBtn: {
    padding: 4,
  },
  secondaryPickBtn: {
    marginTop: 4,
  },
  progressCard: {
    marginBottom: 16,
    gap: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressPercent: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  actions: {
    gap: 12,
    marginTop: 4,
  },
  actionBtn: {
    width: '100%',
  },
  outputRow: {
    paddingVertical: 12,
    gap: 6,
  },
  outputRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  outputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  outputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  outputPath: {
    fontSize: 12,
    color: Colors.text,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  pipelineCard: {
    marginTop: 4,
    gap: 0,
  },
  pipelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  pipelineStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  pipelineStepBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pipelineBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineBadgeDone: {
    backgroundColor: Colors.success + '33',
  },
  pipelineBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
  },
  pipelineContent: { flex: 1 },
  pipelineLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  pipelineDetail: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
