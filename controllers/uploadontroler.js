import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serveUploadedFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    // Security: Prevent directory traversal
    const safeFileName = path.basename(filename);
    
    // Try multiple locations (similar to your Next.js approach)
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Ensure upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, safeFileName);

    if (!fs.existsSync(filePath)) {
      // List available files for debugging
      const availableFiles = fs.readdirSync(uploadDir);
      console.log("Available files:", availableFiles);
      
      return res.status(404).json({ 
        error: "File not found",
        requested: safeFileName,
        available: availableFiles
      });
    }

    const stat = fs.statSync(filePath);
    
    // Determine content type
    const ext = path.extname(safeFileName).toLowerCase();
    let contentType = 'application/octet-stream';
    
    // Audio types
    if (['.wav', '.mp3', '.ogg', '.m4a', '.webm', '.flac', '.aac'].includes(ext)) {
      const mimeMap = {
        '.wav': 'audio/wav',
        '.mp3': 'audio/mpeg',
        '.ogg': 'audio/ogg',
        '.m4a': 'audio/mp4',
        '.webm': 'audio/webm',
        '.flac': 'audio/flac',
        '.aac': 'audio/aac'
      };
      contentType = mimeMap[ext] || 'audio/wav';
    }
    // Text types
    else if (['.txt', '.json', '.csv', '.xml'].includes(ext)) {
      contentType = 'text/plain';
    }
    // Image types
    else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
      contentType = `image/${ext.slice(1)}`;
      if (ext === '.jpg') contentType = 'image/jpeg';
    }

    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Handle range requests
    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
      const chunksize = (end - start) + 1;

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes'
      });

      const stream = fs.createReadStream(filePath, { start, end });
      return stream.pipe(res);
    }

    // Stream entire file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

  } catch (error) {
    console.error("Error serving uploaded file:", error);
    
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: "Internal Server Error",
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
};

// For direct file downloads
export const downloadUploadedFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: "Filename is required" });
    }

    const safeFileName = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFileName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found" });
    }

    const stat = fs.statSync(filePath);
    
    // Set download headers
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFileName}"`);
    res.setHeader('Content-Length', stat.size);

    // Stream the file
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);

  } catch (error) {
    console.error("Error downloading file:", error);
    
    if (!res.headersSent) {
      return res.status(500).json({ error: "Internal Server Error" });
    }
  }
};