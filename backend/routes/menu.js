const express = require('express');
const router = express.Router();
const menuService = require('../services/menuService');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GET /api/v1/menu/files
// Retrieve list of available menu files
router.get('/files', requireAuth, (req, res) => {
  try {
    const files = menuService.getMenuFiles();
    res.json(files);
  } catch (error) {
    console.error('Error fetching menu files:', error);
    res.status(500).json({ error: 'Failed to fetch menu files' });
  }
});

// GET /api/v1/menu
// Retrieve the raw menu.json or specified menu file
router.get('/', requireAuth, (req, res) => {
  try {
    const filename = req.query.file;
    const rawMenu = menuService.getMenuByFile(filename);
    if (!rawMenu) {
      return res.status(500).json({ error: 'Menu data not loaded' });
    }
    res.json(rawMenu);
  } catch (error) {
    console.error('Error fetching menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

// PUT /api/v1/menu
// Overwrite menu.json or specified menu file
router.put('/', requireAuth, (req, res) => {
  try {
    const newMenu = req.body;
    const filename = req.query.file;
    
    // Basic validation
    if (!newMenu || !newMenu.categories || !Array.isArray(newMenu.categories)) {
      return res.status(400).json({ error: 'Invalid menu structure' });
    }

    menuService.saveMenuByFile(filename, newMenu);
    res.json({ message: 'Menu updated successfully', menu: menuService.getMenuByFile(filename) });
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

module.exports = router;
