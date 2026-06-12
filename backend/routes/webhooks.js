const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

// Middleware to verify admin permission
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.permissions || !req.user.permissions.includes('manage_kds')) {
    return res.status(403).json({ error: 'Access denied: Admin only' });
  }
  next();
};

// We now use menuService to provide live menu data and searching
const menuService = require('../services/menuService');

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

      // Handle inbound call gating (assistant-request)
      if (msg?.type === "assistant-request") {
        const caller = msg?.call?.customer?.number;
        const calledNumber = msg?.phoneNumber?.number;

        if (!caller) {
          return res.status(200).json({ error: "Unable to verify caller ID. Goodbye." });
        }

        const configQuery = await db.query("SELECT value FROM app_settings WHERE key = 'vapi_assistant_id'");
        let assistantId = process.env.VAPI_ASSISTANT_ID;
        if (configQuery.rows.length > 0 && configQuery.rows[0].value) {
          assistantId = typeof configQuery.rows[0].value === 'string' && configQuery.rows[0].value.startsWith('"')
            ? JSON.parse(configQuery.rows[0].value)
            : configQuery.rows[0].value;
        }
        
        if (!assistantId) {
          console.error("[VAPI] VAPI_ASSISTANT_ID is not configured in the environment or settings.");
          return res.status(500).json({ error: "Configuration missing" });
        }

        try {
          // Check if caller is in flagged list using our robust matching logic
          const flaggedCheck = await db.query(`
            SELECT 1 FROM flagged_phones 
            WHERE LENGTH(regexp_replace($1, '[^0-9]', '', 'g')) >= 7
              AND RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = RIGHT(regexp_replace($1, '[^0-9]', '', 'g'), 10)
          `, [caller]);

          if (flaggedCheck.rows.length > 0) {
            console.log(`[VAPI] BLOCKED inbound call from flagged number: ${caller}`);
            return res.status(200).json({
              error: "We are unable to accept your call at this time. Goodbye."
            });
          }

          console.log(`[VAPI] ALLOWED inbound call from: ${caller}`);
          return res.status(200).json({ assistantId });
        } catch (error) {
          console.error('[VAPI] Error querying flagged_phones during assistant-request:', error);
          // If DB fails, fallback to allowing the call so business continues
          return res.status(200).json({ assistantId });
        }
      }

      // Handle end-of-call billing tracking
      if (msg?.type === 'end-of-call-report') {
        const callId = msg.call?.id || body?.call?.id;
        const cost = msg.call?.cost || body?.call?.cost || 0;
        const endedReason = msg.endedReason || body?.endedReason || 'unknown';

        if (callId) {
          try {
            // Log the call cost
            await db.query(
              `INSERT INTO vapi_calls (call_id, cost, ended_reason) VALUES ($1, $2, $3) ON CONFLICT (call_id) DO NOTHING`,
              [callId, cost, endedReason]
            );

            // Decrement the credit balance safely in app_settings
            await db.query(`
              UPDATE app_settings 
              SET value = (COALESCE(value::numeric, 0) - $1)::text 
              WHERE key = 'vapi_credit_balance'
            `, [cost]);

            console.log(`[VAPI BILLING] Call ${callId} ended. Deducted $${cost} from credit balance.`);
          } catch (err) {
            console.error('[VAPI BILLING] Error updating billing for call:', err);
          }
        }
        return res.status(200).json({ status: 'Recorded call cost' });
      }

      if (msg?.type !== 'tool-calls' || !Array.isArray(msg.toolCallList)) {
        console.warn('Received non-tool-call webhook:', body);
        return res.status(202).json({ status: 'Accepted (ignored non-tool-call)' });
      }

      const results = [];

      for (const toolCall of msg.toolCallList) {
        const toolCallId = toolCall.id;
        const toolName = toolCall?.function?.name;
        const rawArgs = toolCall?.function?.arguments;

        console.log(`[VAPI] Processing tool call: ${toolName} (ID: ${toolCallId})`);

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
          let cleanQuery = query
            .toLowerCase()
            .replace(/\b(piece|pieces|pcs\.?|order of|some|a|an|the)\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
            
          // Map common beverage terms to their exact menu categories to help fuzzy search
          if (/(snapple|gatorade)/i.test(cleanQuery) || (/(bottle)/i.test(cleanQuery) && !/(water)/i.test(cleanQuery))) {
            cleanQuery = "Bottled Soda Gatorade Snapple";
          } else if (/(can|canned|water|coke|sprite|pepsi|fanta|ginger ale|seltzer)/i.test(cleanQuery)) {
            cleanQuery = "Canned Soda Bottled Water";
          }
            
          console.log(`[VAPI] Original query: "${query}" | Cleaned query: "${cleanQuery}"`);
          const searchResults = menuService.search(cleanQuery);
          
          if (searchResults.length > 0) {
            // Return top 3 matches and strip out huge modifier lists to save tokens
            const items = searchResults.slice(0, 3).map(r => ({
              id: r.item.id,
              name: r.item.name,
              price: r.item.price,
              description: r.item.description || "",
              category: r.item.category,
              isAvailable: r.item.is_available !== false
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
        const toolNameLower = toolName ? toolName.toLowerCase() : '';
        if (toolName === 'submitOrder' || toolName === 'submit_order' || toolNameLower.includes('submit') || (toolNameLower.includes('order') && toolName !== 'lookup_menu_item')) {
          let { restaurant, customer, order, notes, pickupEtaMinutes, lines } = args;
          const callId = body?.call?.id || msg?.call?.id || body?.message?.call?.id || args.callId || `chat_test_${Date.now()}`;

          // Support flat format by constructing the 'order' object dynamically
          if (!order && lines && Array.isArray(lines)) {
             
             // Pre-validation: Check for OUT OF STOCK items
             let outOfStockItems = [];
             const menuData = menuService.getFlatMenu();
             for (const line of lines) {
               const foundItem = menuData.find(m => m.id === line.itemId);
               if (foundItem && foundItem.is_available === false) {
                 outOfStockItems.push(foundItem.name || line.itemId);
               }
             }

             if (outOfStockItems.length > 0) {
               console.warn(`[VAPI] AI attempted to order out-of-stock items: ${outOfStockItems.join(', ')}`);
               results.push({ 
                 toolCallId, 
                 result: { 
                   ok: false, 
                   error: `Order failed. The following items are currently OUT OF STOCK today and cannot be ordered: ${outOfStockItems.join(', ')}. Please apologize to the customer, inform them we are out of these items, and ask if they would like to order something else instead.` 
                 } 
               });
               continue;
             }

             let subtotal = 0;
             const mappedLines = lines.map((line, index) => {
               // Look up the actual price from our server-side menuData
               const menuData = menuService.getFlatMenu();
               const foundItem = menuData.find(m => m.id === line.itemId);
               let price = foundItem ? foundItem.price : 0;
               const name = foundItem ? foundItem.name : line.itemId;
               const qty = line.quantity || 1;
               
               let parsedModifiers = [];
               const combinedNotes = [line.modifiersText, line.specialInstructions].filter(Boolean).join(" | ");

               if (combinedNotes && foundItem && foundItem.modifiers) {
                 foundItem.modifiers.forEach(mod => {
                   const isComboMod = mod.name.toLowerCase().includes("combo");
                   const notesLower = combinedNotes.toLowerCase();
                   
                   // Handle generic "Combo" mentions mapping to the "Yes" option
                   const isNoCombo = notesLower.includes("no combo") || notesLower.includes("without combo");
                   const isYesCombo = notesLower.includes("combo") || notesLower.includes("yes");
                    if (isComboMod && !isNoCombo && isYesCombo) {
                      const comboOption = mod.options[0];
                      if (comboOption) {
                        price += comboOption.price;
                        if (comboOption.price > 0) {
                          parsedModifiers.push({ name: mod.name, option: comboOption.name, price: comboOption.price });
                        }
                      }
                    } else {
                      // Check if any specific option name was mentioned in the notes (can be 0 price or greater)
                      mod.options.forEach(opt => {
                        const optNameLower = opt.name.toLowerCase();
                        if (optNameLower !== "yes" && optNameLower !== "no") {
                          let matches = notesLower.includes(optNameLower);
                          
                          // Prevent double-matching "Strawberry" when "Strawberry Cheese Cake" is intended
                          if (matches && (opt.id === 'opt_ic_strawberry' || opt.id === 'opt_shake_strawberry')) {
                            if (notesLower.includes('strawberry cheese') || notesLower.includes('strawberry cheesecake')) {
                              matches = false;
                            }
                          }
                          
                          // Handle special aliases/variations for sauces, toppings, rice options, and ice cream flavors
                          if (!matches) {
                            if (opt.id === 'opt_sauce_white') {
                              matches = notesLower.includes('white sauce') || notesLower.includes('white');
                            } else if (opt.id === 'opt_sauce_red') {
                              matches = notesLower.includes('red sauce') || notesLower.includes('red saurce') || notesLower.includes('red');
                            } else if (opt.id === 'opt_sauce_bbq') {
                              matches = notesLower.includes('barbie q') || 
                                        notesLower.includes('bbq') || 
                                        notesLower.includes('barbecue') || 
                                        notesLower.includes('barbeque');
                            } else if (opt.id === 'opt_top_reeses') {
                              matches = notesLower.includes('reeses') || notesLower.includes("reese's") || notesLower.includes('reese');
                            } else if (opt.id === 'opt_top_onions') {
                              matches = notesLower.includes('onion');
                            } else if (opt.id === 'opt_top_olives') {
                              matches = notesLower.includes('olive');
                            } else if (opt.id === 'opt_top_corns') {
                              matches = notesLower.includes('corn');
                            } else if (opt.id === 'opt_rice_seasoned') {
                              matches = notesLower.includes('seasoned rice') || notesLower.includes('seasoned riced') || notesLower.includes('seasoned');
                            } else if (opt.id === 'opt_rice_regular') {
                              matches = notesLower.includes('regular rice') || notesLower.includes('regular');
                            } else if (opt.id === 'opt_ic_cookies' || opt.id === 'opt_shake_cookies_cream') {
                              matches = notesLower.includes('cookies n cream') || 
                                        notesLower.includes('cookie n cream') || 
                                        notesLower.includes('cookies and cream') || 
                                        notesLower.includes('cookie and cream');
                            } else if (opt.id === 'opt_ic_butter_pecan') {
                              matches = notesLower.includes('butter pecan') || notesLower.includes('butter peacon');
                            } else if (opt.id === 'opt_ic_strawberry_cheese') {
                              matches = notesLower.includes('strawberry cheese cake') || notesLower.includes('strawberry cheesecake');
                            }
                          }

                          if (matches) {
                            price += opt.price;
                            // Only push to parsedModifiers if there's an upcharge. 
                            // $0 items (like bagel flavors or no-onions) will just be covered by the combinedNotes text.
                            if (opt.price > 0) {
                              parsedModifiers.push({ name: mod.name, option: opt.name, price: opt.price });
                            }
                          }
                        }
                      });
                    }
                 });
               }

               if (combinedNotes) {
                 parsedModifiers.push({ name: "Notes", option: combinedNotes, price: 0 });
               }

               const lineSubtotal = price * qty;
               subtotal += lineSubtotal;
               
               return {
                 lineId: `line_${index+1}`,
                 itemId: line.itemId,
                 name: name,
                 quantity: qty,
                 lineSubtotal: lineSubtotal,
                 modifiers: parsedModifiers
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

              // Check if phone number is flagged using digits normalization (comparing last 10 digits)
              const flaggedCheckBefore = await db.query(`
                SELECT 1 FROM flagged_phones 
                WHERE LENGTH(regexp_replace($1, '[^0-9]', '', 'g')) >= 7
                  AND RIGHT(regexp_replace(phone_number, '[^0-9]', '', 'g'), 10) = RIGHT(regexp_replace($1, '[^0-9]', '', 'g'), 10)
              `, [customer?.phone || 'Unknown']);
              const isCallerFlagged = flaggedCheckBefore.rows.length > 0;
              const initialStatus = isCallerFlagged ? 'FLAGGED' : 'PENDING';

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
                initialStatus
              ];

              const { rows } = await db.query(insertOrderQuery, orderValues);
              const newOrder = rows[0];
              newOrder.is_flagged = isCallerFlagged;
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
        console.warn(`[VAPI] Unknown tool encountered: "${toolName}"`);
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
  router.get('/vapi/logs', requireAdmin, async (req, res) => {
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
