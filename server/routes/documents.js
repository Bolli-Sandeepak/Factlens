import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { extractTextFromPdf } from '../services/pdfService.js';
import { factExtractorService } from '../services/factExtractor.js';
import { relationshipEngine } from '../services/relationshipEngine.js';
import dbService from '../services/database.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

const router = express.Router();

/**
 * POST /api/documents/upload
 * Accept single or multiple PDF documents
 */
router.post('/upload', upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No PDF files were uploaded' });
    }

    const uploadedDocs = [];

    for (const file of req.files) {
      const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      logger.info(`Received uploaded PDF: ${file.originalname} (${(file.size / 1024).toFixed(1)} KB)`);

      // Extract text page-by-page
      const { pageCount, pages } = await extractTextFromPdf(file.path);

      // Save document record
      await dbService.saveDocument({
        id: docId,
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        pageCount,
        datasetCategory: req.body.datasetCategory || 'Uploaded',
        status: 'completed',
      });

      // Save pages
      const pageRecords = pages.map(p => ({
        documentId: docId,
        pageNumber: p.pageNumber,
        text: p.text,
        tokenCount: p.tokenCount,
      }));
      await dbService.saveDocumentPages(pageRecords);

      // Extract facts from document
      const facts = await factExtractorService.extractFromDocument({
        documentId: docId,
        filename: file.originalname,
        pages,
        datasetCategory: req.body.datasetCategory,
      });

      // Save facts
      await dbService.saveFacts(facts);

      uploadedDocs.push({
        id: docId,
        originalName: file.originalname,
        pageCount,
        factsCount: facts.length,
      });
    }

    // Automatically recalculate cross-document relationships
    const allFacts = await dbService.getFacts();
    const relationships = relationshipEngine.generateRelationships(allFacts);
    await dbService.saveRelationships(relationships);

    return res.status(201).json({
      message: `Successfully ingested and processed ${uploadedDocs.length} PDF(s)`,
      documents: uploadedDocs,
      totalRelationships: relationships.length,
    });
  } catch (err) {
    logger.error('Error during PDF upload and processing:', err);
    return res.status(500).json({ error: err.message || 'Failed to process uploaded PDF' });
  }
});

/**
 * GET /api/documents
 */
router.get('/', async (req, res) => {
  try {
    const docs = await dbService.getDocuments();
    return res.json(docs);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/documents/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const doc = await dbService.getDocumentById(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found' });
    }
    const pages = await dbService.getDocumentPages(req.params.id);
    const facts = await dbService.getFacts({ documentId: req.params.id });

    return res.json({
      ...doc,
      pages,
      facts,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
