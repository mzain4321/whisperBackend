import express from 'express';
import { 
  askQuestion, 
  getKnowledgeBase,
  getTranscriptionContext
} from '../../controllers/qaController.js';

const router = express.Router();

// POST /api/qa/ask - Ask a question (with optional context)
router.post('/ask', askQuestion);

// GET /api/qa/knowledge - Get available knowledge base
router.get('/knowledge', getKnowledgeBase);

// GET /api/qa/context/:filename - Get transcription context for Q&A
router.get('/context/:filename', getTranscriptionContext);

export default router;