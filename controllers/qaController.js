import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple Q&A knowledge base
const knowledgeBase = {
  greetings: {
    patterns: ['hello', 'hi', 'hey', 'greetings'],
    responses: [
      "Hello! I'm your Voice-to-Text assistant.",
      "Hi there! How can I help you today?",
      "Hey! Ready to transcribe some audio?"
    ]
  },
  identity: {
    patterns: ['who are you', 'what are you', 'your name', 'what is your name'],
    responses: [
      "I'm your Voice-to-Text assistant, powered by Whisper AI technology.",
      "I'm a speech recognition assistant that can transcribe audio in real-time.",
      "You can call me Whisper AI! I convert speech to text."
    ]
  },
  capabilities: {
    patterns: ['what can you do', 'how do you work', 'features', 'capabilities'],
    responses: [
      "I can transcribe audio files, record live speech, save transcriptions, and answer basic questions.",
      "I work by converting speech to text using AI. You can upload audio files or speak directly.",
      "Features include: audio transcription, live recording, text saving, and Q&A about your transcriptions."
    ]
  },
  time: {
    patterns: ['time', 'what time', 'current time'],
    responses: [
      `The current time is ${new Date().toLocaleTimeString()}.`,
      `It's ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} now.`
    ]
  },
  date: {
    patterns: ['date', 'today', 'what day', 'current date'],
    responses: [
      `Today is ${new Date().toLocaleDateString()}.`,
      `The date is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`
    ]
  },
  transcription: {
    patterns: ['transcribe', 'transcription', 'convert speech', 'speech to text'],
    responses: [
      "I use AI to convert speech to text. You can upload audio files or record directly.",
      "Transcription works by analyzing audio signals and converting them to written text."
    ]
  },
  help: {
    patterns: ['help', 'how to', 'guide', 'instructions'],
    responses: [
      "Here's how to use me: 1) Upload an audio file, 2) Record live speech, 3) Save transcriptions, 4) Ask questions about your transcriptions.",
      "You can: Upload audio files (MP3, WAV, etc.), Record live speech, Save transcriptions as text files, or Ask me questions about the content."
    ]
  }
};

// Enhanced context search function
const searchInContext = (question, context) => {
  if (!context || typeof context !== 'string' || context.trim().length === 0) {
    return null;
  }

  const questionLower = question.toLowerCase();
  const contextLower = context.toLowerCase();
  
  // Extract keywords from question (excluding common words)
  const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'what', 'when', 'where', 'why', 'how', 'who']);
  const keywords = questionLower.split(' ')
    .filter(word => word.length > 3 && !commonWords.has(word))
    .sort((a, b) => b.length - a.length); // Prioritize longer words

  // Try to find matches in context
  for (const keyword of keywords) {
    if (contextLower.includes(keyword)) {
      const keywordIndex = contextLower.indexOf(keyword);
      const start = Math.max(0, keywordIndex - 100);
      const end = Math.min(context.length, keywordIndex + keyword.length + 100);
      
      // Extract surrounding text
      let excerpt = context.substring(start, end);
      
      // Ensure we have complete sentences
      if (start > 0) {
        const firstPeriod = excerpt.indexOf('.');
        if (firstPeriod > 0) {
          excerpt = excerpt.substring(firstPeriod + 1);
        }
      }
      
      if (end < context.length) {
        const lastPeriod = excerpt.lastIndexOf('.');
        if (lastPeriod > 0) {
          excerpt = excerpt.substring(0, lastPeriod + 1);
        }
      }
      
      return {
        keyword,
        excerpt: excerpt.trim(),
        confidence: keyword.length > 5 ? 'high' : 'medium'
      };
    }
  }
  
  return null;
};

