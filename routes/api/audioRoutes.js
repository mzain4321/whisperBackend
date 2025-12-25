import express from 'express';
import { 
  serveAudioFile, 
  getAudioInfo,
  streamAudio 
} from '../../controllers/audioController.js';

const router = express.Router();

// GET /api/audio/play/:filename - Play audio (inline)
router.get('/play/:filename', serveAudioFile);

// GET /api/audio/download/:filename - Download audio (with download header)
router.get('/download/:filename', (req, res, next) => {
  req.query.download = 'true';
  next();
}, serveAudioFile);

// GET /api/audio/info/:filename - Get audio file information
router.get('/info/:filename', getAudioInfo);

// GET /api/audio/stream/:filename - Stream audio with range support
router.get('/stream/:filename', streamAudio);

export default router;