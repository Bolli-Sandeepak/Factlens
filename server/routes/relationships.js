import express from 'express';
import dbService from '../services/database.js';

const router = express.Router();

/**
 * GET /api/relationships
 * Filter by classification: ALL, CORROBORATED, CONTRADICTION, CONTEXTUAL_DIFFERENCE, UNCERTAIN
 */
router.get('/', async (req, res) => {
  try {
    const { classification } = req.query;
    const relationships = await dbService.getRelationships({ classification });
    return res.json(relationships);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/relationships/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const rel = await dbService.getRelationshipById(req.params.id);
    if (!rel) {
      return res.status(404).json({ error: 'Relationship not found' });
    }
    return res.json(rel);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
