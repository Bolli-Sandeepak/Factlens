import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

import documentsRouter from './server/routes/documents.js';
import factsRouter from './server/routes/facts.js';
import relationshipsRouter from './server/routes/relationships.js';
import analyzeRouter from './server/routes/analyze.js';
import statsRouter from './server/routes/stats.js';
import demoRouter from './server/routes/demo.js';
import { getDb } from './server/database/db.js';
import logger from './server/utils/logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload and data directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static frontend files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/documents', documentsRouter);
app.use('/api/facts', factsRouter);
app.use('/api/relationships', relationshipsRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/stats', statsRouter);
app.use('/api/demo', demoRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'FactLens - Fact Knowledge Layer',
    timestamp: new Date().toISOString(),
  });
});

// Fallback to index.html for SPA navigation
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Initialize DB and start server
async function startServer() {
  try {
    await getDb();
    logger.success('Database initialized.');

    app.listen(PORT, () => {
      logger.success(`FactLens Server running on http://localhost:${PORT}`);
      logger.info(`Press Ctrl+C to stop the server.`);
    });
  } catch (err) {
    logger.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
