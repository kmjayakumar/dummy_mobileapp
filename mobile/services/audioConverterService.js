import { NativeModules } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { FFmpegKit, ReturnCode } from 'ffmpeg-kit-react-native';

const OUTPUT_DIR = `${FileSystem.documentDirectory}converted/`;

export function isFfmpegAvailable() {
  return Boolean(NativeModules.FFmpegKitReactNativeModule);
}

function stripFileScheme(uri) {
  if (!uri) return uri;
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
}

function toDisplayPath(uri) {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function getBaseName(fileName) {
  return fileName.replace(/\.opus$/i, '');
}

async function ensureOutputDir() {
  const info = await FileSystem.getInfoAsync(OUTPUT_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(OUTPUT_DIR, { intermediates: true });
  }
}

async function stageInputFile(sourceUri, fileName) {
  await ensureOutputDir();
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const destUri = `${FileSystem.cacheDirectory}opus_input_${Date.now()}_${safeName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const destInfo = await FileSystem.getInfoAsync(destUri);
  if (!destInfo.exists) {
    throw new Error('Could not prepare input file for conversion.');
  }

  return {
    uri: destUri,
    path: stripFileScheme(destUri),
  };
}

async function runFfmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    let lastProgress = 0;

    FFmpegKit.executeWithArgumentsAsync(
      args,
      async (session) => {
        try {
          const returnCode = await session.getReturnCode();
          if (ReturnCode.isSuccess(returnCode)) {
            onProgress?.(100);
            resolve(session);
            return;
          }

          const logs = await session.getAllLogsAsString();
          reject(new Error(logs?.trim() || `FFmpeg failed (code ${returnCode?.getValue?.() ?? 'unknown'})`));
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (statistics) => {
        const time = statistics.getTime?.() ?? 0;
        if (time <= 0) return;

        const estimated = Math.min(95, Math.max(lastProgress + 1, Math.round(time / 1000) % 95));
        if (estimated > lastProgress) {
          lastProgress = estimated;
          onProgress?.(estimated);
        }
      }
    ).catch(reject);

    onProgress?.(5);
  });
}

/**
 * Opus → WAV (exact command semantics):
 * ffmpeg -c:a libopus -i input.opus -af aresample=async=1 -ar 48000 output.wav
 */
export async function convertOpusToWav(sourceUri, fileName, onProgress) {
  if (!isFfmpegAvailable()) {
    throw new Error(
      'FFmpeg native module not found. Build a development APK with: npx expo prebuild && npx expo run:android'
    );
  }

  const input = await stageInputFile(sourceUri, fileName);
  await ensureOutputDir();

  const baseName = getBaseName(fileName);
  const outputUri = `${OUTPUT_DIR}${baseName}.wav`;
  const outputPath = stripFileScheme(outputUri);

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  onProgress?.(0);

  await runFfmpeg(
    ['-c:a', 'libopus', '-i', input.path, '-af', 'aresample=async=1', '-ar', '48000', outputPath],
    onProgress
  );

  const outInfo = await FileSystem.getInfoAsync(outputUri);
  if (!outInfo.exists) {
    throw new Error('WAV file was not created.');
  }

  return {
    uri: outputUri,
    path: toDisplayPath(outputUri),
    fileName: `${baseName}.wav`,
    size: outInfo.size,
  };
}

/**
 * WAV → MP3 (exact command semantics):
 * ffmpeg -i output.wav -b:a 192k final.mp3
 */
export async function convertWavToMp3(wavUri, opusFileName, onProgress) {
  if (!isFfmpegAvailable()) {
    throw new Error(
      'FFmpeg native module not found. Build a development APK with: npx expo prebuild && npx expo run:android'
    );
  }

  await ensureOutputDir();

  const wavPath = stripFileScheme(wavUri);
  const baseName = getBaseName(opusFileName);
  const outputUri = `${OUTPUT_DIR}${baseName}.mp3`;
  const outputPath = stripFileScheme(outputUri);

  const wavInfo = await FileSystem.getInfoAsync(wavUri);
  if (!wavInfo.exists) {
    throw new Error('WAV file not found. Convert to WAV first.');
  }

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  onProgress?.(0);

  await runFfmpeg(['-i', wavPath, '-b:a', '192k', outputPath], onProgress);

  const outInfo = await FileSystem.getInfoAsync(outputUri);
  if (!outInfo.exists) {
    throw new Error('MP3 file was not created.');
  }

  return {
    uri: outputUri,
    path: toDisplayPath(outputUri),
    fileName: `${baseName}.mp3`,
    size: outInfo.size,
  };
}

export function getConverterOutputDir() {
  return OUTPUT_DIR;
}

export async function clearConverterOutputs() {
  const info = await FileSystem.getInfoAsync(OUTPUT_DIR);
  if (info.exists) {
    await FileSystem.deleteAsync(OUTPUT_DIR, { idempotent: true });
  }
}
