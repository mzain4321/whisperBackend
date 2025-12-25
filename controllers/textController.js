import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const saveText = async (req, res) => {
  try {
    const { text, fileName } = req.body;
    let filename = fileName || `transcription_${Date.now()}.txt`;

    // Validate text
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ 
        error: "No text provided or text is empty" 
      });
    }

    // Clean filename
    filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

    // Ensure it has .txt extension
    if (!filename.toLowerCase().endsWith('.txt')) {
      filename += '.txt';
    }

    // Create uploads directory
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Save as text file
    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, text);

    // Also save to transcriptions.json
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    let transData = {};
    
    if (fs.existsSync(transFile)) {
      try {
        transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
      } catch (e) {
        console.error('Error reading transcriptions file:', e);
        // If file is corrupted, start fresh
        transData = {};
      }
    }

    transData[filename] = {
      text,
      savedAt: new Date().toISOString(),
      filePath: `/uploads/${filename}`,
      size: Buffer.byteLength(text, 'utf8')
    };
    
    fs.writeFileSync(transFile, JSON.stringify(transData, null, 2));

    return res.status(200).json({ 
      success: true, 
      fileName: filename,
      filePath: `/uploads/${filename}`,
      size: Buffer.byteLength(text, 'utf8'),
      savedAt: transData[filename].savedAt
    });

  } catch (err) {
    console.error('Error saving text:', err);
    return res.status(500).json({ 
      error: 'Failed to save text',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

export const getTextFile = async (req, res) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }

    // Prevent directory traversal attacks
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Read and return the file
    const text = fs.readFileSync(filePath, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    
    return res.send(text);

  } catch (err) {
    console.error('Error retrieving text file:', err);
    return res.status(500).json({ error: 'Failed to retrieve file' });
  }
};

export const getAllSavedTexts = async (req, res) => {
  try {
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return res.status(200).json({ texts: {} });
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    
    // Transform data for response
    const texts = Object.keys(transData).map(filename => ({
      filename,
      text: transData[filename].text.substring(0, 100) + '...', // Preview
      fullText: transData[filename].text,
      savedAt: transData[filename].savedAt,
      size: transData[filename].size,
      filePath: transData[filename].filePath
    }));

    return res.status(200).json({ 
      count: texts.length,
      texts 
    });

  } catch (err) {
    console.error('Error reading saved texts:', err);
    return res.status(500).json({ error: 'Failed to retrieve saved texts' });
  }
};