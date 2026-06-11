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

const menuService = require('../services/menuService');

async function getVapiConfig() {
  const result = await pool.query('SELECT key, value FROM app_settings WHERE key IN ($1, $2, $3)', ['vapi_api_key', 'vapi_assistant_id', 'active_menu_file']);
  const config = {
    vapi_api_key: process.env.VAPI_API_KEY,
    vapi_assistant_id: process.env.VAPI_ASSISTANT_ID,
    active_menu_file: 'menu.json'
  };
  result.rows.forEach(row => {
    if (row.value) config[row.key] = row.value;
  });
  return config;
}

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
// Fetch current Vapi system prompt and config
router.get('/vapi/prompt', requireAdmin, async (req, res) => {
  try {
    const config = await getVapiConfig();
    const vapiApiKey = config.vapi_api_key;
    const vapiAssistantId = config.vapi_assistant_id;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.json({ configured: false, active_menu_file: config.active_menu_file });
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
    let systemPrompt = '';
    
    if (data.model?.systemPrompt) {
      systemPrompt = data.model.systemPrompt;
    } else if (data.model?.messages && Array.isArray(data.model.messages)) {
      const sysMsg = data.model.messages.find(m => m.role === 'system');
      if (sysMsg) systemPrompt = sysMsg.content;
    }
    
    res.json({
      configured: true,
      name: data.name,
      firstMessage: data.firstMessage || '',
      systemPrompt: systemPrompt,
      vapi_api_key: vapiApiKey,
      vapi_assistant_id: vapiAssistantId,
      active_menu_file: config.active_menu_file
    });
  } catch (err) {
    console.error('Error fetching VAPI prompt:', err);
    res.status(500).json({ error: 'Internal server error while fetching VAPI prompt' });
  }
});

// POST /api/v1/settings/vapi/prompt
// Update Vapi system prompt and save config to DB
router.post('/vapi/prompt', requireAdmin, async (req, res) => {
  try {
    const { systemPrompt, firstMessage, vapi_api_key, vapi_assistant_id, active_menu_file } = req.body;
    
    // Save settings to DB
    if (vapi_api_key) {
      await pool.query(`INSERT INTO app_settings (key, value) VALUES ('vapi_api_key', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(vapi_api_key)]);
    }
    if (vapi_assistant_id) {
      await pool.query(`INSERT INTO app_settings (key, value) VALUES ('vapi_assistant_id', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(vapi_assistant_id)]);
    }
    if (active_menu_file) {
      await pool.query(`INSERT INTO app_settings (key, value) VALUES ('active_menu_file', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, [JSON.stringify(active_menu_file)]);
      menuService.setActiveMenuFile(active_menu_file);
    }

    const config = await getVapiConfig();
    const vapiApiKey = config.vapi_api_key;
    const vapiAssistantId = config.vapi_assistant_id;

    if (!vapiApiKey || !vapiAssistantId) {
      return res.status(400).json({ error: 'VAPI API Key and Assistant ID must be configured in environment variables or settings' });
    }

    // First, fetch the current assistant to ensure we don't overwrite the whole model config
    const getResponse = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${vapiApiKey}` }
    });

    if (!getResponse.ok) {
      return res.status(getResponse.status).json({ error: 'Failed to fetch current VAPI configuration.' });
    }

    const currentData = await getResponse.json();

    // Safely update the system prompt
    if (currentData.model?.messages && Array.isArray(currentData.model.messages)) {
      const sysIndex = currentData.model.messages.findIndex(m => m.role === 'system');
      if (sysIndex !== -1) {
        currentData.model.messages[sysIndex].content = systemPrompt;
      } else {
        currentData.model.messages.unshift({ role: 'system', content: systemPrompt });
      }
    } else if (currentData.model) {
      currentData.model.systemPrompt = systemPrompt;
    }

    if (firstMessage !== undefined) {
      currentData.firstMessage = firstMessage;
    }

    // Remove read-only fields before sending back the full assistant object
    delete currentData.id;
    delete currentData.orgId;
    delete currentData.createdAt;
    delete currentData.updatedAt;

    const response = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(currentData)
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
