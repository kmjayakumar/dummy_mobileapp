import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

const API_ROOT = (process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api').replace(
  /\/$/,
  ''
);

const OUTPUT_DIR = `${FileSystem.documentDirectory}converted/`;
const UPLOAD_CACHE_DIR = `${FileSystem.cacheDirectory}uploads/`;

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

/** Copy content:// URIs to cache so multipart upload is stable on Android. */
async function resolveUploadUri(sourceUri, fileName) {
  if (!sourceUri) {
    throw new Error('No file selected.');
  }

  if (sourceUri.startsWith('file://')) {
    const info = await FileSystem.getInfoAsync(sourceUri);
    if (!info.exists) {
      throw new Error('Selected file no longer exists. Pick it again.');
    }
    return sourceUri;
  }

  const cacheInfo = await FileSystem.getInfoAsync(UPLOAD_CACHE_DIR);
  if (!cacheInfo.exists) {
    await FileSystem.makeDirectoryAsync(UPLOAD_CACHE_DIR, { intermediates: true });
  }

  const safeName = (fileName || 'upload.opus').replace(/[^\w.\-]/g, '_');
  const destUri = `${UPLOAD_CACHE_DIR}${Date.now()}_${safeName}`;

  await FileSystem.copyAsync({ from: sourceUri, to: destUri });

  const copied = await FileSystem.getInfoAsync(destUri);
  if (!copied.exists) {
    throw new Error('Could not prepare the file for upload.');
  }

  return destUri;
}

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function parseJsonResponse(body, fallbackMessage) {
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(fallbackMessage);
  }

  if (data?.success === false) {
    throw new Error(data?.message || fallbackMessage);
  }

  return data;
}

function resolveDownloadUrl(url) {
  if (/^https?:\/\//i.test(url)) return url;
  const apiOrigin = API_ROOT.replace(/\/api\/?$/, '');
  return url.startsWith('/') ? `${apiOrigin}${url}` : `${API_ROOT}/${url}`;
}

function throwHttpError(status, body, fallback) {
  let message = `${fallback} (HTTP ${status})`;
  try {
    const data = JSON.parse(body);
    if (data?.message) message = data.message;
  } catch {
    // keep default message
  }
  throw new Error(message);
}

async function downloadToOutput(downloadUrl, outputUri, onProgress) {
  onProgress?.(60);

  const headers = await getAuthHeaders();
  delete headers['Content-Type'];

  const result = await FileSystem.downloadAsync(resolveDownloadUrl(downloadUrl), outputUri, {
    headers,
  });

  onProgress?.(95);

  const outInfo = await FileSystem.getInfoAsync(result.uri);
  if (!outInfo.exists) {
    throw new Error('Converted file was not saved.');
  }

  return {
    uri: result.uri,
    path: toDisplayPath(result.uri),
    size: outInfo.size,
  };
}

/**
 * POST /api/audio/opus-to-wav → { success, wavPath: "/downloads/output.wav" }
 */
export async function convertOpusToWav(sourceUri, fileName, onProgress) {
  await ensureOutputDir();

  const baseName = getBaseName(fileName);
  const outputUri = `${OUTPUT_DIR}${baseName}.wav`;

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  onProgress?.(5);

  const uploadUri = await resolveUploadUri(sourceUri, fileName);
  onProgress?.(10);

  const authHeaders = await getAuthHeaders();
  delete authHeaders['Content-Type'];

  const upload = await FileSystem.uploadAsync(
    `${API_ROOT}/audio/opus-to-wav`,
    uploadUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/opus',
      parameters: { fileName },
      headers: authHeaders,
    }
  );

  onProgress?.(40);

  if (upload.status < 200 || upload.status >= 300) {
    throwHttpError(upload.status, upload.body, 'WAV conversion failed');
  }

  const payload = parseJsonResponse(upload.body, 'Invalid response from conversion server.');
  const downloadUrl = payload.wavPath;
  if (!downloadUrl) {
    throw new Error('Server did not return wavPath for the WAV file.');
  }

  const saved = await downloadToOutput(downloadUrl, outputUri, onProgress);
  onProgress?.(100);

  return {
    ...saved,
    fileName: `${baseName}.wav`,
    wavPath: downloadUrl,
  };
}

/**
 * POST /api/audio/wav-to-mp3 → { success, mp3Url: "/downloads/final.mp3" }
 */
export async function convertWavToMp3(wavOutput, opusFileName, onProgress) {
  const wavPath = typeof wavOutput === 'string' ? wavOutput : wavOutput?.wavPath;

  if (!wavPath) {
    throw new Error('WAV path missing. Convert to WAV first.');
  }

  await ensureOutputDir();

  const baseName = getBaseName(opusFileName);
  const outputUri = `${OUTPUT_DIR}${baseName}.mp3`;

  const existing = await FileSystem.getInfoAsync(outputUri);
  if (existing.exists) {
    await FileSystem.deleteAsync(outputUri, { idempotent: true });
  }

  onProgress?.(5);

  const response = await fetch(`${API_ROOT}/audio/wav-to-mp3`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify({ wavPath }),
  });

  const body = await response.text();
  onProgress?.(40);

  if (!response.ok) {
    throwHttpError(response.status, body, 'MP3 conversion failed');
  }

  const payload = parseJsonResponse(body, 'Invalid response from conversion server.');
  const downloadUrl = payload.mp3Url;
  if (!downloadUrl) {
    throw new Error('Server did not return mp3Url for the MP3 file.');
  }

  const saved = await downloadToOutput(downloadUrl, outputUri, onProgress);
  onProgress?.(100);

  return {
    ...saved,
    fileName: `${baseName}.mp3`,
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
