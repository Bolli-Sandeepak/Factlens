import express from 'express';
import dbService from '../services/database.js';
import { relationshipEngine } from '../services/relationshipEngine.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * POST /api/analyze
 * Triggers cross-document fact matching and relationship reasoning
 */
router.post('/', async (req, res) => {
  try {
    const allFacts = await dbService.getFacts();
    if (allFacts.length === 0) {
      return res.status(400).json({ error: 'No facts available to analyze. Please upload documents first.' });
    }

    const relationships = relationshipEngine.generateRelationships(allFacts);
    await dbService.saveRelationships(relationships);

    return res.json({
      message: 'Analysis completed successfully',
      factsAnalyzed: allFacts.length,
      relationshipsFound: relationships.length,
      relationships,
    });
  } catch (err) {
    logger.error('Analysis error:', err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
