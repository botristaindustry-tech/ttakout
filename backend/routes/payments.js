const express = require('express');
const router = express.Router();
const db = require('../db');
const { stripe } = require('../services/stripeService');

module.exports = (io) => {

  /**
   * POST /api/v1/payments/stripe-webhook
   * Stripe sends events here. Must use raw body (not parsed JSON) for signature verification.
   * The raw body middleware is registered in server.js BEFORE express.json().
   */
  router.post('/stripe-webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`[Stripe Webhook] Received event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const orderId = session.metadata?.order_id;

      if (!orderId) {
        console.warn('[Stripe Webhook] checkout.session.completed missing order_id in metadata.');
        return res.status(200).json({ received: true });
      }

      try {
        // Update order to PENDING so it appears in the Intake Control Center
        const { rows } = await db.query(
          `UPDATE orders 
           SET status = 'PENDING', 
               payment_type = 'STRIPE_ONLINE',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND status = 'PENDING_PAYMENT'
           RETURNING *`,
          [orderId]
        );

        if (rows.length === 0) {
          console.warn(`[Stripe Webhook] Order ${orderId} not found or already processed.`);
          return res.status(200).json({ received: true });
        }

        const updatedOrder = rows[0];

        // Fetch lines to attach to the socket payload
        const { rows: lines } = await db.query(
          'SELECT * FROM order_lines WHERE order_id = $1', [updatedOrder.id]
        );
        for (const line of lines) {
          const { rows: mods } = await db.query(
            'SELECT * FROM order_modifiers WHERE order_line_id = $1', [line.id]
          );
          line.modifiers = mods;
        }
        updatedOrder.lines = lines;

        // Emit real-time event — the order will instantly appear in Intake Control Center
        io.emit('order_updated', updatedOrder);
        io.emit('new_order', updatedOrder); // Also emit new_order for audio alert

        console.log(`[Stripe Webhook] ✅ Order #${updatedOrder.daily_order_code} (${orderId}) payment confirmed. Moved to PENDING.`);
      } catch (err) {
        console.error('[Stripe Webhook] Error updating order after payment:', err);
        return res.status(500).json({ error: 'Failed to process payment confirmation' });
      }
    }

    res.status(200).json({ received: true });
  });

  /**
   * GET /api/v1/payments/success
   * Stripe redirects here after successful payment. Show a friendly confirmation page.
   */
  router.get('/success', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Confirmed — T-Takout</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a; color: #f1f5f9;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 2rem;
          }
          .card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1.5rem; padding: 3rem; text-align: center;
            max-width: 480px; width: 100%;
            backdrop-filter: blur(20px);
          }
          .icon { font-size: 4rem; margin-bottom: 1.5rem; }
          h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.75rem; color: #10b981; }
          p { color: #94a3b8; line-height: 1.6; font-size: 1rem; }
          .badge {
            display: inline-block; margin-top: 1.5rem;
            background: rgba(16, 185, 129, 0.15); color: #10b981;
            border: 1px solid rgba(16, 185, 129, 0.3);
            padding: 0.5rem 1.25rem; border-radius: 2rem; font-size: 0.875rem; font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">✅</div>
          <h1>Payment Confirmed!</h1>
          <p>Thank you! Your payment was received and your order is now being prepared. You'll be notified when it's ready for pickup.</p>
          <div class="badge">🍽️ Order is in the kitchen</div>
        </div>
      </body>
      </html>
    `);
  });

  /**
   * GET /api/v1/payments/cancel
   * Stripe redirects here if the customer cancels or the session expires.
   */
  router.get('/cancel', (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Cancelled — T-Takout</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #0f172a; color: #f1f5f9;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; padding: 2rem;
          }
          .card {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 1.5rem; padding: 3rem; text-align: center;
            max-width: 480px; width: 100%;
            backdrop-filter: blur(20px);
          }
          .icon { font-size: 4rem; margin-bottom: 1.5rem; }
          h1 { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.75rem; color: #f87171; }
          p { color: #94a3b8; line-height: 1.6; font-size: 1rem; }
          .badge {
            display: inline-block; margin-top: 1.5rem;
            background: rgba(248, 113, 113, 0.15); color: #f87171;
            border: 1px solid rgba(248, 113, 113, 0.3);
            padding: 0.5rem 1.25rem; border-radius: 2rem; font-size: 0.875rem; font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon">❌</div>
          <h1>Payment Cancelled</h1>
          <p>Your order has not been processed. Please call us back if you'd like to place your order again.</p>
          <div class="badge">📞 Please call to reorder</div>
        </div>
      </body>
      </html>
    `);
  });

  return router;
};
