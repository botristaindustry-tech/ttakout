const express = require('express');
const router = express.Router();
const db = require('../db');

module.exports = (io) => {

  // VAPI Webhook Endpoint
  router.post('/vapi/orders', async (req, res) => {
    // 1. Immediately return 202 Accepted to respect SLA Handshake Constraint
    res.status(202).json({ status: 'Accepted' });

    // 2. Security validation (mock secret token validation for now)
    const providedSecret = req.headers['x-vapi-secret'] || req.headers['authorization'];
    if (providedSecret !== process.env.VAPI_WEBHOOK_SECRET) {
      console.error('Unauthorized webhook payload received.');
      return; // Stop processing
    }

    try {
      const payload = req.body;
      const {
        restaurant,
        customer,
        order,
        callId,
        notes
      } = payload;

      // Ensure mandatory fields exist
      if (!order || !callId) {
         console.error('Invalid payload structure: missing order or callId');
         return;
      }

      // 3 & 4. Persist Order to DB and calculate daily_order_code atomically
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

      // 5. Insert Order Lines and Modifiers
      if (order.lines && Array.isArray(order.lines)) {
        for (const line of order.lines) {
          const insertLineQuery = `
            INSERT INTO order_lines (order_id, line_id, item_id, name, quantity, line_subtotal)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *;
          `;
          const lineValues = [newOrder.id, line.lineId, line.itemId, line.name, line.quantity, line.lineSubtotal];
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
              const modRes = await db.query(insertModQuery, [newLine.id, mod.name, mod.option, mod.price]);
              newLine.modifiers.push(modRes.rows[0]);
            }
          }
          newOrder.lines.push(newLine);
        }
      }

      // 6. Emit Socket Event for Real-Time Sync
      io.emit('new_order', newOrder);
      
    } catch (error) {
      console.error('Error processing VAPI webhook payload:', error);
    }
  });

  return router;
};
