const express = require('express');
const router = express.Router();
const pool = require('../db');

// Middleware to verify ADMIN role
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// GET /api/v1/settings
// Fetch all settings as a single object
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM app_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/settings/:key
// Update a specific setting
router.put('/:key', requireAdmin, async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;
  try {
    await pool.query(
      `INSERT INTO app_settings (key, value, updated_at) 
       VALUES ($1, $2, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE 
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [key, JSON.stringify(value)]
    );
    res.json({ message: 'Setting updated successfully' });
  } catch (err) {
    console.error('Error updating setting:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
