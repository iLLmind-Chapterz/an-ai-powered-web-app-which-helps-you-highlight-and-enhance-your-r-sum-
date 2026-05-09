import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import multer from 'multer';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Use require for robust CJS/ESM interop with these specific libraries
const { PDFParse } = require('pdf-parse');
const mammoth = require('mammoth');
import Database from 'better-sqlite3';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Database (Legacy SQLite - keeping for reference but routes removed)
// Firestore is now used for persistence in the frontend
const db = new Database('gap-analyzer.db');
// ... legacy table creation ...
db.exec(`
  CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_title TEXT,
    resume_text TEXT,
    jd_text TEXT,
    analysis_result TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Gap Analyzer Engine' });
  });

  /**
   * AI Studio Upload Route
   * Handles multi-format document extraction (PDF, DOCX, TXT)
   */
  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Please select a file to upload' });
    }

    try {
      let text = '';
      const fileExtension = path.extname(req.file.originalname).toLowerCase();
      const mimeType = req.file.mimetype;

      if (mimeType === 'application/pdf' || fileExtension === '.pdf') {
        try {
          const parser = new PDFParse({ data: req.file.buffer });
          const result = await parser.getText();
          text = result.text;
          await parser.destroy();
        } catch (pdfErr) {
          console.error('PDF Parse Specific Error:', pdfErr);
          throw new Error('PDF extraction failed. The file might be corrupted or password-protected.');
        }
      } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileExtension === '.docx') {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        text = result.value;
      } else if (mimeType === 'text/plain' || fileExtension === '.txt') {
        text = req.file.buffer.toString('utf-8');
      } else {
        return res.status(400).json({ error: 'Invalid file format. Only PDF, DOCX, and TXT are supported.' });
      }

      // Enhanced Semantic Cleanup for Documents (Improved Extraction)
      const cleanText = text
        .replace(/\r\n/g, '\n')                   // Normalize line endings
        .replace(/(\w)-\s*\n\s*(\w)/g, '$1$2')    // Reconstruct words split by hyphenation at line breaks
        .replace(/[^\S\n]+/g, ' ')                // Collapse horizontal spaces but keep solo newlines
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove non-printable control characters
        .replace(/[•●▪◦‣■]/g, '•')                // Normalize bullet symbols
        .replace(/\u00a0/g, ' ')                  // Replace non-breaking spaces
        .replace(/\s+$/gm, '')                    // Trim trailing spaces from each line
        .replace(/\n\s*•/g, '\n•')                // Fix bullet point spacing
        .replace(/([a-z])([A-Z])/g, '$1 $2')      // Split camelCase words often found in PDF extraction artifacts
        .replace(/\n{3,}/g, '\n\n')               // Max two consecutive newlines
        .trim();
      
      if (cleanText.length < 50) {
        throw new Error('Document contains insufficient text for analysis.');
      }

      res.json({ 
        text: cleanText,
        filename: req.file.originalname,
        size: req.file.size
      });
    } catch (error) {
      console.error('Extraction Failure:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Processing failure' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
