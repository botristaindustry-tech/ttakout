const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

class MenuService {
  constructor() {
    this.activeMenuFile = 'menu.json';
    this.menuDataPath = path.join(__dirname, '../data', this.activeMenuFile);
    this.menuData = [];
    this.fuse = null;
    this.rawMenu = null;
    this.loadMenu();
  }

  setActiveMenuFile(filename) {
    if (!filename) return;
    this.activeMenuFile = filename;
    this.menuDataPath = path.join(__dirname, '../data', this.activeMenuFile);
    this.loadMenu();
  }

  loadMenu() {
    try {
      if (!fs.existsSync(this.menuDataPath)) {
        // If it doesn't exist, start with an empty menu
        this.rawMenu = { categories: [] };
      } else {
        this.rawMenu = JSON.parse(fs.readFileSync(this.menuDataPath, 'utf-8'));
      }
      this.menuData = [];
      
      // If the menu has categories, flatten them into a single array of items for searching
      if (this.rawMenu.categories && Array.isArray(this.rawMenu.categories)) {
        this.rawMenu.categories.forEach(category => {
          if (category.items && Array.isArray(category.items)) {
            category.items.forEach(item => {
              // Add the category name to the item so it can be searched
              item.category = category.name;
              this.menuData.push(item);
            });
          }
        });
      }

      this.fuse = new Fuse(this.menuData, {
        keys: ['name', 'description', 'category'],
        threshold: 0.6,
        ignoreLocation: true,
        includeScore: true
      });
      console.log('[MenuService] Successfully loaded and indexed menu.json');
    } catch (e) {
      console.error("[MenuService] Could not load menu.json", e);
    }
  }

  getRawMenu() {
    return this.rawMenu;
  }

  saveRawMenu(newMenu) {
    fs.writeFileSync(this.menuDataPath, JSON.stringify(newMenu, null, 2), 'utf-8');
    this.loadMenu(); // Refresh in-memory structures and search index
  }

  getMenuFiles() {
    const dataDir = path.join(__dirname, '../data');
    if (!fs.existsSync(dataDir)) return [];
    return fs.readdirSync(dataDir).filter(f => f.endsWith('.json'));
  }

  getMenuByFile(filename) {
    if (!filename) return this.rawMenu;
    const filePath = path.join(__dirname, '../data', path.basename(filename));
    if (!fs.existsSync(filePath)) {
      return { categories: [] };
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  saveMenuByFile(filename, newMenu) {
    if (!filename) {
      this.saveRawMenu(newMenu);
      return;
    }
    const filePath = path.join(__dirname, '../data', path.basename(filename));
    fs.writeFileSync(filePath, JSON.stringify(newMenu, null, 2), 'utf-8');
    if (filename === 'menu.json') {
      this.loadMenu(); // Refresh if active menu is updated
    }
  }
  
  search(query) {
    if (!this.fuse) return [];
    return this.fuse.search(query);
  }

  getFlatMenu() {
    return this.menuData;
  }
}

module.exports = new MenuService();
