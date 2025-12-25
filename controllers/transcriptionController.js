import multer from 'multer';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'video/mp4'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  }
});

// Use the upload middleware
export const uploadMiddleware = upload.single('file');

export const transcribeAudio = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;

    console.log(`Processing file: ${fileName}`);

    // Path to your Python script - adjust based on your structure
    const pythonScriptPath = path.join(process.cwd(), 'scripts', 'transcribe.py');
    
    // Check if Python script exists
    if (!fs.existsSync(pythonScriptPath)) {
      // Create a basic transcribe script if it doesn't exist
      const defaultPythonScript = `
import whisper
import sys
import warnings

warnings.filterwarnings("ignore")

audio_file = sys.argv[1]

model = whisper.load_model("tiny")
result = model.transcribe(audio_file)
text = result.get("text", "").strip()
print(text, flush=True)
`;
      
      const scriptsDir = path.join(process.cwd(), 'scripts');
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }
      fs.writeFileSync(pythonScriptPath, defaultPythonScript);
    }

    // Execute Python script with timeout
    try {
      const { stdout } = await execAsync(
        `python "${pythonScriptPath}" "${filePath}"`,
        { 
          timeout: 300000, // 5 minutes timeout
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        }
      );

      let transcription;
      try {
        const result = JSON.parse(stdout);
        transcription = result.transcription || result;
      } catch (e) {
        transcription = stdout.trim();
      }

      // Save transcription to file
      const transFile = path.join(process.cwd(), 'transcriptions.json');
      let transData = {};
      
      if (fs.existsSync(transFile)) {
        try {
          transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
        } catch (e) {
          console.error('Error reading transcriptions file:', e);
        }
      }
      
      transData[fileName] = {
        transcription,
        originalName: req.file.originalname,
        uploadedAt: new Date().toISOString(),
        size: req.file.size
      };
      
      fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));

      // Clean up uploaded file after processing (optional)
      // fs.unlinkSync(filePath);

      return res.status(200).json({
        success: true,
        transcription,
        fileName: fileName,
        originalName: req.file.originalname
      });

    } catch (execError) {
      console.error('Python execution error:', execError);
      
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      if (execError.killed || execError.signal) {
        return res.status(408).json({ 
          error: 'Transcription timeout. File might be too long.' 
        });
      }
      
      return res.status(500).json({ 
        error: 'Transcription failed',
        details: execError.message 
      });
    }

  } catch (err) {
    console.error('Server error:', err);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    return res.status(500).json({ 
      error: 'Server error',
      message: err.message 
    });
  }
};

// Get all transcriptions
export const getTranscriptions = async (req, res) => {
  try {
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return res.status(200).json({ transcriptions: {} });
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    return res.status(200).json({ transcriptions: transData });
  } catch (err) {
    console.error('Error reading transcriptions:', err);
    return res.status(500).json({ error: 'Failed to read transcriptions' });
  }
};

// Get single transcription by filename
export const getTranscription = async (req, res) => {
  try {
    const { filename } = req.params;
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return res.status(404).json({ error: 'Transcription not found' });
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    
    if (!transData[filename]) {
      return res.status(404).json({ error: 'Transcription not found' });
    }
    
    return res.status(200).json({ 
      filename,
      transcription: transData[filename] 
    });
  } catch (err) {
    console.error('Error reading transcription:', err);
    return res.status(500).json({ error: 'Failed to read transcription' });
  }
};