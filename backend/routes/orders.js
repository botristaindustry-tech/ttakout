const express = require('express');
const router = express.Router();
const db = require('../db');

module.exports = (io) => {
  // Get all active orders (PENDING, KITCHEN_QUEUED, READY_FOR_PICKUP)
  router.get('/', async (req, res) => {
    try {
      const ordersQuery = `
        SELECT o.*, 
               EXISTS (SELECT 1 FROM flagged_phones fp WHERE fp.phone_number = o.customer_phone) AS is_flagged
        FROM orders o 
        ORDER BY created_at ASC;
      `;
      const { rows: orders } = await db.query(ordersQuery);
      
      // Fetch lines and modifiers
      for (let order of orders) {
        const linesQuery = `SELECT * FROM order_lines WHERE order_id = $1`;
        const { rows: lines } = await db.query(linesQuery, [order.id]);
        
        for (let line of lines) {
          const modsQuery = `SELECT * FROM order_modifiers WHERE order_line_id = $1`;
          const { rows: mods } = await db.query(modsQuery, [line.id]);
          line.modifiers = mods;
        }
        order.lines = lines;
      }
      
      res.json(orders);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });
  // Get analytics for a date range
  router.get('/analytics/today', async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
      
      // Default to today if no params
      const start = startDate || new Date().toISOString().split('T')[0];
      const end = endDate || start;
      
      const isMultiDay = start !== end;

      // 1. Time Breakdown (hourly for single day, daily for multi-day)
      const timeQuery = isMultiDay
        ? `
          SELECT 
            created_at::date AS label,
            COUNT(*) as count,
            SUM(total) as revenue
          FROM orders
          WHERE created_at::date >= $1 AND created_at::date <= $2
            AND status != 'REJECTED'
          GROUP BY 1
          ORDER BY 1;
        `
        : `
          SELECT 
            EXTRACT(hour FROM created_at) AS label,
            COUNT(*) as count,
            SUM(total) as revenue
          FROM orders
          WHERE created_at::date = $1
            AND status != 'REJECTED'
          GROUP BY 1
          ORDER BY 1;
        `;
      const timeParams = isMultiDay ? [start, end] : [start];
      const { rows: timeSeries } = await db.query(timeQuery, timeParams);

      // 2. Payment Split
      const paymentQuery = `
        SELECT 
          payment_type, 
          COUNT(*) as count, 
          SUM(total) as revenue 
        FROM orders 
        WHERE created_at::date >= $1 AND created_at::date <= $2
          AND payment_type IS NOT NULL 
          AND status = 'PAID'
        GROUP BY 1;
      `;
      const { rows: paymentSplit } = await db.query(paymentQuery, [start, end]);

      // 3. Rejected Count
      const rejectedQuery = `
        SELECT COUNT(*) as count 
        FROM orders 
        WHERE created_at::date >= $1 AND created_at::date <= $2
          AND status = 'REJECTED';
      `;
      const { rows: rejected } = await db.query(rejectedQuery, [start, end]);

      // 4. Overall Totals
      const totalQuery = `
        SELECT COUNT(*) as count, SUM(total) as revenue
        FROM orders
        WHERE created_at::date >= $1 AND created_at::date <= $2 AND status != 'REJECTED';
      `;
      const { rows: totals } = await db.query(totalQuery, [start, end]);

      res.json({
        timeSeries,
        isMultiDay,
        paymentSplit,
        rejected: rejected[0].count,
        totals: totals[0]
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to fetch analytics' });
    }
  });

  // Update order status (Process, Reject, Ready, Paid)
  router.patch('/:id/status', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, reject_reason, payment_type } = req.body;
      
      const updateQuery = `
        UPDATE orders 
        SET status = $1, 
            reject_reason = COALESCE($2, reject_reason),
            payment_type = COALESCE($3, payment_type),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING *;
      `;
      
      const { rows } = await db.query(updateQuery, [status, reject_reason, payment_type, id]);
      if (rows.length === 0) return res.status(404).json({ error: 'Order not found' });
      
      const updatedOrder = rows[0];
      
      // Fetch lines to attach to payload
      const linesQuery = `SELECT * FROM order_lines WHERE order_id = $1`;
      const { rows: lines } = await db.query(linesQuery, [updatedOrder.id]);
      for (let line of lines) {
        const modsQuery = `SELECT * FROM order_modifiers WHERE order_line_id = $1`;
        const { rows: mods } = await db.query(modsQuery, [line.id]);
        line.modifiers = mods;
      }
      updatedOrder.lines = lines;

      // Emit real-time update
      io.emit('order_updated', updatedOrder);
      res.json(updatedOrder);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  // Mark line item as completed (KDS checkbox)
  router.patch('/lines/:lineId/complete', async (req, res) => {
    try {
      const { lineId } = req.params;
      const { is_completed } = req.body;
      
      const updateLineQuery = `
        UPDATE order_lines 
        SET is_completed = $1
        WHERE id = $2
        RETURNING *;
      `;
      const { rows } = await db.query(updateLineQuery, [is_completed, lineId]);
      if (rows.length === 0) return res.status(404).json({ error: 'Line not found' });
      
      io.emit('line_updated', rows[0]);
      res.json(rows[0]);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to update line status' });
    }
  });

  return router;
};
