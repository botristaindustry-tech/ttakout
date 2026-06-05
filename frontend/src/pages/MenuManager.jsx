import React, { useState, useEffect } from 'react';
import './MenuManager.css';

export default function MenuManager() {
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Modal State
  const [editItem, setEditItem] = useState(null);
  const [editCategoryIdx, setEditCategoryIdx] = useState(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editCategoryName, setEditCategoryName] = useState('');

  useEffect(() => {
    fetchMenu();
  }, []);

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/menu`, {
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // Ensure categories exist
        if (!data.categories) data.categories = [];
        setMenu(data);
      } else {
        setMessage({ text: 'Failed to load menu data', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network error loading menu', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveMenu = async (updatedMenu) => {
    try {
      setSaving(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/menu`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updatedMenu)
      });
      if (res.ok) {
        setMessage({ text: 'Menu saved successfully!', type: 'success' });
        setTimeout(() => setMessage({ text: '', type: '' }), 3000);
      } else {
        setMessage({ text: 'Failed to save menu.', type: 'error' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ text: 'Network error saving menu.', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = (catIndex, itemIndex) => {
    const updated = { ...menu };
    const item = updated.categories[catIndex].items[itemIndex];
    item.is_available = item.is_available === false ? true : false;
    setMenu(updated);
  };

  const handleDeleteItem = (catIndex, itemIndex) => {
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    const updated = { ...menu };
    updated.categories[catIndex].items.splice(itemIndex, 1);
    setMenu(updated);
  };

  const handleOpenItemModal = (catIndex, item = null) => {
    setEditCategoryIdx(catIndex);
    if (item) {
      setIsNewItem(false);
      setEditItem({ ...item });
    } else {
      setIsNewItem(true);
      setEditItem({
        id: `item_${Date.now()}`,
        name: '',
        price: 0,
        description: '',
        is_available: true,
        modifiers: []
      });
    }
  };

  const handleSaveItem = (e) => {
    e.preventDefault();
    const updated = { ...menu };
    const catItems = updated.categories[editCategoryIdx].items;

    // Convert price to number
    const processedItem = { ...editItem, price: parseFloat(editItem.price) || 0 };

    if (isNewItem) {
      catItems.push(processedItem);
    } else {
      const idx = catItems.findIndex(i => i.id === processedItem.id);
      if (idx !== -1) catItems[idx] = processedItem;
    }

    setMenu(updated);
    setEditItem(null);
  };

  const handleAddCategory = () => {
    const catName = prompt("Enter new category name:");
    if (catName && catName.trim()) {
      const updated = { ...menu };
      updated.categories.push({ name: catName.trim(), items: [] });
      setMenu(updated);
    }
  };

  const handleDeleteCategory = (catIndex) => {
    if (!window.confirm("Are you sure you want to delete this entire category and all its items?")) return;
    const updated = { ...menu };
    updated.categories.splice(catIndex, 1);
    setMenu(updated);
  };

  if (loading) return <div className="menu-manager-page"><p>Loading menu...</p></div>;
  if (!menu) return <div className="menu-manager-page"><p>No menu data found.</p></div>;

  return (
    <div className="menu-manager-page">
      <div className="menu-manager-header">
        <div>
          <h1>Menu Manager</h1>
          <p className="menu-manager-subtitle">Update pricing, add items, and manage out-of-stock items for AI ordering.</p>
        </div>
        <div className="controls-row">
          <button className="btn btn-outline" onClick={handleAddCategory}>+ New Category</button>
          <button className="btn btn-primary" onClick={() => saveMenu(menu)} disabled={saving}>
            {saving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
      </div>

      {message.text && (
        <div className={`message-box ${message.type === 'error' ? 'error-box' : 'success-box'}`} style={{ marginBottom: '2rem' }}>
          {message.text}
        </div>
      )}

      <div className="menu-container">
        {menu.categories.map((category, catIndex) => (
          <div key={catIndex} className="category-section">
            <div className="category-header">
              <h2>{category.name}</h2>
              <div className="category-actions">
                <button className="btn-icon" onClick={() => handleOpenItemModal(catIndex)} title="Add Item">+ Add Item</button>
                <button className="btn-icon" onClick={() => handleDeleteCategory(catIndex)} title="Delete Category" style={{ color: 'var(--status-critical)' }}>🗑️</button>
              </div>
            </div>

            <div className="items-grid">
              {category.items.map((item, itemIndex) => {
                const isOutOfStock = item.is_available === false;
                return (
                  <div key={item.id} className={`menu-item-card ${isOutOfStock ? 'out-of-stock' : ''}`}>
                    <div className="item-header">
                      <h3 className="item-name">{item.name}</h3>
                      <span className="item-price">${Number(item.price).toFixed(2)}</span>
                    </div>
                    <p className="item-desc">{item.description || 'No description'}</p>
                    
                    <div className="item-actions">
                      <label className="availability-toggle">
                        <div className="switch">
                          <input 
                            type="checkbox" 
                            checked={!isOutOfStock} 
                            onChange={() => handleToggleAvailability(catIndex, itemIndex)} 
                          />
                          <span className="slider"></span>
                        </div>
                        {isOutOfStock ? <span style={{ color: 'var(--status-critical)', fontWeight: 600 }}>OUT OF STOCK</span> : 'In Stock'}
                      </label>

                      <div>
                        <button className="btn-icon" onClick={() => handleOpenItemModal(catIndex, item)}>✏️</button>
                        <button className="btn-icon" onClick={() => handleDeleteItem(catIndex, itemIndex)}>🗑️</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {category.items.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No items in this category.</p>}
            </div>
          </div>
        ))}
        {menu.categories.length === 0 && <p>No categories found. Create one to get started.</p>}
      </div>

      {/* Item Edit Modal */}
      {editItem && (
        <div className="modal-overlay" onClick={() => setEditItem(null)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <h2 style={{ marginBottom: '1.5rem' }}>{isNewItem ? 'Add New Item' : 'Edit Item'}</h2>
            <form onSubmit={handleSaveItem}>
              <div className="form-group">
                <label>Item Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  value={editItem.name} 
                  onChange={e => setEditItem({...editItem, name: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  className="form-input" 
                  value={editItem.price} 
                  onChange={e => setEditItem({...editItem, price: e.target.value})} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea 
                  className="form-textarea" 
                  rows="3" 
                  value={editItem.description || ''} 
                  onChange={e => setEditItem({...editItem, description: e.target.value})} 
                />
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                Note: Modifiers cannot currently be edited in this view. They will be preserved.
              </p>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-outline" onClick={() => setEditItem(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Item</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
