import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serveAudioFile = async (req, res) => {
  try {
    const { filename } = req.params;
    const { download } = req.query;
    
    console.log("🔊 Audio file request:", { 
      filename, 
      download: download === 'true',
      originalUrl: req.originalUrl 
    });

    if (!filename) {
      return res.status(400).json({ 
        error: "File name is required" 
      });
    }

    // Security: Prevent directory traversal
    const safeFileName = path.basename(filename);
    
    // Try multiple possible locations
    const uploadDir = path.join(process.cwd(), 'uploads');
    let possiblePaths = [
      path.join(uploadDir, safeFileName),
      path.join(process.cwd(), 'public', 'uploads', safeFileName),
      path.join(process.cwd(), safeFileName)
    ];

    // Add platform-specific paths for development
    if (process.env.NODE_ENV !== 'production') {
      possiblePaths = [
        ...possiblePaths,
        path.join(__dirname, '..', '..', 'uploads', safeFileName),
        path.join(process.cwd(), 'src', 'uploads', safeFileName)
      ];
    }

    let filePath = null;
    let foundPath = null;

    for (const possiblePath of possiblePaths) {
      console.log("Checking path:", possiblePath);
      if (fs.existsSync(possiblePath)) {
        filePath = possiblePath;
        foundPath = possiblePath;
        break;
      }
    }

    if (!filePath) {
      // List all available files for debugging
      let availableFiles = [];
      try {
        if (fs.existsSync(uploadDir)) {
          availableFiles = fs.readdirSync(uploadDir);
        }
      } catch (dirError) {
        console.error("Error reading upload directory:", dirError);
      }
      
      console.log("❌ File not found. Available files:", availableFiles);
      
      return res.status(404).json({ 
        error: "File not found",
        requested: safeFileName,
        available: availableFiles,
        searchedPaths: possiblePaths.map(p => p.replace(process.cwd(), ''))
      });
    }

    console.log("✅ File found at:", foundPath);
    
    // Get file stats
    const fileStats = fs.statSync(filePath);

    // Determine content type based on file extension
    const ext = path.extname(safeFileName).toLowerCase();
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm',
      '.mp4': 'audio/mp4',
      '.flac': 'audio/flac',
      '.aac': 'audio/aac',
      '.m4b': 'audio/mp4',
      '.m4p': 'audio/mp4',
      '.m4r': 'audio/mp4',
      '.m4v': 'audio/mp4',
      '.3gp': 'audio/3gpp'
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    console.log("📦 Serving file:", {
      name: safeFileName,
      size: fileStats.size,
      formattedSize: formatFileSize(fileStats.size),
      type: contentType,
      path: foundPath.replace(process.cwd(), ''),
      lastModified: fileStats.mtime
    });

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', fileStats.size);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Last-Modified', fileStats.mtime.toUTCString());
    
    // Handle conditional GET (If-Modified-Since)
    const ifModifiedSince = req.headers['if-modified-since'];
    if (ifModifiedSince) {
      const lastModified = new Date(fileStats.mtime).getTime();
      const since = new Date(ifModifiedSince).getTime();
      
      if (lastModified <= since) {
        return res.status(304).end(); // Not Modified
      }
    }

    // Add download header if download parameter is present
    if (download === 'true') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    } else {
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    }

    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    
    // Handle range requests (for audio seeking)
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileStats.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileStats.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.error('Stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });
    } else {
      // No range request, stream entire file
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error streaming file' });
        }
      });
    }

  } catch (err) {
    console.error("❌ Error serving audio file:", err);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: "Internal server error",
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
};

export const getAudioInfo = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const safeFileName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(safeFileName).toLowerCase();
    
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm'
    };

    // Check if it has transcription
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    let transcription = null;
    
    if (fs.existsSync(transFile)) {
      try {
        const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
        
        // Direct match
        if (transData[safeFileName]) {
          transcription = typeof transData[safeFileName] === 'string' 
            ? transData[safeFileName] 
            : transData[safeFileName].text;
        } else {
          // Search for linked entries
          for (const [key, value] of Object.entries(transData)) {
            if (typeof value === 'object' && value.audioFile === safeFileName) {
              transcription = value.text;
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error reading transcription:', e);
      }
    }

    return res.status(200).json({
      success: true,
      file: {
        name: safeFileName,
        size: stats.size,
        formattedSize: formatFileSize(stats.size),
        type: mimeTypes[ext] || 'audio/unknown',
        extension: ext,
        created: stats.birthtime,
        modified: stats.mtime,
        duration: null, // You could add audio duration extraction here
        hasTranscription: !!transcription,
        transcriptionPreview: transcription ? transcription.substring(0, 200) + (transcription.length > 200 ? '...' : '') : null,
        playUrl: `/api/audio/play/${safeFileName}`,
        downloadUrl: `/api/audio/download/${safeFileName}`,
        streamUrl: `/api/audio/stream/${safeFileName}`
      }
    });

  } catch (err) {
    console.error('Error getting audio info:', err);
    return res.status(500).json({ error: 'Failed to get audio information' });
  }
};

export const streamAudio = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const safeFileName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    const ext = path.extname(safeFileName).toLowerCase();
    
    const mimeTypes = {
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
      '.ogg': 'audio/ogg',
      '.m4a': 'audio/mp4',
      '.webm': 'audio/webm'
    };

    const contentType = mimeTypes[ext] || 'audio/mpeg';

    // Set headers for streaming
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Connection', 'keep-alive');

    // Handle range requests for streaming
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stats.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stats.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      stream.pipe(res);
    } else {
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    }

  } catch (err) {
    console.error('Error streaming audio:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error streaming audio' });
    }
  }
};

// Helper function
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}