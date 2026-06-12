const Stripe = require('stripe');

// Lazy-initialize so server boots even without STRIPE_SECRET_KEY locally
// (The key is set in Render environment variables for production)
let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Add it to your environment variables.');
    }
    _stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

// Export the lazy getter as `stripe` so payments.js can use it the same way
const stripe = new Proxy({}, {
  get(_, prop) {
    return getStripe()[prop];
  }
});

/**
 * Creates a Stripe Checkout Session for an order.
 * @param {object} order - The order object from the database.
 * @param {Array}  lines - The order line items.
 * @returns {string} - The Stripe Checkout URL to send to the customer.
 */
async function createCheckoutSession(order, lines) {
  const lineItems = lines.map(line => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: line.name,
        description: line.modifiers?.filter(m => m.name !== 'Notes').map(m => m.option_name).join(', ') || undefined,
      },
      unit_amount: Math.round((line.line_subtotal / line.quantity) * 100), // cents
    },
    quantity: line.quantity,
  }));

  // Add tax as a line item for transparency
  if (order.tax > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: { name: 'Sales Tax (8.875%)' },
        unit_amount: Math.round(order.tax * 100),
      },
      quantity: 1,
    });
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    success_url: `${process.env.BACKEND_URL || 'https://ttakout.onrender.com'}/api/v1/payments/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BACKEND_URL || 'https://ttakout.onrender.com'}/api/v1/payments/cancel?order_id=${order.id}`,
    metadata: {
      order_id: order.id,
      order_code: String(order.daily_order_code),
      customer_phone: order.customer_phone,
      customer_name: order.customer_name,
    },
    expires_at: Math.floor(Date.now() / 1000) + 1800, // Session expires in 30 minutes
  });

  return session.url;
}

module.exports = { createCheckoutSession, stripe };
