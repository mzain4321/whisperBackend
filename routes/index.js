import express from 'express';
import transcriptionRoutes from './api/transcribe.js';
import textRoutes from './api/save-transcription.js';
import liveTranscriptionRoutes from './api/save-live-transcription.js';
import qaRoutes from './api/qa.js';
import filesRoutes from './api/list-files.js';
import audioRoutes from './api/audioRoutes.js';
import uploadsRoutes from './api/uploadRoutre.js';

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Use routes
router.use('/transcribe', transcriptionRoutes);
router.use('/text', textRoutes);
router.use('/live', liveTranscriptionRoutes);
router.use('/qa', qaRoutes);
router.use('/files', filesRoutes);
router.use('/audio', audioRoutes);
router.use('/uploads', uploadsRoutes);

export default router;