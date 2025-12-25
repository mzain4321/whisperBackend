import express from 'express';
import { 
  getAllFiles, 
  getFileInfo, 
  downloadFile, 
  deleteFile,
  deleteMultipleFiles 
} from '../../controllers/filesController.js';

const router = express.Router();

// GET /api/files - List all files
router.get('/', getAllFiles);

// GET /api/files/info/:filename - Get detailed info about a file
router.get('/info/:filename', getFileInfo);

// GET /api/files/download/:filename - Download a file
router.get('/download/:filename', downloadFile);

// DELETE /api/files/:filename - Delete a single file
router.delete('/:filename', deleteFile);

// DELETE /api/files/batch - Delete multiple files
router.delete('/batch', deleteMultipleFiles);

export default router;