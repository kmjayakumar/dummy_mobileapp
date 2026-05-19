import * as FileSystem from 'expo-file-system';
import { FFmpegKit, FFprobeKit, FFmpegKitConfig, ReturnCode } from 'ffmpeg-kit-react-native';

export const CONVERTED_DIR = `${FileSystem.documentDirectory}converted/`;

function sanitizeBaseName(fileName) {
  const base = fileName.replace(/\.opus$/i, '');
  return base.replace(/[^a-zA-Z0-9._-]/g, '_') || 'audio';
}

/** FFmpeg expects filesystem paths without the file:// prefix. */
export function toFfmpegPath(uriOrPath) {
  if (!uriOrPath) return uriOrPath;
  if (uriOrPath.startsWith('file://')) {
    return decodeURI(uriOrPath.replace('file://', ''));
  }
  return uriOrPath;
}

function quotePath(path) {
  return `"${String(path).replace(/"/g, '\\"')}"`;
}

async function ensureDir(dirUri) {
  const info = await FileSystem.getInfoAsync(dirUri);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  }
}

export async function ensureOutputDirectory() {
  await ensureDir(CONVERTED_DIR);
}

/**
 * Copy picked file into app cache so FFmpeg can read it reliably (content:// URIs).
 */
export async function resolveInputPath(uri, fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const inputDir = `${FileSystem.cacheDirectory}inputs/`;
  await ensureDir(inputDir);
  const destUri = `${inputDir}${safeName}`;

  const existing = await FileSystem.getInfoAsync(destUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(destUri, { idempotent: true });
  }

  await FileSystem.copyAsync({ from: uri, to: destUri });
  return toFfmpegPath(destUri);
}

async function getDurationMs(filePath) {
  try {
    const session = await FFprobeKit.getMediaInformation(filePath);
    const info = session.getMediaInformation();
    const durationSec = parseFloat(info?.getDuration?.() ?? '0', 10);
    if (durationSec > 0) return Math.round(durationSec * 1000);
  } catch {
    // fall through
  }
  return 0;
}

function attachProgressCallback(durationMs, onProgress) {
  if (!onProgress) return;

  FFmpegKitConfig.enableStatisticsCallback((statistics) => {
    const time = statistics.getTime();
    if (durationMs > 0) {
      onProgress(Math.min(99, Math.round((time / durationMs) * 100)));
    } else if (time > 0 && typeof onProgress === 'function') {
      onProgress(Math.min(95, Math.round(time / 100) + 5));
    }
  });
}

function detachProgressCallback() {
  FFmpegKitConfig.disableStatisticsCallback();
}

async function runFfmpeg(command, onProgress, inputPathForDuration) {
  const durationMs = inputPathForDuration
    ? await getDurationMs(inputPathForDuration)
    : 0;

  if (onProgress) onProgress(0);
  attachProgressCallback(durationMs, onProgress);

  try {
    const session = await FFmpegKit.execute(command);
    const returnCode = await session.getReturnCode();

    if (!ReturnCode.isSuccess(returnCode)) {
      const logs = await session.getAllLogsAsString();
      throw new Error(logs?.trim() || 'FFmpeg conversion failed.');
    }

    if (onProgress) onProgress(100);
    return session;
  } finally {
    detachProgressCallback();
  }
}

/**
 * Opus → WAV (exact command — libopus decoder, no crackle):
 * ffmpeg -c:a libopus -i "input.opus" -af aresample=async=1 -ar 48000 output.wav
 */
export async function convertOpusToWav(inputUri, fileName, onProgress) {
  await ensureOutputDirectory();

  const baseName = sanitizeBaseName(fileName);
  const inputPath = await resolveInputPath(inputUri, fileName);
  const outputUri = `${CONVERTED_DIR}${baseName}.wav`;
  const outputPath = toFfmpegPath(outputUri);

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  const command = [
    '-c:a', 'libopus',
    '-i', quotePath(inputPath),
    '-af', 'aresample=async=1',
    '-ar', '48000',
    quotePath(outputPath),
  ].join(' ');

  await runFfmpeg(command, onProgress, inputPath);

  const outInfo = await FileSystem.getInfoAsync(outputUri);
  if (!outInfo.exists) {
    throw new Error('WAV file was not created.');
  }

  return {
    uri: outputUri,
    path: outputPath,
    displayPath: outputUri,
    baseName,
  };
}

/**
 * WAV → MP3 (exact command — 192 kbps):
 * ffmpeg -i "output.wav" -b:a 192k final.mp3
 */
export async function convertWavToMp3(wavFfmpegPath, baseName, onProgress) {
  await ensureOutputDirectory();

  const outputUri = `${CONVERTED_DIR}${baseName}.mp3`;
  const outputPath = toFfmpegPath(outputUri);

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  const command = [
    '-i', quotePath(wavFfmpegPath),
    '-b:a', '192k',
    quotePath(outputPath),
  ].join(' ');

  await runFfmpeg(command, onProgress, wavFfmpegPath);

  const outInfo = await FileSystem.getInfoAsync(outputUri);
  if (!outInfo.exists) {
    throw new Error('MP3 file was not created.');
  }

  return {
    uri: outputUri,
    path: outputPath,
    displayPath: outputUri,
  };
}
