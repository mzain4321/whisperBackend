import express from 'express';
import { 
  serveUploadedFile,
  downloadUploadedFile 
} from '../../controllers/uploadontroler.js';

const router = express.Router();

// GET /api/uploads/:filename - Serve uploaded file (inline)
router.get('/:filename', serveUploadedFile);

// GET /api/uploads/download/:filename - Download uploaded file
router.get('/download/:filename', downloadUploadedFile);

export default router;