const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

// Load menu data for search
const menuDataPath = path.join(__dirname, '../data/menu.json');
let menuData = [];
try {
  const rawData = JSON.parse(fs.readFileSync(menuDataPath, 'utf-8'));
  // If the menu has categories, flatten them into a single array of items
  if (rawData.categories && Array.isArray(rawData.categories)) {
    rawData.categories.forEach(category => {
      if (category.items && Array.isArray(category.items)) {
        category.items.forEach(item => {
          // Add the category name to the item so it can be searched too!
          item.category = category.name;
          menuData.push(item);
        });
      }
    });
  } else if (Array.isArray(rawData)) {
    // Fallback if it's already a flat array
    menuData = rawData;
  }
} catch (e) {
  console.error("Could not load menu.json for lookup tool:", e);
}

// Setup Fuse.js for fuzzy searching the menu
const fuse = new Fuse(menuData, {
  keys: ['name', 'description', 'category'],
  threshold: 0.6, // Loosened threshold (default is 0.6) for better matching of "piece" to "Pcs."
  ignoreLocation: true, // Allows matching substring anywhere
  includeScore: true
});

module.exports = (io) => {

  // VAPI Webhook Endpoint
  router.post('/vapi/orders', async (req, res) => {
    try {
      // 1. Authentication
      const auth = req.headers.authorization || req.headers['x-vapi-secret'] || '';
      const secret = process.env.VAPI_WEBHOOK_SECRET;
      
      if (secret) {
        const token = auth.replace('Bearer ', '').trim();
        if (token !== secret) {
          console.error('Unauthorized webhook payload received.');
          return res.status(401).json({ error: 'Unauthorized' });
        }
      }

      const body = req.body;
      
      // LOG INBOUND PAYLOAD
      console.log('\n=============================================');
      console.log(`[VAPI INBOUND] Received webhook request:`);
      console.log(JSON.stringify(body, null, 2));
      console.log('=============================================\n');

      const msg = body?.message;

      if (msg?.type !== 'tool-calls' || !Array.isArray(msg.toolCallList)) {
        console.warn('Received non-tool-call webhook:', body);
        return res.status(202).json({ status: 'Accepted (ignored non-tool-call)' });
      }

      const results = [];

      for (const toolCall of msg.toolCallList) {
        const toolCallId = toolCall.id;
        const toolName = toolCall?.function?.name;
        const rawArgs = toolCall?.function?.arguments;

        let args;
        try {
          args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs || {});
        } catch (e) {
          results.push({ toolCallId, result: { ok: false, error: 'Invalid JSON arguments' } });
          continue;
        }

        // TOOL: lookup_menu_item
        if (toolName === 'lookup_menu_item') {
          const query = args.query;
          console.log(`[VAPI] Received menu lookup query: "${query}"`);

          if (!query) {
            console.log(`[VAPI] Empty query, returning not-found.`);
            results.push({ toolCallId, result: { status: 'not-found', items: [] } });
            continue;
          }

          // Clean up the query to remove words that confuse the fuzzy search
          const cleanQuery = query
            .toLowerCase()
            .replace(/\b(piece|pieces|pcs\.?|order of|some|a|an|the)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          console.log(`[VAPI] Original query: "${query}" | Cleaned query: "${cleanQuery}"`);
          const searchResults = fuse.search(cleanQuery);
          
          if (searchResults.length > 0) {
            // Return top 3 matches and strip out huge modifier lists to save tokens
            const items = searchResults.slice(0, 3).map(r => ({
              id: r.item.id,
              name: r.item.name,
              price: r.item.price,
              description: r.item.description || undefined
            }));
            
            console.log(`[VAPI] Found ${items.length} matches for "${query}":`, items.map(i => i.name));
            
            results.push({
              toolCallId,
              result: {
                status: 'found',
                items: items
              }
            });
          } else {
            console.log(`[VAPI] No matches found for "${query}".`);
            results.push({
              toolCallId,
              result: {
                status: 'not-found',
                items: []
              }
            });
          }
          continue;
        }

        // TOOL: submit_order
        if (toolName === 'submitOrder' || toolName === 'submit_order') {
          let { restaurant, customer, order, notes, pickupEtaMinutes, lines } = args;
          const callId = body?.call?.id || msg?.call?.id || body?.message?.call?.id || args.callId || `chat_test_${Date.now()}`;

          // Support flat format by constructing the 'order' object dynamically
          if (!order && lines && Array.isArray(lines)) {
             let subtotal = 0;
             const mappedLines = lines.map((line, index) => {
               // Look up the actual price from our server-side menuData
               const foundItem = menuData.find(m => m.id === line.itemId);
               const price = foundItem ? foundItem.price : 0;
               const name = foundItem ? foundItem.name : line.itemId;
               const qty = line.quantity || 1;
               const lineSubtotal = price * qty;
               subtotal += lineSubtotal;
               
               return {
                 lineId: `line_${index+1}`,
                 itemId: line.itemId,
                 name: name,
                 quantity: qty,
                 lineSubtotal: lineSubtotal,
                 // Convert flat modifiersText string to the array structure the KDS expects
                 modifiers: line.modifiersText ? [{ name: "Notes", option: line.modifiersText, price: 0 }] : []
               };
             });
             
             const taxRate = 0.08875;
             const tax = subtotal * taxRate;
             const total = subtotal + tax;
             
             order = {
               subtotal,
               taxRate,
               tax,
               total,
               pickupEtaMinutes: pickupEtaMinutes || 20,
               lines: mappedLines
             };
          }

          // Server-side validation
          if (!restaurant || !customer || !order || !order.lines || order.lines.length === 0) {
            console.error('[VAPI] AI submitted an empty or invalid order payload:', args);
            results.push({ 
              toolCallId, 
              result: { 
                ok: false, 
                error: "submit_order requires restaurant, customer, and line items. Your payload was missing required fields. Please format correctly and try again." 
              } 
            });
            continue;
          }

          // Respond immediately with the proper shape
          results.push({ toolCallId, result: { ok: true, received: true, callId } });

          // Do async processing AFTER responding so Vapi doesn't timeout
          setImmediate(async () => {
            try {
              if (!order || !callId) {
                 console.error('Invalid payload structure: missing order or callId');
                 return;
              }

              // Persist Order to DB
              const insertOrderQuery = `
                INSERT INTO orders (vapi_call_id, restaurant_name, customer_name, customer_phone, subtotal, tax_rate, tax, total, pickup_eta_minutes, notes, status, daily_order_code)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, (
                  SELECT COALESCE(MAX(daily_order_code), 0) + 1 FROM orders WHERE created_at::date = CURRENT_DATE
                ))
                RETURNING *;
              `;
              const orderValues = [
                callId,
                restaurant || 'Unknown',
                customer?.name || 'Unknown',
                customer?.phone || 'Unknown',
                order.subtotal || 0,
                order.taxRate || 0,
                order.tax || 0,
                order.total || 0,
                order.pickupEtaMinutes || 0,
                notes || '',
                'PENDING'
              ];

              const { rows } = await db.query(insertOrderQuery, orderValues);
              const newOrder = rows[0];
              newOrder.lines = [];

              // Insert Order Lines and Modifiers
              if (order.lines && Array.isArray(order.lines)) {
                for (const line of order.lines) {
                  const insertLineQuery = `
                    INSERT INTO order_lines (order_id, line_id, item_id, name, quantity, line_subtotal)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *;
                  `;
                  const lineValues = [
                    newOrder.id, 
                    line.lineId || `line-${Date.now()}-${Math.random()}`, 
                    line.itemId || 'unknown', 
                    line.name, 
                    line.quantity, 
                    line.lineSubtotal || 0
                  ];
                  const lineRes = await db.query(insertLineQuery, lineValues);
                  const newLine = lineRes.rows[0];
                  newLine.modifiers = [];

                  if (line.modifiers && Array.isArray(line.modifiers)) {
                    for (const mod of line.modifiers) {
                      const insertModQuery = `
                        INSERT INTO order_modifiers (order_line_id, name, option_name, price)
                        VALUES ($1, $2, $3, $4)
                        RETURNING *;
                      `;
                      const modRes = await db.query(insertModQuery, [
                        newLine.id, 
                        mod.name, 
                        mod.option || mod.option_name, 
                        mod.price || 0
                      ]);
                      newLine.modifiers.push(modRes.rows[0]);
                    }
                  }
                  newOrder.lines.push(newLine);
                }
              }

              // Emit Socket Event for Real-Time Sync
              io.emit('new_order', newOrder);
              console.log('Successfully processed Vapi order:', callId);
              
            } catch (err) {
              console.error('Async order processing failed:', err);
            }
          });
          continue;
        }

        // UNKNOWN TOOL
        results.push({ toolCallId, result: { skipped: true, reason: 'Unknown tool' } });
      }

      console.log(`[VAPI] Sending webhook response:`, JSON.stringify({ results }, null, 2));

      // Asynchronously store the entire interaction in the database for debugging
      const interactionCallId = body?.call?.id || msg?.call?.id || body?.message?.call?.id || null;
      setImmediate(() => {
        db.query(
          `INSERT INTO webhook_logs (call_id, inbound_payload, outbound_payload) VALUES ($1, $2, $3)`,
          [interactionCallId, JSON.stringify(body), JSON.stringify({ results })]
        ).catch(err => console.error("Failed to save webhook log to DB:", err));
      });

      return res.status(200).json({ results });
      
    } catch (error) {
      console.error('Error processing VAPI webhook payload:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  // Get Webhook Logs for Admin Dashboard
  router.get('/vapi/logs', async (req, res) => {
    try {
      const query = `
        SELECT id, call_id, inbound_payload, outbound_payload, created_at
        FROM webhook_logs
        ORDER BY created_at DESC
        LIMIT 50;
      `;
      const { rows } = await db.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Failed to fetch webhook logs:', error);
      res.status(500).json({ error: 'Failed to fetch logs' });
    }
  });

  return router;
};
