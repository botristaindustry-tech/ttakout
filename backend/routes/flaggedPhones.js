const express = require('express');
const router = express.Router();
const db = require('../db');

// Middleware to verify manage_kds permission (or general auth)
const requireManageKds = (req, res, next) => {
  if (!req.user || !req.user.permissions || !req.user.permissions.includes('manage_kds')) {
    return res.status(403).json({ error: 'Access denied: manage_kds permission required' });
  }
  next();
};

// GET /api/v1/flagged-phones
// List all flagged phone numbers
router.get('/', requireManageKds, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM flagged_phones ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching flagged phones:', err);
    res.status(500).json({ error: 'Failed to fetch flagged phones' });
  }
});

// POST /api/v1/flagged-phones
// Add or update a flagged phone number
router.post('/', requireManageKds, async (req, res) => {
  const { phone_number, name, notes } = req.body;

  if (!phone_number || !name) {
    return res.status(400).json({ error: 'Phone number and name are required' });
  }

  // Normalize phone number format (remove non-digits, optional: keep leading +)
  const normalizedPhone = phone_number.trim();

  try {
    const query = `
      INSERT INTO flagged_phones (phone_number, name, notes, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (phone_number) 
      DO UPDATE SET name = EXCLUDED.name, notes = EXCLUDED.notes, created_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const { rows } = await db.query(query, [normalizedPhone, name, notes || '']);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error adding flagged phone:', err);
    res.status(500).json({ error: 'Failed to save flagged phone' });
  }
});

// DELETE /api/v1/flagged-phones/:id
// Remove a flagged phone number
router.delete('/:id', requireManageKds, async (req, res) => {
  const { id } = req.params;
  try {
    const { rowCount } = await db.query('DELETE FROM flagged_phones WHERE id = $1', [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Flagged phone record not found' });
    }
    res.json({ message: 'Flagged phone deleted successfully' });
  } catch (err) {
    console.error('Error deleting flagged phone:', err);
    res.status(500).json({ error: 'Failed to delete flagged phone' });
  }
});

module.exports = router;
