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

// GET /api/v1/users
// Fetch all registered and whitelisted users
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, role, permissions, created_at FROM users ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/v1/users
// Add a new user to the whitelist
router.post('/', requireAdmin, async (req, res) => {
  const { name, email, role, permissions } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  try {
    const perms = permissions || [];
    const result = await pool.query(
      `INSERT INTO users (name, email, role, permissions) 
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, permissions, created_at`,
      [name, email, role, JSON.stringify(perms)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding user:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/v1/users/:id
// Update a user's details or role
router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, email, role, permissions } = req.body;
  if (!name || !email || !role) {
    return res.status(400).json({ error: 'Name, email, and role are required' });
  }

  try {
    const perms = permissions || [];
    const result = await pool.query(
      `UPDATE users SET name = $1, email = $2, role = $3, permissions = $4 WHERE id = $5 
       RETURNING id, name, email, role, permissions, created_at`,
      [name, email, role, JSON.stringify(perms), id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating user:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/v1/users/:id
// Delete a user
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  
  // Prevent self-deletion if possible (assumes req.user has an id, though auth might use google_id)
  if (req.user && req.user.id === id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
