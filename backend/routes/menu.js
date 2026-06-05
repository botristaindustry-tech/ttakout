const express = require('express');
const router = express.Router();
const menuService = require('../services/menuService');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// GET /api/v1/menu
// Retrieve the raw menu.json
router.get('/', requireAuth, (req, res) => {
  try {
    const rawMenu = menuService.getRawMenu();
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
// Overwrite menu.json
router.put('/', requireAuth, (req, res) => {
  try {
    const newMenu = req.body;
    
    // Basic validation
    if (!newMenu || !newMenu.categories || !Array.isArray(newMenu.categories)) {
      return res.status(400).json({ error: 'Invalid menu structure' });
    }

    menuService.saveRawMenu(newMenu);
    res.json({ message: 'Menu updated successfully', menu: menuService.getRawMenu() });
  } catch (error) {
    console.error('Error updating menu:', error);
    res.status(500).json({ error: 'Failed to update menu' });
  }
});

module.exports = router;
