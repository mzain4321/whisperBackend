import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const deleteFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file (your original logic)
    fs.unlinkSync(filePath);
    
    // Also remove from transcriptions.json if it exists there (your original logic)
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    if (fs.existsSync(transFile)) {
      try {
        const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
        
        // Delete direct match (your original logic)
        if (transData[safeFilename]) {
          delete transData[safeFilename];
        }
        
        // Also search for linked entries (enhanced logic)
        Object.keys(transData).forEach(key => {
          const entry = transData[key];
          if (typeof entry === 'object') {
            // If this file is referenced as textFile or audioFile
            if (entry.textFile === safeFilename || entry.audioFile === safeFilename) {
              if (entry.textFile === safeFilename) {
                delete entry.textFile;
                // If this was the only file in the entry, mark it
                if (!entry.audioFile && Object.keys(entry).length <= 3) {
                  delete transData[key];
                }
              }
              if (entry.audioFile === safeFilename) {
                delete entry.audioFile;
                // If this was the only file in the entry, mark it
                if (!entry.textFile && Object.keys(entry).length <= 3) {
                  delete transData[key];
                }
              }
            }
          }
        });
        
        // Also clean up any entries that are now empty
        Object.keys(transData).forEach(key => {
          const entry = transData[key];
          if (typeof entry === 'object' && 
              Object.keys(entry).length <= 2 && 
              (!entry.text || entry.text.trim().length === 0)) {
            delete transData[key];
          }
        });
        
        fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));
      } catch (e) {
        console.error('Error updating transcriptions file:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: `File "${safeFilename}" deleted successfully`,
      filename: safeFilename,
      deletedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ 
      error: 'Failed to delete file',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// Add a bulk delete endpoint as well
export const deleteMultipleFiles = async (req, res) => {
  try {
    const { filenames } = req.body;
    
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({ error: 'Array of filenames is required' });
    }

    const results = [];
    const errors = [];

    for (const filename of filenames) {
      try {
        const safeFilename = path.basename(filename);
        const filePath = path.join(process.cwd(), 'uploads', safeFilename);

        if (fs.existsSync(filePath)) {
          // Delete the file
          fs.unlinkSync(filePath);
          
          // Also remove from transcriptions.json
          const transFile = path.join(process.cwd(), 'transcriptions.json');
          if (fs.existsSync(transFile)) {
            try {
              const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
              
              if (transData[safeFilename]) {
                delete transData[safeFilename];
              }
              
              // Remove references in other entries
              Object.keys(transData).forEach(key => {
                const entry = transData[key];
                if (typeof entry === 'object') {
                  if (entry.textFile === safeFilename) delete entry.textFile;
                  if (entry.audioFile === safeFilename) delete entry.audioFile;
                }
              });
              
              fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));
            } catch (e) {
              console.error(`Error updating transcriptions for ${safeFilename}:`, e);
            }
          }
          
          results.push({
            filename: safeFilename,
            success: true,
            message: 'Deleted successfully'
          });
        } else {
          errors.push({
            filename: safeFilename,
            error: 'File not found',
            success: false
          });
        }
      } catch (err) {
        errors.push({
          filename,
          error: err.message,
          success: false
        });
      }
    }

    return res.status(200).json({
      success: true,
      deleted: results.length,
      failed: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error('Bulk delete error:', err);
    return res.status(500).json({ error: 'Failed to delete files' });
  }
};
export const getAllFiles = async (req, res) => {
  try {
    const uploadDir = path.join(process.cwd(), 'uploads');
    
    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Read all files from upload directory
    const files = fs.readdirSync(uploadDir);
    
    // Read transcriptions data
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

    // Process each file
    const fileList = files.map((filename) => {
      const filePath = path.join(uploadDir, filename);
      let stats = null;
      let transcription = null;
      let metadata = null;

      try {
        // Get file stats
        stats = fs.statSync(filePath);
        
        // Check if file exists in transcriptions data
        if (transData[filename]) {
          // Direct match
          transcription = transData[filename];
          metadata = {
            source: 'direct_match',
            hasTranscription: true
          };
        } else {
          // Look for this filename in transcription entries
          for (const [key, value] of Object.entries(transData)) {
            if (typeof value === 'object') {
              if (value.textFile === filename || value.audioFile === filename) {
                transcription = value.text || value;
                metadata = {
                  source: 'linked_entry',
                  entryId: key,
                  hasAudio: !!value.audioFile,
                  savedAt: value.savedAt,
                  type: value.type || 'unknown'
                };
                break;
              }
            }
          }
        }

        // If no transcription found, check if it's a text file
        if (!transcription && filename.endsWith('.txt')) {
          try {
            transcription = fs.readFileSync(filePath, 'utf8');
            metadata = {
              source: 'text_file',
              hasTranscription: true
            };
          } catch (readError) {
            console.error(`Error reading text file ${filename}:`, readError);
          }
        }

        return {
          id: `${filename}_${stats.mtimeMs}`,
          name: filename,
          path: `/uploads/${filename}`,
          downloadUrl: `/api/files/download/${filename}`,
          size: stats.size,
          formattedSize: formatFileSize(stats.size),
          type: getFileType(filename),
          extension: path.extname(filename).toLowerCase(),
          modified: stats.mtime,
          created: stats.birthtime,
          transcription: transcription ? (typeof transcription === 'string' ? 
            transcription.substring(0, 200) + (transcription.length > 200 ? '...' : '') : 
            'Object data') : null,
          hasTranscription: !!transcription,
          metadata: metadata || {
            source: 'file_only',
            hasTranscription: false
          }
        };
      } catch (statError) {
        console.error(`Error processing file ${filename}:`, statError);
        return {
          id: filename,
          name: filename,
          error: 'Unable to read file stats',
          type: 'unknown'
        };
      }
    });

    // Sort files by modification date (newest first)
    fileList.sort((a, b) => {
      if (a.modified && b.modified) {
        return new Date(b.modified) - new Date(a.modified);
      }
      return 0;
    });

    return res.status(200).json({
      success: true,
      count: fileList.length,
      directory: uploadDir,
      files: fileList,
      summary: {
        totalFiles: fileList.length,
        audioFiles: fileList.filter(f => f.type === 'audio').length,
        textFiles: fileList.filter(f => f.type === 'text').length,
        otherFiles: fileList.filter(f => f.type === 'other').length,
        filesWithTranscriptions: fileList.filter(f => f.hasTranscription).length
      }
    });

  } catch (err) {
    console.error('Error listing files:', err);
    return res.status(500).json({ 
      error: 'Failed to list files',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getFileInfo = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Prevent directory traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stats = fs.statSync(filePath);
    
    // Read transcription data
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    let transcription = null;
    let metadata = null;
    
    if (fs.existsSync(transFile)) {
      try {
        const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
        
        if (transData[safeFilename]) {
          transcription = transData[safeFilename];
          metadata = { source: 'direct_match' };
        } else {
          // Search for linked entries
          for (const [key, value] of Object.entries(transData)) {
            if (typeof value === 'object' && 
                (value.textFile === safeFilename || value.audioFile === safeFilename)) {
              transcription = value.text || value;
              metadata = {
                source: 'linked_entry',
                entryId: key,
                savedAt: value.savedAt,
                type: value.type
              };
              break;
            }
          }
        }
      } catch (e) {
        console.error('Error reading transcription data:', e);
      }
    }

    // If it's a text file, read its content
    if (safeFilename.endsWith('.txt') && !transcription) {
      try {
        transcription = fs.readFileSync(filePath, 'utf8');
        metadata = { source: 'text_file_content' };
      } catch (readError) {
        console.error('Error reading text file:', readError);
      }
    }

    const fileInfo = {
      filename: safeFilename,
      path: filePath,
      size: stats.size,
      formattedSize: formatFileSize(stats.size),
      type: getFileType(safeFilename),
      extension: path.extname(safeFilename).toLowerCase(),
      mimeType: getMimeType(safeFilename),
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isDirectory: stats.isDirectory(),
      permissions: {
        readable: true,
        writable: true,
        executable: false
      },
      transcription: transcription ? (typeof transcription === 'string' ? 
        transcription.substring(0, 500) + (transcription.length > 500 ? '...' : '') : 
        'Object data') : null,
      hasTranscription: !!transcription,
      metadata: metadata || { source: 'file_only' },
      downloadUrl: `/api/files/download/${safeFilename}`,
      qaContextUrl: transcription ? `/api/qa/context/${safeFilename}` : null
    };

    return res.status(200).json({
      success: true,
      file: fileInfo
    });

  } catch (err) {
    console.error('Error getting file info:', err);
    return res.status(500).json({ error: 'Failed to get file information' });
  }
};

export const downloadFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Set appropriate headers
    const mimeType = getMimeType(safeFilename);
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    res.setHeader('Content-Length', fs.statSync(filePath).size);

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

// export const deleteFile = async (req, res) => {
//   try {
//     const { filename } = req.params;
    
//     if (!filename) {
//       return res.status(400).json({ error: 'Filename is required' });
//     }

//     const safeFilename = path.basename(filename);
//     const filePath = path.join(process.cwd(), 'uploads', safeFilename);

//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({ error: 'File not found' });
//     }

//     // Delete the file
//     fs.unlinkSync(filePath);
    
//     // Also remove from transcriptions.json if it exists there
//     const transFile = path.join(process.cwd(), 'transcriptions.json');
//     if (fs.existsSync(transFile)) {
//       try {
//         const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
        
//         if (transData[safeFilename]) {
//           delete transData[safeFilename];
//         }
        
//         // Also search for linked entries
//         Object.keys(transData).forEach(key => {
//           const entry = transData[key];
//           if (typeof entry === 'object' && 
//               (entry.textFile === safeFilename || entry.audioFile === safeFilename)) {
//             if (entry.textFile === safeFilename) {
//               delete entry.textFile;
//             }
//             if (entry.audioFile === safeFilename) {
//               delete entry.audioFile;
//             }
//           }
//         });
        
//         fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));
//       } catch (e) {
//         console.error('Error updating transcriptions file:', e);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: `File "${safeFilename}" deleted successfully`,
//       filename: safeFilename
//     });

//   } catch (err) {
//     console.error('Delete error:', err);
//     return res.status(500).json({ error: 'Failed to delete file' });
//   }
// };

// Helper functions
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const audioExtensions = ['.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.webm', '.mp4', '.m4v'];
  const textExtensions = ['.txt', '.json', '.csv', '.xml', '.html', '.htm', '.md'];
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.svg', '.webp'];
  
  if (audioExtensions.includes(ext)) return 'audio';
  if (textExtensions.includes(ext)) return 'text';
  if (imageExtensions.includes(ext)) return 'image';
  
  return 'other';
}

function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  
  const mimeTypes = {
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.m4a': 'audio/mp4',
    '.webm': 'audio/webm',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.pdf': 'application/pdf'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}