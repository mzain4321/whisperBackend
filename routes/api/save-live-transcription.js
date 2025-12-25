import express from 'express';
import { 
  uploadMiddleware, 
  saveLiveTranscription, 
  getLiveTranscriptions,
  downloadLiveTranscription
} from '../../controllers/liveTranscriptionController.js';

const router = express.Router();

// POST /api/live/save - Save live transcription with optional audio
router.post('/save', uploadMiddleware, saveLiveTranscription);

// GET /api/live/list - Get all live transcriptions
router.get('/list', getLiveTranscriptions);

// GET /api/live/download/:type/:filename - Download text or audio file
router.get('/download/:type/:filename', downloadLiveTranscription);

export default router;