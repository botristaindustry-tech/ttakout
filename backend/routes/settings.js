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

// GET /api/v1/settings/vapi/prompt
// Fetch current Vapi system prompt
router.get('/vapi/prompt', requireAdmin, async (req, res) => {
  try {
    const vapiApiKey = process.env.VAPI_API_KEY;
    const vapiAssistantId = process.env.VAPI_ASSISTANT_ID;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.json({ configured: false });
    }

    const response = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Vapi GET Error:', response.status, errText);
      return res.status(response.status).json({ error: `VAPI Error: ${response.statusText}` });
    }

    const data = await response.json();
    const systemPrompt = data.model?.systemPrompt || '';
    
    res.json({
      configured: true,
      name: data.name,
      systemPrompt: systemPrompt
    });
  } catch (err) {
    console.error('Error fetching VAPI prompt:', err);
    res.status(500).json({ error: 'Internal server error while fetching VAPI prompt' });
  }
});

// POST /api/v1/settings/vapi/prompt
// Update Vapi system prompt
router.post('/vapi/prompt', requireAdmin, async (req, res) => {
  try {
    const { systemPrompt } = req.body;
    
    const vapiApiKey = process.env.VAPI_API_KEY;
    const vapiAssistantId = process.env.VAPI_ASSISTANT_ID;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.status(400).json({ error: 'VAPI API Key and Assistant ID must be configured in environment variables' });
    }

    const response = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: {
          systemPrompt: systemPrompt
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Vapi PATCH Error:', response.status, errText);
      return res.status(response.status).json({ error: `VAPI Error: ${response.statusText}` });
    }

    res.json({ success: true, message: 'Prompt updated successfully on VAPI' });
  } catch (err) {
    console.error('Error updating VAPI prompt:', err);
    res.status(500).json({ error: 'Internal server error while updating VAPI prompt' });
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
