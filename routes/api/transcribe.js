import express from 'express';
import { 
  uploadMiddleware, 
  transcribeAudio, 
  getTranscriptions, 
  getTranscription 
} from '../../controllers/transcriptionController.js';

const router = express.Router();

// POST /api/transcribe - Upload and transcribe audio
router.post('/', uploadMiddleware, transcribeAudio);

// GET /api/transcriptions - Get all transcriptions
router.get('/transcriptions', getTranscriptions);

// GET /api/transcriptions/:filename - Get specific transcription
router.get('/transcriptions/:filename', getTranscription);

export default router;