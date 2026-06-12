const twilio = require('twilio');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

/**
 * Sends a payment request SMS to a customer.
 * @param {string} toPhone    - Customer's phone number.
 * @param {object} order      - The order object.
 * @param {string} paymentUrl - The Stripe Checkout URL.
 */
async function sendPaymentRequestSms(toPhone, order, paymentUrl) {
  // Normalize phone to E.164 format (+1XXXXXXXXXX)
  const digits = toPhone.replace(/\D/g, '');
  const e164 = digits.startsWith('1') ? `+${digits}` : `+1${digits}`;

  const message =
    `Hi ${order.customer_name}! 👋 Your order #${order.daily_order_code} from T-Takout is ready for payment.\n\n` +
    `🧾 Total: $${Number(order.total).toFixed(2)}\n\n` +
    `Tap to pay securely:\n${paymentUrl}\n\n` +
    `This link expires in 30 minutes. Your order will be prepared once payment is confirmed.`;

  const result = await client.messages.create({
    body: message,
    from: process.env.TWILIO_FROM_NUMBER,
    to: e164,
  });

  console.log(`[SMS] Sent payment request to ${e164} — SID: ${result.sid}`);
  return result;
}

module.exports = { sendPaymentRequestSms };
