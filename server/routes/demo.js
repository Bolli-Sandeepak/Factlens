import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractTextFromPdf } from '../services/pdfService.js';
import { factExtractorService } from '../services/factExtractor.js';
import { relationshipEngine } from '../services/relationshipEngine.js';
import dbService from '../services/database.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Process a dataset directory of real PDFs through the live pipeline.
 */
async function processDataset(datasetDir, datasetCategory) {
  const resolvedDir = path.resolve(__dirname, '../../', datasetDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Dataset directory not found: ${resolvedDir}`);
  }

  const files = fs.readdirSync(resolvedDir).filter(f => f.toLowerCase().endsWith('.pdf'));
  if (files.length === 0) {
    throw new Error(`No PDF files found in ${resolvedDir}`);
  }

  const ingested = [];

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const stat = fs.statSync(filePath);
    const docId = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    logger.info(`Ingesting starter dataset PDF: ${file}`);
    const { pageCount, pages } = await extractTextFromPdf(filePath);

    await dbService.saveDocument({
      id: docId,
      filename: file,
      originalName: file,
      fileSize: stat.size,
      pageCount,
      datasetCategory,
      status: 'completed',
    });

    const pageRecords = pages.map(p => ({
      documentId: docId,
      pageNumber: p.pageNumber,
      text: p.text,
      tokenCount: p.tokenCount,
    }));
    await dbService.saveDocumentPages(pageRecords);

    const facts = await factExtractorService.extractFromDocument({
      documentId: docId,
      filename: file,
      pages,
      datasetCategory,
    });

    await dbService.saveFacts(facts);

    ingested.push({
      id: docId,
      originalName: file,
      pageCount,
      factsCount: facts.length,
    });
  }

  // Generate relationships across all ingested documents
  const allFacts = await dbService.getFacts();
  const relationships = relationshipEngine.generateRelationships(allFacts);
  await dbService.saveRelationships(relationships);

  return {
    documents: ingested,
    factsTotal: allFacts.length,
    relationshipsTotal: relationships.length,
  };
}

/**
 * POST /api/demo/load-delhivery
 */
router.post('/load-delhivery', async (req, res) => {
  try {
    // Optionally clear existing before loading
    await dbService.clearAll();
    const result = await processDataset('starter-datasets/delhivery', 'Delhivery');
    return res.json({
      message: 'Successfully loaded and processed Delhivery Starter Dataset (3 PDFs)',
      ...result,
    });
  } catch (err) {
    logger.error('Error loading Delhivery dataset:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/demo/load-macroeconomy
 */
router.post('/load-macroeconomy', async (req, res) => {
  try {
    await dbService.clearAll();
    const result = await processDataset('starter-datasets/india-macroeconomy', 'India Macroeconomy');
    return res.json({
      message: 'Successfully loaded and processed India Macroeconomy Starter Dataset (3 PDFs)',
      ...result,
    });
  } catch (err) {
    logger.error('Error loading Macroeconomy dataset:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/reset
 */
router.post('/reset', async (req, res) => {
  try {
    await dbService.clearAll();
    return res.json({ message: 'Knowledge layer database reset successfully' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
