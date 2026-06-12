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
    if (row.value) {
      // Strip JSON-stringified quotes if present (e.g. '"sk-abc"' → 'sk-abc')
      let val = row.value;
      if (typeof val === 'string' && val.startsWith('"') && val.endsWith('"')) {
        try { val = JSON.parse(val); } catch (_) {}
      }
      config[row.key] = val;
    }
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

// GET /api/v1/settings/vapi/credits
// Check our internal VAPI account credit balance
router.get('/vapi/credits', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT value FROM app_settings WHERE key = 'vapi_credit_balance'");
    const balance = rows.length > 0 ? parseFloat(rows[0].value) : 0;

    const config = await getVapiConfig();
    return res.json({
      configured: !!config.vapi_api_key,
      balance: isNaN(balance) ? 0 : balance,
      plan: 'Internal Tracking',
      orgName: 'TTAKOUT',
      lowCredit: balance < 8
    });

  } catch (err) {
    console.error('Error fetching internal VAPI credits:', err);
    res.status(500).json({ error: 'Internal server error while checking VAPI credits' });
  }
});

// POST /api/v1/settings/vapi/credits/refill
// Refill or set the internal credit budget
router.post('/vapi/credits/refill', requireAdmin, async (req, res) => {
  try {
    const { amount, mode } = req.body;
    const value = parseFloat(amount) || 0;

    if (mode === 'add') {
      await pool.query(`
        INSERT INTO app_settings (key, value) 
        VALUES ('vapi_credit_balance', $1::jsonb)
        ON CONFLICT (key) DO UPDATE 
        SET value = to_jsonb(COALESCE((app_settings.value)::text::numeric, 0) + $1)
      `, [value]);
    } else {
      await pool.query(`
        INSERT INTO app_settings (key, value) 
        VALUES ('vapi_credit_balance', $1::jsonb)
        ON CONFLICT (key) DO UPDATE 
        SET value = EXCLUDED.value
      `, [value]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error refilling budget:', err);
    res.status(500).json({ error: `Failed to refill budget: ${err.message}` });
  }
});

// GET /api/v1/settings/vapi/calls
// Get history of vapi calls for a specific date, plus total spend
router.get('/vapi/calls', requireAdmin, async (req, res) => {
  try {
    // date param e.g. "2026-06-11" — defaults to today
    const dateParam = req.query.date;
    const targetDate = dateParam ? new Date(dateParam + 'T00:00:00') : new Date();
    const dateStr = targetDate.toISOString().split('T')[0];

    const { rows: calls } = await pool.query(`
      SELECT call_id, cost, ended_reason, created_at 
      FROM vapi_calls 
      WHERE (created_at AT TIME ZONE 'America/New_York')::date = $1::date
      ORDER BY created_at DESC
    `, [dateStr]);
    
    const { rows: totalRows } = await pool.query(`
      SELECT SUM(cost) as total_spend 
      FROM vapi_calls
    `);

    const { rows: dayTotalRows } = await pool.query(`
      SELECT SUM(cost) as day_spend, COUNT(*) as day_calls
      FROM vapi_calls
      WHERE (created_at AT TIME ZONE 'America/New_York')::date = $1::date
    `, [dateStr]);

    res.json({
      date: dateStr,
      calls,
      totalSpend: parseFloat(totalRows[0]?.total_spend || 0),
      daySpend: parseFloat(dayTotalRows[0]?.day_spend || 0),
      dayCallCount: parseInt(dayTotalRows[0]?.day_calls || 0)
    });
  } catch (err) {
    console.error('Error fetching VAPI calls:', err);
    res.status(500).json({ error: 'Failed to fetch call history' });
  }
});

// GET /api/v1/settings/vapi/calls/daily
// Get daily aggregated call counts and costs for bar charts (last 30 days)
router.get('/vapi/calls/daily', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT 
        (created_at AT TIME ZONE 'America/New_York')::date AS day,
        COUNT(*)::int AS call_count,
        COALESCE(SUM(cost), 0)::float AS total_cost
      FROM vapi_calls
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY (created_at AT TIME ZONE 'America/New_York')::date
      ORDER BY day ASC
    `);
    res.json({ daily: rows });
  } catch (err) {
    console.error('Error fetching daily VAPI stats:', err);
    res.status(500).json({ error: 'Failed to fetch daily stats' });
  }
});

// POST /api/v1/settings/vapi/calls/sync
// Pull call history from VAPI API and import any missing calls into local DB
router.post('/vapi/calls/sync', requireAdmin, async (req, res) => {
  try {
    const config = await getVapiConfig();
    const vapiApiKey = config.vapi_api_key;

    if (!vapiApiKey) {
      return res.status(400).json({ error: 'VAPI API key is not configured.' });
    }

    // Fetch up to 100 most recent calls from VAPI
    const vapiRes = await fetch('https://api.vapi.ai/call?limit=100', {
      headers: { 'Authorization': `Bearer ${vapiApiKey}` }
    });

    if (!vapiRes.ok) {
      const txt = await vapiRes.text();
      return res.status(502).json({ error: `VAPI API error: ${vapiRes.status} — ${txt}` });
    }

    const calls = await vapiRes.json();
    const callList = Array.isArray(calls) ? calls : (calls.results || calls.data || []);

    let imported = 0;
    let skipped = 0;
    let totalNewCost = 0;

    for (const call of callList) {
      const callId = call.id;
      const cost = parseFloat(call.cost || call.costBreakdown?.total || 0);
      const endedReason = call.endedReason || call.ended_reason || 'unknown';
      const createdAt = call.createdAt || call.created_at || call.startedAt || new Date().toISOString();

      if (!callId) continue;

      // Upsert — skip if already tracked
      const result = await pool.query(
        `INSERT INTO vapi_calls (call_id, cost, ended_reason, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (call_id) DO NOTHING
         RETURNING id`,
        [callId, cost, endedReason, createdAt]
      );

      if (result.rows.length > 0) {
        imported++;
        totalNewCost += cost;
      } else {
        skipped++;
      }
    }

    // Deduct newly imported cost from the tracked balance
    if (totalNewCost > 0) {
      await pool.query(`
        UPDATE app_settings 
        SET value = to_jsonb(COALESCE((value)::text::numeric, 0) - $1)
        WHERE key = 'vapi_credit_balance'
      `, [totalNewCost]);
    }

    console.log(`[VAPI SYNC] Imported ${imported} new calls, skipped ${skipped} already tracked. Total new cost: $${totalNewCost.toFixed(4)}`);

    res.json({
      success: true,
      imported,
      skipped,
      totalNewCost: parseFloat(totalNewCost.toFixed(4))
    });

  } catch (err) {
    console.error('Error syncing VAPI calls:', err);
    res.status(500).json({ error: `Sync error: ${err.message}` });
  }
});

// POST /api/v1/settings/vapi/config
// Update just the API key, assistant ID, and menu file
router.post('/vapi/config', requireAdmin, async (req, res) => {
  try {
    const { vapi_api_key, vapi_assistant_id, active_menu_file } = req.body;
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
    res.json({ success: true, message: 'Config updated successfully' });
  } catch (err) {
    console.error('Error updating VAPI config:', err);
    res.status(500).json({ error: 'Internal server error while updating config' });
  }
});

// POST /api/v1/settings/vapi/prompt
// Update Vapi system prompt
router.post('/vapi/prompt', requireAdmin, async (req, res) => {
  try {
    const { systemPrompt, firstMessage } = req.body;

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

    // Create a minimalistic patch payload
    const patchPayload = { model: currentData.model };
    
    // Safely update the system prompt
    if (patchPayload.model?.messages && Array.isArray(patchPayload.model.messages)) {
      const sysIndex = patchPayload.model.messages.findIndex(m => m.role === 'system');
      if (sysIndex !== -1) {
        patchPayload.model.messages[sysIndex].content = systemPrompt;
      } else {
        patchPayload.model.messages.unshift({ role: 'system', content: systemPrompt });
      }
    } else if (patchPayload.model) {
      patchPayload.model.systemPrompt = systemPrompt;
    }

    if (firstMessage !== undefined) {
      patchPayload.firstMessage = firstMessage;
    }

    const response = await fetch(`https://api.vapi.ai/assistant/${vapiAssistantId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${vapiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(patchPayload)
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
