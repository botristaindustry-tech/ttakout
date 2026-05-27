import React, { useState, useEffect } from 'react';
import './AdminKdsSetup.css';

export default function AdminKdsSetup() {
  const [settings, setSettings] = useState({
    itemFontSize: '1.15rem',
    modFontSize: '0.95rem',
    textColor: '#e2e8f0',
    modColor: '#94a3b8',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.kds_styles) {
          setSettings(data.kds_styles);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching settings:', err);
        setLoading(false);
      });
  }, []);

  const handleChange = (e) => {
    let { name, value } = e.target;
    // Strip spaces from font sizes to ensure valid CSS
    if (name === 'itemFontSize' || name === 'modFontSize') {
      value = value.replace(/\s+/g, '');
    }
    setSettings(prev => ({ ...prev, [name]: value }));
    setSaveMsg('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5005'}/api/v1/settings/kds_styles`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ value: settings })
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveMsg('Settings saved! KDS view will update automatically.');
    } catch (err) {
      setSaveMsg('Error: ' + err.message);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="kds-setup-loading">Loading KDS settings...</div>;
  }

  return (
    <div className="kds-setup-page">
      <h1>KDS Setup</h1>
      <p className="kds-setup-subtitle">
        Configure how items and modifiers appear on the Kitchen Display System. Changes apply instantly across all KDS screens.
      </p>

      <div className="kds-setup-grid">
        {/* Left: Settings Form */}
        <div className="kds-setup-card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            Typography Settings
          </h2>

          <div className="kds-field">
            <label className="kds-field-label">Item Font Size</label>
            <input
              type="text"
              name="itemFontSize"
              value={settings.itemFontSize}
              onChange={handleChange}
              className="kds-field-input"
              placeholder="e.g. 1.25rem, 18px"
            />
          </div>

          <div className="kds-field">
            <label className="kds-field-label">Item Text Color</label>
            <div className="kds-color-row">
              <div className="kds-color-swatch" style={{ backgroundColor: settings.textColor }}>
                <input
                  type="color"
                  name="textColor"
                  value={settings.textColor}
                  onChange={handleChange}
                />
              </div>
              <input
                type="text"
                name="textColor"
                value={settings.textColor}
                onChange={handleChange}
                className="kds-field-input"
                placeholder="#e2e8f0"
              />
            </div>
          </div>

          <div className="kds-field">
            <label className="kds-field-label">Modifier Font Size</label>
            <input
              type="text"
              name="modFontSize"
              value={settings.modFontSize}
              onChange={handleChange}
              className="kds-field-input"
              placeholder="e.g. 0.95rem, 14px"
            />
          </div>

          <div className="kds-field">
            <label className="kds-field-label">Modifier Text Color</label>
            <div className="kds-color-row">
              <div className="kds-color-swatch" style={{ backgroundColor: settings.modColor }}>
                <input
                  type="color"
                  name="modColor"
                  value={settings.modColor}
                  onChange={handleChange}
                />
              </div>
              <input
                type="text"
                name="modColor"
                value={settings.modColor}
                onChange={handleChange}
                className="kds-field-input"
                placeholder="#94a3b8"
              />
            </div>
          </div>

          <div className="kds-save-bar">
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
            {saveMsg && <span className="kds-save-msg">{saveMsg}</span>}
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="kds-setup-card kds-preview-card">
          <h2>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Live Preview
          </h2>

          <div className="kds-preview-label">How items will look on the KDS</div>

          <div className="kds-preview-mock">
            <div className="kds-preview-header">Order #1024 — Kitchen Queue</div>

            <div className="kds-preview-line">
              <div className="kds-preview-qty">2</div>
              <div className="kds-preview-details">
                <span style={{ fontSize: settings.itemFontSize, color: settings.textColor }}>
                  Chicken over Rice
                </span>
                <span style={{ fontSize: settings.modFontSize, color: settings.modColor }}>
                  + Extra White Sauce
                </span>
              </div>
            </div>

            <div className="kds-preview-line">
              <div className="kds-preview-qty">1</div>
              <div className="kds-preview-details">
                <span style={{ fontSize: settings.itemFontSize, color: settings.textColor }}>
                  Lamb over Rice
                </span>
                <span style={{ fontSize: settings.modFontSize, color: settings.modColor }}>
                  + No Onions, Extra Hot Sauce
                </span>
              </div>
            </div>

            <div className="kds-preview-line">
              <div className="kds-preview-qty">1</div>
              <div className="kds-preview-details">
                <span style={{ fontSize: settings.itemFontSize, color: settings.textColor }}>
                  6 Pcs. Falafel over Rice
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
