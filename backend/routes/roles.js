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

// GET /api/v1/roles
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT name, permissions FROM roles ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching roles:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/roles
router.post('/', requireAdmin, async (req, res) => {
  const { name, permissions } = req.body;
  if (!name) return res.status(400).json({ error: 'Role name is required' });

  try {
    const perms = permissions || [];
    const result = await pool.query(
      `INSERT INTO roles (name, permissions) VALUES ($1, $2) RETURNING name, permissions`,
      [name, JSON.stringify(perms)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating role:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Role already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/roles/:name
router.put('/:name', requireAdmin, async (req, res) => {
  const { name } = req.params;
  const { permissions } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE roles SET permissions = $1 WHERE name = $2 RETURNING name, permissions`,
      [JSON.stringify(permissions || []), name]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/roles/:name
router.delete('/:name', requireAdmin, async (req, res) => {
  const { name } = req.params;
  
  if (['ADMIN', 'MANAGER', 'STAFF'].includes(name)) {
    return res.status(400).json({ error: 'Cannot delete default roles' });
  }

  try {
    // Optional: check if users are still assigned to this role before deleting
    const usersWithRole = await pool.query('SELECT count(*) FROM users WHERE role = $1', [name]);
    if (parseInt(usersWithRole.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete role while users are assigned to it' });
    }

    const result = await pool.query('DELETE FROM roles WHERE name = $1 RETURNING name', [name]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    res.json({ message: 'Role deleted' });
  } catch (err) {
    console.error('Error deleting role:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