// Generate response based on knowledge base and context
const generateResponse = (question, context = '') => {
  const questionLower = question.toLowerCase().trim();
  
  // Check knowledge base
  for (const [category, data] of Object.entries(knowledgeBase)) {
    for (const pattern of data.patterns) {
      if (questionLower.includes(pattern)) {
        const randomResponse = data.responses[Math.floor(Math.random() * data.responses.length)];
        return {
          answer: randomResponse,
          source: 'knowledge_base',
          category
        };
      }
    }
  }
  
  // Search in provided context
  if (context) {
    const contextResult = searchInContext(question, context);
    if (contextResult) {
      return {
        answer: `Based on your transcription, I found this about "${contextResult.keyword}":\n\n"${contextResult.excerpt}"`,
        source: 'context_search',
        confidence: contextResult.confidence,
        keyword: contextResult.keyword
      };
    }
  }
  
  // Search in saved transcriptions
  const savedResult = searchInSavedTranscriptions(question);
  if (savedResult) {
    return {
      answer: `In your saved transcription "${savedResult.filename}", I found:\n\n"${savedResult.excerpt}"`,
      source: 'saved_transcriptions',
      filename: savedResult.filename,
      timestamp: savedResult.timestamp
    };
  }
  
  // Default response
  const defaultResponses = [
    `I heard you ask: "${question}". For more specific answers, please ask about your transcriptions or use more specific keywords.`,
    `That's an interesting question about "${question}". You can ask me about your saved transcriptions or how to use the transcription features.`,
    `Regarding "${question}", I can help you with transcription-related queries or questions about your saved audio files.`,
    `Thanks for your question: "${question}". For more detailed answers, try asking about specific content from your transcriptions.`
  ];
  
  return {
    answer: defaultResponses[Math.floor(Math.random() * defaultResponses.length)],
    source: 'default',
    suggestion: 'Try asking about your transcriptions or say "help" for guidance.'
  };
};

// Search in saved transcriptions
const searchInSavedTranscriptions = (question) => {
  try {
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return null;
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    const questionLower = question.toLowerCase();
    
    // Search through all transcriptions
    for (const [key, value] of Object.entries(transData)) {
      if (typeof value === 'object' && value.text) {
        // Check if question keywords appear in transcription
        const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
        const keywords = questionLower.split(' ')
          .filter(word => word.length > 3 && !commonWords.has(word));
        
        for (const keyword of keywords) {
          if (value.text.toLowerCase().includes(keyword)) {
            const start = value.text.toLowerCase().indexOf(keyword);
            const excerptStart = Math.max(0, start - 50);
            const excerptEnd = Math.min(value.text.length, start + keyword.length + 100);
            const excerpt = value.text.substring(excerptStart, excerptEnd);
            
            return {
              filename: value.textFile || key,
              excerpt: excerpt.trim(),
              timestamp: value.savedAt || 'unknown',
              keyword
            };
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching saved transcriptions:', error);
    return null;
  }
};

export const askQuestion = async (req, res) => {
  try {
    const { question, context } = req.body;

    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      return res.status(400).json({ 
        error: "Question is required and must be a non-empty string" 
      });
    }

    console.log('🤔 Q&A Request:', { 
      question: question.substring(0, 100),
      contextLength: context ? context.length : 0 
    });

    // Generate response
    const response = generateResponse(question, context);

    return res.status(200).json({
      success: true,
      question: question,
      ...response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Q&A Error:", error);
    
    return res.status(200).json({
      success: true,
      question: req.body?.question || 'Unknown question',
      answer: "Thanks for your question. I'm processing it now. If you're asking about a transcription, make sure it's been saved first.",
      source: 'error_fallback',
      timestamp: new Date().toISOString()
    });
  }
};

export const getKnowledgeBase = async (req, res) => {
  try {
    const categories = Object.keys(knowledgeBase).map(category => ({
      category,
      examplePatterns: knowledgeBase[category].patterns.slice(0, 3),
      description: knowledgeBase[category].responses[0]
    }));

    return res.status(200).json({
      success: true,
      categories,
      totalCategories: categories.length,
      supportedQueries: [
        'Greetings and introductions',
        'Questions about capabilities',
        'Time and date queries',
        'Transcription-related questions',
        'Context-based questions from your saved transcriptions'
      ]
    });

  } catch (error) {
    console.error('Error getting knowledge base:', error);
    return res.status(500).json({ error: 'Failed to retrieve knowledge base' });
  }
};

export const getTranscriptionContext = async (req, res) => {
  try {
    const { filename } = req.params;
    
    const transFile = path.join(process.cwd(), 'transcriptions.json');
    
    if (!fs.existsSync(transFile)) {
      return res.status(404).json({ error: 'No transcriptions found' });
    }
    
    const transData = JSON.parse(fs.readFileSync(transFile, 'utf8'));
    
    // Find transcription by filename
    for (const [key, value] of Object.entries(transData)) {
      if (typeof value === 'object' && 
          (value.textFile === filename || value.audioFile === filename || key === filename)) {
        return res.status(200).json({
          success: true,
          filename,
          text: value.text || 'No text available',
          savedAt: value.savedAt,
          hasAudio: !!value.audioFile,
          contextAvailable: value.text && value.text.length > 0
        });
      }
    }
    
    return res.status(404).json({ error: 'Transcription not found' });

  } catch (error) {
    console.error('Error getting transcription context:', error);
    return res.status(500).json({ error: 'Failed to retrieve transcription context' });
  }
};