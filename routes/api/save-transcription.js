import express from 'express';
import { 
  saveText, 
  getTextFile, 
  getAllSavedTexts 
} from '../../controllers/textController.js';

const router = express.Router();

// POST /api/text/save - Save text to file
router.post('/save', saveText);

// GET /api/text/files - Get all saved texts
router.get('/files', getAllSavedTexts);

// GET /api/text/file/:filename - Download specific text file
router.get('/file/:filename', getTextFile);

export default router;