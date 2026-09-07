import express from 'express';
import dbService from '../services/database.js';

const router = express.Router();

/**
 * GET /api/stats
 */
router.get('/', async (req, res) => {
  try {
    const stats = await dbService.getStats();
    return res.json(stats);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
