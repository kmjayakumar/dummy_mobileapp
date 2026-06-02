const express = require('express');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { promisify } = require('util');
const multer = require('multer');

const execAsync = promisify(exec);

const router = express.Router();

const BACKEND_ROOT = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(BACKEND_ROOT, 'uploads');
const OUTPUTS_DIR = path.join(BACKEND_ROOT, 'outputs');

const INPUT_OPUS = path.join(UPLOADS_DIR, 'input.opus');
const OUTPUT_WAV = path.join(OUTPUTS_DIR, 'output.wav');
const OUTPUT_MP3 = path.join(OUTPUTS_DIR, 'final.mp3');

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, _file, cb) => cb(null, 'input.opus'),
  }),
  limits: { fileSize: 100 * 1024 * 1024 },
});

function runFfmpeg(command, label) {
  console.log(`[audio] FFmpeg (${label}): ${command}`);
  return execAsync(command, {
    cwd: BACKEND_ROOT,
    maxBuffer: 10 * 1024 * 1024,
  });
}

function resolveWavFile(wavPath) {
  if (!wavPath || typeof wavPath !== 'string') {
    return OUTPUT_WAV;
  }

  const normalized = wavPath.replace(/\\/g, '/');
  const basename = path.basename(normalized);

  if (normalized.includes('/downloads/') || basename === 'output.wav') {
    return path.join(OUTPUTS_DIR, 'output.wav');
  }

  if (path.isAbsolute(wavPath) && fs.existsSync(wavPath)) {
    return wavPath;
  }

  const fromOutputs = path.join(OUTPUTS_DIR, basename);
  if (fs.existsSync(fromOutputs)) {
    return fromOutputs;
  }

  return OUTPUT_WAV;
}

// POST /api/audio/opus-to-wav
router.post('/opus-to-wav', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.log('[audio] opus-to-wav: no file received');
      return res.status(400).json({ success: false, message: 'No file uploaded (field name: file)' });
    }

    console.log('[audio] opus-to-wav: file received', {
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path,
    });

    if (!fs.existsSync(INPUT_OPUS)) {
      return res.status(400).json({ success: false, message: 'Upload failed — input.opus not found' });
    }

    const command = `ffmpeg -y -c:a libopus -i "${INPUT_OPUS}" -af aresample=async=1 -ar 48000 "${OUTPUT_WAV}"`;
    await runFfmpeg(command, 'opus-to-wav');

    if (!fs.existsSync(OUTPUT_WAV)) {
      console.error('[audio] opus-to-wav: output.wav was not created');
      return res.status(500).json({ success: false, message: 'WAV file was not created' });
    }

    console.log('[audio] opus-to-wav: success → /downloads/output.wav');
    return res.json({
      success: true,
      wavPath: '/downloads/output.wav',
    });
  } catch (err) {
    console.error('[audio] opus-to-wav: failure', err.stderr || err.message || err);
    return res.status(500).json({
      success: false,
      message: err.stderr || err.message || 'FFmpeg conversion failed',
    });
  }
});

// POST /api/audio/wav-to-mp3
router.post('/wav-to-mp3', async (req, res) => {
  try {
    const { wavPath } = req.body || {};
    console.log('[audio] wav-to-mp3: request body', { wavPath });

    const wavFile = resolveWavFile(wavPath);
    if (!fs.existsSync(wavFile)) {
      console.error('[audio] wav-to-mp3: WAV not found at', wavFile);
      return res.status(400).json({
        success: false,
        message: 'WAV file not found. Convert to WAV first.',
      });
    }

    const command = `ffmpeg -y -i "${wavFile}" -b:a 192k "${OUTPUT_MP3}"`;
    await runFfmpeg(command, 'wav-to-mp3');

    if (!fs.existsSync(OUTPUT_MP3)) {
      console.error('[audio] wav-to-mp3: final.mp3 was not created');
      return res.status(500).json({ success: false, message: 'MP3 file was not created' });
    }

    console.log('[audio] wav-to-mp3: success → /downloads/final.mp3');
    return res.json({
      success: true,
      mp3Url: '/downloads/final.mp3',
    });
  } catch (err) {
    console.error('[audio] wav-to-mp3: failure', err.stderr || err.message || err);
    return res.status(500).json({
      success: false,
      message: err.stderr || err.message || 'FFmpeg conversion failed',
    });
  }
});

module.exports = router;
