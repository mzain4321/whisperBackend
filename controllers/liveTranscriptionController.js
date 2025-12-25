import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for audio file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const uniqueName = `${timestamp}-${Math.random().toString(36).substring(7)}.${file.originalname.split('.').pop()}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedAudioTypes = [
      'audio/webm',
      'audio/mp4',
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/x-wav',
      'video/webm',
      'video/mp4'
    ];
    
    if (allowedAudioTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid audio file type. Allowed: webm, mp4, mp3, wav, ogg'));
    }
  }
});

// Middleware for handling form data with both text and file
export const uploadMiddleware = upload.single('audio');

export const saveLiveTranscription = async (req, res) => {
  try {
    const { text, fileName, hasAudio, fileExtension } = req.body;
    const audioFile = req.file;
    
    console.log('📥 Received save request:', {
      textLength: text?.length,
      fileName,
      hasAudio,
      fileExtension,
      audioFile: audioFile ? audioFile.originalname : 'none'
    });

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ 
        error: "No text provided or text is empty" 
      });
    }

    // Generate filename if not provided
    let baseFileName = fileName || `live_transcription_${Date.now()}`;
    baseFileName = baseFileName.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    let savedAudioFileName = null;
    let audioFileDetails = null;

    // Save audio file if present
    if (hasAudio === 'true' && audioFile) {
      savedAudioFileName = audioFile.filename;
      audioFileDetails = {
        originalName: audioFile.originalname,
        savedName: savedAudioFileName,
        size: audioFile.size,
        mimetype: audioFile.mimetype,
        path: audioFile.path
      };
      
      console.log("✅ Audio saved:", audioFileDetails);
    }

    // Save text file
    const textFileName = `${baseFileName}.txt`;
    const textFilePath = path.join(uploadDir, textFileName);
    fs.writeFileSync(textFilePath, text);
    
    console.log("✅ Text saved:", {
      fileName: textFileName,
      size: Buffer.byteLength(text, 'utf8'),
      path: textFilePath
    });

    // Save to transcriptions.json
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    let transData = {};
    
    if (fs.existsSync(transFile)) {
      try {
        transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
      } catch (e) {
        console.error('Error reading transcriptions file:', e);
        transData = {};
      }
    }

    // Create unique entry ID
    const entryId = `live_${Date.now()}`;
    
    // Store transcription data
    transData[entryId] = {
      id: entryId,
      text: text,
      textFile: textFileName,
      audioFile: savedAudioFileName,
      audioDetails: audioFileDetails,
      hasAudio: !!savedAudioFileName,
      fileType: fileExtension || (audioFile ? audioFile.mimetype : null),
      savedAt: new Date().toISOString(),
      type: 'live_transcription'
    };

    // Also index by filename for easy lookup
    transData[textFileName] = entryId;
    if (savedAudioFileName) {
      transData[savedAudioFileName] = entryId;
    }

    fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));

    return res.status(200).json({ 
      success: true, 
      id: entryId,
      textFile: textFileName,
      audioFile: savedAudioFileName,
      hasAudio: !!savedAudioFileName,
      fileType: fileExtension || (audioFile ? audioFile.mimetype : null),
      timestamp: new Date().toISOString(),
      downloadLinks: {
        text: `/api/transcriptions/download/text/${textFileName}`,
        audio: savedAudioFileName ? `/api/transcriptions/download/audio/${savedAudioFileName}` : null
      }
    });

  } catch (err) {
    console.error("❌ Save error:", err);
    
    // Clean up uploaded file if error occurred
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      try {
        fs.unlinkSync(req.file.path);
        console.log('Cleaned up audio file due to error');
      } catch (cleanupError) {
        console.error('Error cleaning up audio file:', cleanupError);
      }
    }
    
    return res.status(500).json({ 
      error: 'Failed to save live transcription',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getLiveTranscriptions = async (req, res) => {
  try {
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return res.status(200).json({ transcriptions: [] });
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    
    // Filter live transcriptions
    const liveTranscriptions = Object.values(transData)
      .filter(item => item && typeof item === 'object' && item.type === 'live_transcription')
      .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

    return res.status(200).json({ 
      count: liveTranscriptions.length,
      transcriptions: liveTranscriptions 
    });

  } catch (err) {
    console.error('Error fetching live transcriptions:', err);
    return res.status(500).json({ error: 'Failed to fetch live transcriptions' });
  }
};

export const downloadLiveTranscription = async (req, res) => {
  try {
    const { type, filename } = req.params;
    
    if (!['text', 'audio'].includes(type)) {
      return res.status(400).json({ error: 'Invalid download type' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    if (type === 'text') {
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    } else {
      // Determine MIME type for audio
      const ext = path.extname(safeFilename).toLowerCase();
      const mimeTypes = {
        '.webm': 'audio/webm',
        '.mp4': 'audio/mp4',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4'
      };
      
      res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Stream error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error streaming file' });
      }
    });

  } catch (err) {
    console.error('Download error:', err);
    return res.status(500).json({ error: 'Failed to download file' });
  }
};