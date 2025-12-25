import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();

// ✅ **FIX 1: Configure CORS with proper allowed origins**
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5000',
  'https://whisper-backend-eight.vercel.app', 
  'https://whisper-dusky-one.vercel.app'
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // For development, log the blocked origin
    console.log(`⚠️  CORS blocked origin: ${origin}`);
    
    return callback(new Error(`Not allowed by CORS. Origin: ${origin}`), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ✅ **FIX 2: Use the proper CORS configuration**
app.use(cors(corsOptions));

// ✅ **FIX 3: Handle preflight requests explicitly**
app.options('*', cors(corsOptions));

app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000 // limit each IP to 1000 requests per windowMs
});
app.use('/api', limiter);

// ✅ Serve uploaded files statically (important!)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res, filePath) => {
    // ✅ **FIX 4: Set CORS headers for static files too**
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Set appropriate headers for audio files
    if (filePath.endsWith('.wav')) {
      res.setHeader('Content-Type', 'audio/wav');
    } else if (filePath.endsWith('.mp3')) {
      res.setHeader('Content-Type', 'audio/mpeg');
    }
    // Enable range requests for audio seeking
    res.setHeader('Accept-Ranges', 'bytes');
  }
}));

// ✅ **FIX 5: Add CORS headers middleware before routes**
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (process.env.NODE_ENV === 'development') {
    // Allow all in development for easier testing
    res.header('Access-Control-Allow-Origin', '*');
  }
  
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Import routes
import apiRoutes from './routes/index.js';

// Use API routes
app.use('/api', apiRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Voice-to-Text API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    cors: {
      allowedOrigins: allowedOrigins,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Voice-to-Text Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/health',
      transcribe: '/api/transcribe',
      text: '/api/text',
      live: '/api/live',
      qa: '/api/qa',
      files: '/api/files',
      audio: '/api/audio',
      uploads: '/api/uploads'
    },
    cors: {
      allowedOrigins: allowedOrigins,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    requestedUrl: req.originalUrl,
    method: req.method,
    availableEndpoints: {
      health: '/health',
      api: '/api/*',
      uploads: '/uploads/*'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS Error',
      message: err.message,
      allowedOrigins: allowedOrigins,
      yourOrigin: req.headers.origin || 'Not specified',
      environment: process.env.NODE_ENV || 'development'
    });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
🚀 Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode
📁 Uploads served from: ${path.join(process.cwd(), 'uploads')}
🔗 API Base URL: http://localhost:${PORT}/api
🔗 Health check: http://localhost:${PORT}/health
🔗 Static files: http://localhost:${PORT}/uploads/{filename}
✅ CORS enabled for origins: ${allowedOrigins.join(', ')}
  `);
});