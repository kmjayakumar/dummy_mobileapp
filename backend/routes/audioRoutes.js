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

/** DDMMYYYY_HH-MM-SS (dashes in time — safe for Windows filenames) */
function makeTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const date = `${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `${date}_${time}`;
}

function stampFromWavDownloadPath(wavPath) {
  const base = path.basename(String(wavPath).replace(/\\/g, '/'));
  const match = base.match(/^(.+)_output\.wav$/i);
  return match ? match[1] : null;
}

function pathsForStamp(stamp) {
  return {
    inputOpus: path.join(UPLOADS_DIR, `${stamp}_input.opus`),
    outputWav: path.join(OUTPUTS_DIR, `${stamp}_output.wav`),
    finalMp3: path.join(OUTPUTS_DIR, `${stamp}_final.mp3`),
    wavDownload: `/downloads/${stamp}_output.wav`,
    mp3Download: `/downloads/${stamp}_final.mp3`,
  };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, _file, cb) => {
      const stamp = req.conversionStamp || makeTimestamp();
      req.conversionStamp = stamp;
      cb(null, `${stamp}_input.opus`);
    },
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
    return null;
  }

  const basename = path.basename(wavPath.replace(/\\/g, '/'));
  const fromOutputs = path.join(OUTPUTS_DIR, basename);

  if (fs.existsSync(fromOutputs)) {
    return fromOutputs;
  }

  if (path.isAbsolute(wavPath) && fs.existsSync(wavPath)) {
    return wavPath;
  }

  return null;
}

// POST /api/audio/opus-to-wav
router.post(
  '/opus-to-wav',
  (req, _res, next) => {
    req.conversionStamp = makeTimestamp();
    next();
  },
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        console.log('[audio] opus-to-wav: no file received');
        return res.status(400).json({ success: false, message: 'No file uploaded (field name: file)' });
      }

      const stamp = req.conversionStamp || stampFromWavDownloadPath(req.file.filename) || makeTimestamp();
      const { inputOpus, outputWav, wavDownload } = pathsForStamp(stamp);

      console.log('[audio] opus-to-wav: file received', {
        originalName: req.file.originalname,
        size: req.file.size,
        stamp,
        path: req.file.path,
      });

      if (!fs.existsSync(inputOpus)) {
        return res.status(400).json({ success: false, message: 'Upload failed — input file not found' });
      }

      const command = `ffmpeg -y -c:a libopus -i "${inputOpus}" -af aresample=async=1 -ar 48000 "${outputWav}"`;
      await runFfmpeg(command, 'opus-to-wav');

      if (!fs.existsSync(outputWav)) {
        console.error('[audio] opus-to-wav: WAV was not created', outputWav);
        return res.status(500).json({ success: false, message: 'WAV file was not created' });
      }

      console.log('[audio] opus-to-wav: success →', wavDownload);
      return res.json({
        success: true,
        wavPath: wavDownload,
        stamp,
      });
    } catch (err) {
      console.error('[audio] opus-to-wav: failure', err.stderr || err.message || err);
      return res.status(500).json({
        success: false,
        message: err.stderr || err.message || 'FFmpeg conversion failed',
      });
    }
  }
);

// POST /api/audio/wav-to-mp3
router.post('/wav-to-mp3', async (req, res) => {
  try {
    const { wavPath } = req.body || {};
    console.log('[audio] wav-to-mp3: request body', { wavPath });

    const wavFile = resolveWavFile(wavPath);
    if (!wavFile) {
      console.error('[audio] wav-to-mp3: WAV not found for', wavPath);
      return res.status(400).json({
        success: false,
        message: 'WAV file not found. Convert to WAV first.',
      });
    }

    const stamp = stampFromWavDownloadPath(wavPath) || stampFromWavDownloadPath(wavFile);
    if (!stamp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid wavPath — expected /downloads/DDMMYYYY_HH-MM-SS_output.wav',
      });
    }

    const { finalMp3, mp3Download } = pathsForStamp(stamp);

    const command = `ffmpeg -y -i "${wavFile}" -b:a 192k "${finalMp3}"`;
    await runFfmpeg(command, 'wav-to-mp3');

    if (!fs.existsSync(finalMp3)) {
      console.error('[audio] wav-to-mp3: MP3 was not created', finalMp3);
      return res.status(500).json({ success: false, message: 'MP3 file was not created' });
    }

    console.log('[audio] wav-to-mp3: success →', mp3Download);
    return res.json({
      success: true,
      mp3Url: mp3Download,
      stamp,
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
