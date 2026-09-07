import express from 'express';
import dbService from '../services/database.js';

const router = express.Router();

/**
 * GET /api/facts
 * Query parameters: documentId, predicate, period, search
 */
router.get('/', async (req, res) => {
  try {
    const { documentId, predicate, period, search } = req.query;
    const facts = await dbService.getFacts({ documentId, predicate, period, search });
    return res.json(facts);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/facts/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const fact = await dbService.getFactById(req.params.id);
    if (!fact) {
      return res.status(404).json({ error: 'Fact not found' });
    }
    return res.json(fact);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
